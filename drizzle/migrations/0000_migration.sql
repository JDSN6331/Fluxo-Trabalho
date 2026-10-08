create type public.app_role as enum ('solicitante', 'responsavel');
create type public.task_priority as enum ('alta', 'media', 'baixa');
create type public.task_status as enum ('em_andamento', 'concluida', 'cancelada');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Roles visible to signed-in users" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare r app_role;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), coalesce(new.email,''));
  r := case when new.raw_user_meta_data->>'role' = 'responsavel' then 'responsavel'::app_role else 'solicitante'::app_role end;
  insert into public.user_roles (user_id, role) values (new.id, r);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  priority task_priority not null default 'media',
  status task_status not null default 'em_andamento',
  due_date date not null default current_date,
  created_by uuid not null,
  assigned_to uuid not null,
  status_changed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "Tasks visible to signed-in users" on public.tasks for select to authenticated using (true);
create policy "Solicitantes create tasks" on public.tasks for insert to authenticated
  with check (auth.uid() = created_by and public.has_role(auth.uid(), 'solicitante') and status = 'em_andamento');
create policy "Creator or assignee update" on public.tasks for update to authenticated
  using (auth.uid() = created_by or auth.uid() = assigned_to)
  with check (auth.uid() = created_by or auth.uid() = assigned_to);
create policy "Creator deletes" on public.tasks for delete to authenticated using (auth.uid() = created_by);

create or replace function public.guard_task_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if auth.uid() is distinct from old.assigned_to then
      raise exception 'Somente o responsável pode alterar o status';
    end if;
    new.status_changed_at := now();
  end if;
  if auth.uid() = old.assigned_to and auth.uid() is distinct from old.created_by then
    if new.title is distinct from old.title or new.description is distinct from old.description
       or new.priority is distinct from old.priority or new.due_date is distinct from old.due_date
       or new.assigned_to is distinct from old.assigned_to or new.created_by is distinct from old.created_by then
      raise exception 'O responsável só pode alterar o status';
    end if;
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Criador não pode ser alterado';
  end if;
  return new;
end; $$;
create trigger tasks_guard before update on public.tasks for each row execute function public.guard_task_update();

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.task_comments to authenticated;
grant all on public.task_comments to service_role;
alter table public.task_comments enable row level security;
create policy "Comments visible to signed-in users" on public.task_comments for select to authenticated using (true);
create policy "Task creator comments" on public.task_comments for insert to authenticated
  with check (auth.uid() = author_id and exists (select 1 from public.tasks t where t.id = task_id and t.created_by = auth.uid()));
create policy "Author deletes comment" on public.task_comments for delete to authenticated using (auth.uid() = author_id);

alter publication supabase_realtime add table public.tasks;