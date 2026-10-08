import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  meQuery, peopleQuery, useCommentsQuery, PRIORITY_CHIP, PRIORITY_LABEL, STATUS_CHIP, STATUS_LABEL,
  type Status, type Task,
} from "@/lib/tasks";

export function StatusChip({ status }: { status: Status }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", STATUS_CHIP[status])}>{STATUS_LABEL[status]}</span>;
}
export function PriorityChip({ p }: { p: Task["priority"] }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", PRIORITY_CHIP[p])}>{PRIORITY_LABEL[p]}</span>;
}

export function TaskDetail({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{task && <Body task={task} onClose={onClose} />}</SheetContent>
    </Sheet>
  );
}

function Body({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: people = [] } = useQuery(peopleQuery);
  const { data: comments = [] } = useCommentsQuery(task.id);
  const [text, setText] = useState("");
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const isCreator = me?.id === task.created_by;
  const isAssignee = me?.id === task.assigned_to;

  async function setStatus(status: Status) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success(status === "concluida" ? "Tarefa concluída" : status === "cancelada" ? "Tarefa cancelada" : "Tarefa reaberta");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }
  async function addComment() {
    if (!text.trim() || !me) return;
    const { error } = await supabase.from("task_comments").insert({ task_id: task.id, author_id: me.id, body: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
    qc.invalidateQueries({ queryKey: ["comments", task.id] });
  }
  async function remove() {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }

  return (
    <div className="space-y-6">
      <SheetHeader>
        <div className="flex gap-2"><StatusChip status={task.status} /><PriorityChip p={task.priority} /></div>
        <SheetTitle className="font-display text-2xl">{task.title}</SheetTitle>
      </SheetHeader>
      {task.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}
      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 text-sm">
        <div><dt className="text-xs text-muted-foreground">Data</dt><dd>{format(parseISO(task.due_date), "dd 'de' MMM yyyy", { locale: ptBR })}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Criada por</dt><dd>{name(task.created_by)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Responsável</dt><dd>{name(task.assigned_to)}</dd></div>
        {task.status_changed_at && <div><dt className="text-xs text-muted-foreground">Atualizada em</dt><dd>{format(parseISO(task.status_changed_at), "dd/MM HH:mm")}</dd></div>}
      </dl>

      {isAssignee && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Marcar tarefa</p>
          {task.status === "em_andamento" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="success" onClick={() => setStatus("concluida")}><Check /> Concluída</Button>
              <Button variant="cancel" onClick={() => setStatus("cancelada")}><X /> Não feita</Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setStatus("em_andamento")}>Voltar para em andamento</Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Comentários</p>
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2">
            <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{name(c.author_id)} · {format(parseISO(c.created_at), "dd/MM HH:mm")}</p>
          </div>
        ))}
        {isCreator && (
          <div className="space-y-2">
            <Textarea placeholder="Adicionar comentário..." value={text} onChange={(e) => setText(e.target.value)} />
            <Button variant="gold" size="sm" onClick={addComment} disabled={!text.trim()}>Comentar</Button>
          </div>
        )}
      </div>

      {isCreator && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}><Trash2 /> Excluir tarefa</Button>
      )}
    </div>
  );
}
