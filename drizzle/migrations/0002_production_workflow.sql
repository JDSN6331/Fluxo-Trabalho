-- Serialize sign-ups so exactly one first user becomes administrator.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare assigned_role app_role;
begin
  perform pg_advisory_xact_lock(824771);
  if not exists (select 1 from public.user_roles) then
    assigned_role := 'administrador'::app_role;
  else
    assigned_role := 'pendente'::app_role;
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), coalesce(new.email,''));
  insert into public.user_roles (user_id, role) values (new.id, assigned_role);
  return new;
end; $$;

-- Bootstrap databases that already had users before this migration.
do $$
declare first_user uuid;
begin
  if not exists (select 1 from public.user_roles where role = 'administrador'::app_role) then
    select id into first_user from public.profiles order by created_at, id limit 1;
    if first_user is not null then
      delete from public.user_roles where user_id = first_user;
      insert into public.user_roles(user_id, role) values(first_user, 'administrador'::app_role);
    end if;
  end if;
end $$;

create or replace function public.set_user_role(_user_id uuid, _role app_role)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'administrador') then
    raise exception 'Somente administradores podem definir papéis';
  end if;
  if _role not in ('solicitante'::app_role, 'responsavel'::app_role, 'administrador'::app_role) then
    raise exception 'Papel inválido';
  end if;
  if _user_id = auth.uid() and _role <> 'administrador'::app_role then
    raise exception 'O administrador não pode remover o próprio acesso';
  end if;
  insert into public.user_roles (user_id, role) values (_user_id, _role)
  on conflict (user_id, role) do update set role = excluded.role;
  delete from public.user_roles where user_id = _user_id and role <> _role;
end; $$;
grant execute on function public.set_user_role(uuid, app_role) to authenticated;

alter table public.tasks
  add constraint tasks_created_by_fkey foreign key (created_by) references public.profiles(id) on delete restrict not valid,
  add constraint tasks_assigned_to_fkey foreign key (assigned_to) references public.profiles(id) on delete restrict not valid;
alter table public.task_comments
  add constraint task_comments_author_id_fkey foreign key (author_id) references public.profiles(id) on delete restrict not valid;

drop policy if exists "Solicitantes create tasks" on public.tasks;
create policy "Solicitantes and admins create tasks" on public.tasks for insert to authenticated
  with check (
    auth.uid() = created_by
    and (public.has_role(auth.uid(), 'solicitante') or public.has_role(auth.uid(), 'administrador'))
    and status = 'em_andamento'
  );

create table public.task_deletions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  title text not null,
  description text not null,
  priority task_priority not null,
  status task_status not null,
  due_date date not null,
  created_by uuid not null references public.profiles(id),
  assigned_to uuid not null references public.profiles(id),
  deleted_by uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) >= 5),
  deleted_at timestamptz not null default now()
);
grant select on public.task_deletions to authenticated;
grant all on public.task_deletions to service_role;
alter table public.task_deletions enable row level security;
create policy "Deletion history visible to signed-in users" on public.task_deletions for select to authenticated using (true);

drop policy if exists "Creator deletes" on public.tasks;
revoke delete on public.tasks from authenticated;

create or replace function public.delete_task_with_reason(_task_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare t public.tasks%rowtype;
begin
  if length(trim(coalesce(_reason, ''))) < 5 then
    raise exception 'Informe um motivo com pelo menos 5 caracteres';
  end if;
  select * into t from public.tasks where id = _task_id for update;
  if not found then raise exception 'Tarefa não encontrada'; end if;
  if auth.uid() <> t.created_by and not public.has_role(auth.uid(), 'administrador') then
    raise exception 'Somente o criador ou administrador pode excluir a tarefa';
  end if;
  insert into public.task_deletions
    (task_id,title,description,priority,status,due_date,created_by,assigned_to,deleted_by,reason)
  values
    (t.id,t.title,t.description,t.priority,t.status,t.due_date,t.created_by,t.assigned_to,auth.uid(),trim(_reason));
  insert into public.notification_outbox(event_type,task_id,recipient_id,recipient_email,payload)
  select 'excluida',t.id,p.id,p.email,jsonb_build_object('title',t.title,'status',t.status,'priority',t.priority,'due_date',t.due_date,'reason',trim(_reason))
  from public.profiles p where p.id in (t.created_by,t.assigned_to) and p.email <> '';
  delete from public.tasks where id = _task_id;
end; $$;
grant execute on function public.delete_task_with_reason(uuid, text) to authenticated;

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('criada','status_alterado','comentario')),
  old_status task_status,
  new_status task_status,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.task_events to authenticated;
grant all on public.task_events to service_role;
alter table public.task_events enable row level security;
create policy "Task history visible to signed-in users" on public.task_events for select to authenticated using (true);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  task_id uuid not null,
  recipient_id uuid not null references public.profiles(id),
  recipient_email text not null,
  payload jsonb not null,
  attempts integer not null default 0,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
grant all on public.notification_outbox to service_role;
alter table public.notification_outbox enable row level security;

create or replace function public.record_task_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare event_name text; actor uuid; recipient uuid; recipient_mail text;
begin
  actor := auth.uid();
  if tg_op = 'INSERT' then
    event_name := 'criada';
    insert into public.task_events(task_id,actor_id,event_type,new_status) values(new.id,actor,event_name,new.status);
  elsif new.status is distinct from old.status then
    event_name := 'status_alterado';
    insert into public.task_events(task_id,actor_id,event_type,old_status,new_status) values(new.id,actor,event_name,old.status,new.status);
  else
    return new;
  end if;

  for recipient, recipient_mail in
    select p.id, p.email from public.profiles p
    where p.id in (new.created_by,new.assigned_to) and p.email <> ''
  loop
    insert into public.notification_outbox(event_type,task_id,recipient_id,recipient_email,payload)
    values(event_name,new.id,recipient,recipient_mail,jsonb_build_object(
      'title',new.title,'status',new.status,'priority',new.priority,'due_date',new.due_date,
      'created_by',new.created_by,'assigned_to',new.assigned_to
    ));
  end loop;
  return new;
end; $$;
create trigger task_events_and_notifications after insert or update on public.tasks
for each row execute function public.record_task_event();

create or replace function public.record_comment_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.task_events(task_id,actor_id,event_type,details)
  values(new.task_id,new.author_id,'comentario',jsonb_build_object('comment_id',new.id));
  insert into public.notification_outbox(event_type,task_id,recipient_id,recipient_email,payload)
  select 'comentario',t.id,p.id,p.email,jsonb_build_object('title',t.title,'status',t.status,'priority',t.priority,'due_date',t.due_date)
  from public.tasks t join public.profiles p on p.id in (t.created_by,t.assigned_to)
  where t.id = new.task_id and p.email <> '';
  return new;
end; $$;
create trigger comment_events after insert on public.task_comments
for each row execute function public.record_comment_event();
