import { queryOptions, useQuery } from "@tanstack/react-query";
import { getMe, listComments, listEvents, listPeople, listTasks } from "./workflow.functions";

export type Priority = "alta" | "media" | "baixa";
export type Status = "em_andamento" | "concluida" | "cancelada";
export type Role = "solicitante" | "responsavel" | "administrador" | "pendente";
export type Task = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  due_date: string;
  created_by: string;
  assigned_to: string;
  status_changed_at: string | null;
  created_at: string;
};
export type Profile = { id: string; full_name: string; email: string; role?: Role };
export const PRIORITY_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } satisfies Record<
  Priority,
  string
>;
export const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Não feita / Cancelada",
};
export const STATUS_DOT = {
  em_andamento: "bg-warning",
  concluida: "bg-success",
  cancelada: "bg-destructive",
} satisfies Record<Status, string>;
export const STATUS_CHIP = {
  em_andamento: "bg-warning/15 text-warning border-warning/30",
  concluida: "bg-success/15 text-success border-success/30",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
} satisfies Record<Status, string>;
export const PRIORITY_CHIP = {
  alta: "text-destructive border-destructive/40",
  media: "text-primary border-primary/40",
  baixa: "text-muted-foreground border-border",
} satisfies Record<Priority, string>;
export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: () => listTasks() as Promise<Task[]>,
});
export const peopleQuery = queryOptions({
  queryKey: ["people"],
  queryFn: async () => {
    const data = await listPeople();
    return data.map((p) => ({
      id: p.id,
      full_name: p.name,
      email: p.email,
      role: (p.role === "admin" ? "administrador" : p.workflowRole) as Role,
    }));
  },
});
export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMe() as Promise<{ id: string; email: string; name: string; role: Role } | null>,
});
export function useCommentsQuery(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => listComments({ data: { taskId } }),
  });
}
export function useTaskEventsQuery(taskId: string) {
  return useQuery({
    queryKey: ["task-events", taskId],
    queryFn: () => listEvents({ data: { taskId } }),
  });
}
