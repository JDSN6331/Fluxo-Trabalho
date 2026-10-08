import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Priority = Database["public"]["Enums"]["task_priority"];
export type Status = Database["public"]["Enums"]["task_status"];
export type Role = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Comment = Database["public"]["Tables"]["task_comments"]["Row"];

export const PRIORITY_LABEL: Record<Priority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
export const STATUS_LABEL: Record<Status, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Não feita / Cancelada",
};
export const STATUS_DOT: Record<Status, string> = {
  em_andamento: "bg-warning",
  concluida: "bg-success",
  cancelada: "bg-destructive",
};
export const STATUS_CHIP: Record<Status, string> = {
  em_andamento: "bg-warning/15 text-warning border-warning/30",
  concluida: "bg-success/15 text-success border-success/30",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
};
export const PRIORITY_CHIP: Record<Priority, string> = {
  alta: "text-destructive border-destructive/40",
  media: "text-primary border-primary/40",
  baixa: "text-muted-foreground border-border",
};

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("due_date").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const peopleQuery = queryOptions({
  queryKey: ["people"],
  queryFn: async () => {
    const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const roleMap = new Map(roles!.map((r) => [r.user_id, r.role]));
    return profiles!.map((p) => ({ ...p, role: roleMap.get(p.id) as Role | undefined }));
  },
});

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    return { id: user.id, email: user.email ?? "", name: (user.user_metadata?.["full_name"] as string) ?? user.email ?? "", role: (r?.role ?? "solicitante") as Role };
  },
});

export function useCommentsQuery(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
}
