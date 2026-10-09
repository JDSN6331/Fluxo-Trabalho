/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { auth } from "./auth.server";
import { execute, row, rows } from "./database.server";

async function currentUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session?.user) throw new Error("Não autenticado");
  return session.user as typeof session.user & { role?: string; workflowRole?: string };
}
async function adminUser() {
  const user = await currentUser();
  if (user.role !== "admin") throw new Error("Acesso restrito ao administrador");
  return user;
}
const now = () => new Date().toISOString();
async function event(
  taskId: string,
  actorId: string,
  type: string,
  oldStatus?: string,
  newStatus?: string,
) {
  await execute(
    "INSERT INTO task_events(id,task_id,actor_id,event_type,old_status,new_status,details,created_at) VALUES(?,?,?,?,?,?,?,?)",
    [randomUUID(), taskId, actorId, type, oldStatus ?? null, newStatus ?? null, "{}", now()],
  );
}
async function notify(type: string, emails: string[], payload: unknown) {
  for (const email of [...new Set(emails.filter(Boolean))])
    await execute(
      "INSERT INTO notification_outbox(id,event_type,recipient_email,payload,created_at) VALUES(?,?,?,?,?)",
      [randomUUID(), type, email, JSON.stringify(payload), now()],
    );
}

export const getMe = createServerFn().handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session?.user) return null;
  const user = session.user as typeof session.user & { role?: string; workflowRole?: string };
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "administrador" : (user.workflowRole ?? "pendente"),
  };
});
export const listPeople = createServerFn().handler(async () =>
  rows<{ id: string; name: string; email: string; workflowRole: string; role: string }>(
    `SELECT id,name,email,"workflowRole",role
     FROM "user"
     ORDER BY CASE
       WHEN role='admin' THEN 0
       WHEN "workflowRole"='solicitante' THEN 1
       WHEN "workflowRole"='responsavel' THEN 2
       ELSE 3
     END, name`,
  ),
);
export const listTasks = createServerFn().handler(async () =>
  rows<any>("SELECT * FROM tasks ORDER BY due_date,created_at"),
);
export const listComments = createServerFn()
  .validator(z.object({ taskId: z.string() }))
  .handler(async ({ data }) =>
    rows<any>("SELECT * FROM task_comments WHERE task_id=? ORDER BY created_at", [data.taskId]),
  );
export const listEvents = createServerFn()
  .validator(z.object({ taskId: z.string() }))
  .handler(async ({ data }) =>
    rows<any>("SELECT * FROM task_events WHERE task_id=? ORDER BY created_at", [data.taskId]),
  );

export const createTask = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string(),
      priority: z.enum(["alta", "media", "baixa"]),
      assignedTo: z.string(),
      dueDate: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser();
    if (
      !["solicitante", "administrador"].includes(
        user.role === "admin" ? "administrador" : (user.workflowRole ?? ""),
      )
    )
      throw new Error("Sem permissão para criar tarefas");
    const id = randomUUID();
    await execute(
      "INSERT INTO tasks(id,title,description,priority,status,due_date,created_by,assigned_to,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        id,
        data.title,
        data.description,
        data.priority,
        "em_andamento",
        data.dueDate,
        user.id,
        data.assignedTo,
        now(),
      ],
    );
    await event(id, user.id, "criada", undefined, "em_andamento");
    const assigned = await row<{ email: string }>(`SELECT email FROM "user" WHERE id=?`, [
      data.assignedTo,
    ]);
    await notify("criada", [user.email, assigned?.email ?? ""], {
      taskId: id,
      title: data.title,
      status: "em_andamento",
      priority: data.priority,
      due_date: data.dueDate,
    });
    return { id };
  });
export const updateTask = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      title: z.string().min(1),
      description: z.string(),
      priority: z.enum(["alta", "media", "baixa"]),
      dueDate: z.string(),
      assignedTo: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const u = await currentUser();
    const t = await row<any>("SELECT * FROM tasks WHERE id=?", [data.id]);
    if (!t || t.created_by !== u.id) throw new Error("Somente o criador pode editar");
    await execute(
      "UPDATE tasks SET title=?,description=?,priority=?,due_date=?,assigned_to=? WHERE id=?",
      [data.title, data.description, data.priority, data.dueDate, data.assignedTo, data.id],
    );
    return { ok: true };
  });
export const changeTaskStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({ id: z.string(), status: z.enum(["em_andamento", "concluida", "cancelada"]) }),
  )
  .handler(async ({ data }) => {
    const u = await currentUser();
    const t = await row<any>("SELECT * FROM tasks WHERE id=?", [data.id]);
    if (!t || t.assigned_to !== u.id)
      throw new Error("Somente o responsável pode alterar o status");
    await execute("UPDATE tasks SET status=?,status_changed_at=? WHERE id=?", [
      data.status,
      now(),
      data.id,
    ]);
    await event(data.id, u.id, "status_alterado", t.status, data.status);
    const creator = await row<any>(`SELECT email FROM "user" WHERE id=?`, [t.created_by]);
    await notify("status_alterado", [u.email, creator?.email ?? ""], { ...t, status: data.status });
    return { ok: true };
  });
export const addTaskComment = createServerFn({ method: "POST" })
  .validator(z.object({ taskId: z.string(), body: z.string().min(1) }))
  .handler(async ({ data }) => {
    const u = await currentUser();
    const t = await row<any>("SELECT * FROM tasks WHERE id=?", [data.taskId]);
    if (!t || t.created_by !== u.id) throw new Error("Somente o criador pode comentar");
    await execute(
      "INSERT INTO task_comments(id,task_id,author_id,body,created_at) VALUES(?,?,?,?,?)",
      [randomUUID(), data.taskId, u.id, data.body, now()],
    );
    await event(data.taskId, u.id, "comentario");
    return { ok: true };
  });
export const deleteTask = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), reason: z.string().min(5) }))
  .handler(async ({ data }) => {
    const u = await adminUser();
    const t = await row<any>("SELECT * FROM tasks WHERE id=?", [data.id]);
    if (!t) throw new Error("Tarefa não encontrada");
    await execute(
      "INSERT INTO task_deletions(id,task_id,title,deleted_by,reason,deleted_at) VALUES(?,?,?,?,?,?)",
      [randomUUID(), t.id, t.title, u.id, data.reason, now()],
    );
    await execute("DELETE FROM tasks WHERE id=?", [data.id]);
    return { ok: true };
  });

export const listTaskDeletions = createServerFn().handler(async () => {
  await adminUser();
  return rows<{
    id: string;
    task_id: string;
    title: string;
    deleted_by: string;
    deleted_by_name: string;
    reason: string;
    deleted_at: string;
  }>(
    `SELECT td.*, COALESCE(u.name, td.deleted_by) AS deleted_by_name
     FROM task_deletions td
     LEFT JOIN "user" u ON u.id=td.deleted_by
     ORDER BY td.deleted_at DESC`,
  );
});

export const createPasswordResetLink = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string(), baseUrl: z.string().url() }))
  .handler(async ({ data }) => {
    const admin = await adminUser();
    const target = await row<any>(`SELECT id,email,name FROM "user" WHERE id=?`, [data.userId]);
    if (!target) throw new Error("Usuário não encontrado");
    await execute("UPDATE password_reset_links SET used_at=? WHERE user_id=? AND used_at IS NULL", [
      now(),
      target.id,
    ]);
    const token = randomBytes(32).toString("base64url"),
      hash = createHash("sha256").update(token).digest("hex"),
      expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await execute(
      "INSERT INTO password_reset_links(id,user_id,token_hash,requested_by,expires_at,created_at) VALUES(?,?,?,?,?,?)",
      [randomUUID(), target.id, hash, admin.id, expires, now()],
    );
    const link = `${data.baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    return { link, expiresAt: expires };
  });
export const resetPassword = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string(), password: z.string().min(8) }))
  .handler(async ({ data }) => {
    const hash = createHash("sha256").update(data.token).digest("hex"),
      record = await row<any>(
        "SELECT * FROM password_reset_links WHERE token_hash=? AND used_at IS NULL",
        [hash],
      );
    if (!record || new Date(record.expires_at) < new Date())
      throw new Error("Link inválido ou expirado");
    const password = await hashPassword(data.password);
    await execute(`UPDATE account SET password=? WHERE "userId"=? AND "providerId"='credential'`, [
      password,
      record.user_id,
    ]);
    await execute("UPDATE password_reset_links SET used_at=? WHERE id=?", [now(), record.id]);
    await execute(`DELETE FROM session WHERE "userId"=?`, [record.user_id]);
    return { ok: true };
  });

export const getMetrics = createServerFn().handler(async () => {
  await currentUser();
  const all = await rows<any>("SELECT status,priority,created_at,status_changed_at FROM tasks");
  return {
    total: all.length,
    emAndamento: all.filter((x) => x.status === "em_andamento").length,
    concluidas: all.filter((x) => x.status === "concluida").length,
    canceladas: all.filter((x) => x.status === "cancelada").length,
    alta: all.filter((x) => x.priority === "alta").length,
  };
});
