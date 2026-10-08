import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Trash2, Pencil, History } from "lucide-react";
import { toast } from "sonner";
import { addTaskComment, changeTaskStatus, deleteTask, updateTask } from "@/lib/workflow.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  meQuery,
  peopleQuery,
  useCommentsQuery,
  useTaskEventsQuery,
  PRIORITY_CHIP,
  PRIORITY_LABEL,
  STATUS_CHIP,
  STATUS_LABEL,
  type Priority,
  type Status,
  type Task,
} from "@/lib/tasks";

export function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
        STATUS_CHIP[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
export function PriorityChip({ p }: { p: Task["priority"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
        PRIORITY_CHIP[p],
      )}
    >
      {PRIORITY_LABEL[p]}
    </span>
  );
}

export function TaskDetail({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {task && <Body task={task} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: people = [] } = useQuery(peopleQuery);
  const { data: comments = [] } = useCommentsQuery(task.id);
  const { data: events = [] } = useTaskEventsQuery(task.id);
  const [text, setText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
    due_date: task.due_date,
    assigned_to: task.assigned_to,
  });
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const isCreator = me?.id === task.created_by;
  const isAssignee = me?.id === task.assigned_to;
  const isAdmin = me?.role === "administrador";

  async function setStatus(status: Status) {
    try {
      await changeTaskStatus({ data: { id: task.id, status } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar status");
      return;
    }
    toast.success(
      status === "concluida"
        ? "Tarefa concluída"
        : status === "cancelada"
          ? "Tarefa cancelada"
          : "Tarefa reaberta",
    );
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }
  async function addComment() {
    if (!text.trim() || !me) return;
    try {
      await addTaskComment({ data: { taskId: task.id, body: text.trim() } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao comentar");
      return;
    }
    setText("");
    qc.invalidateQueries({ queryKey: ["comments", task.id] });
  }
  async function remove() {
    try {
      await deleteTask({ data: { id: task.id, reason: deleteReason.trim() } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir");
      return;
    }
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }
  async function saveEdit() {
    if (!draft.title.trim()) {
      toast.error("Informe o título");
      return;
    }
    try {
      await updateTask({
        data: {
          id: task.id,
          title: draft.title.trim(),
          description: draft.description,
          priority: draft.priority,
          dueDate: draft.due_date,
          assignedTo: draft.assigned_to,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar");
      return;
    }
    toast.success("Tarefa atualizada");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <div className="space-y-6">
      <SheetHeader>
        <div className="flex gap-2">
          <StatusChip status={task.status} />
          <PriorityChip p={task.priority} />
        </div>
        {editing ? (
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        ) : (
          <SheetTitle className="font-display text-2xl">{task.title}</SheetTitle>
        )}
      </SheetHeader>
      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Descrição"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={draft.priority}
              onValueChange={(v) => setDraft({ ...draft, priority: v as Priority })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["alta", "media", "baixa"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker
              value={draft.due_date}
              onChange={(dueDate) => setDraft({ ...draft, due_date: dueDate })}
            />
          </div>
          <Select
            value={draft.assigned_to}
            onValueChange={(v) => setDraft({ ...draft, assigned_to: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              {people
                .filter((p) => p.role === "responsavel")
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button variant="gold" onClick={saveEdit}>
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        task.description && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
        )
      )}
      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Data</dt>
          <dd>{format(parseISO(task.due_date), "dd 'de' MMM yyyy", { locale: ptBR })}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Criada por</dt>
          <dd>{name(task.created_by)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Responsável</dt>
          <dd>{name(task.assigned_to)}</dd>
        </div>
        {task.status_changed_at && (
          <div>
            <dt className="text-xs text-muted-foreground">Atualizada em</dt>
            <dd>{format(parseISO(task.status_changed_at), "dd/MM HH:mm")}</dd>
          </div>
        )}
      </dl>

      {isCreator && !editing && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Editar tarefa
        </Button>
      )}

      {isAssignee && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Marcar tarefa</p>
          {task.status === "em_andamento" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="success" onClick={() => setStatus("concluida")}>
                <Check /> Concluída
              </Button>
              <Button variant="cancel" onClick={() => setStatus("cancelada")}>
                <X /> Não feita
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setStatus("em_andamento")}>
              Voltar para em andamento
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Comentários</p>
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum comentário.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2">
            <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {name(c.author_id)} · {format(parseISO(c.created_at), "dd/MM HH:mm")}
            </p>
          </div>
        ))}
        {isCreator && (
          <div className="space-y-2">
            <Textarea
              placeholder="Adicionar comentário..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button variant="gold" size="sm" onClick={addComment} disabled={!text.trim()}>
              Comentar
            </Button>
          </div>
        )}
      </div>

      {events.length > 0 && (
        <details className="rounded-lg border border-border p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" /> Histórico ({events.length})
          </summary>
          <div className="mt-3 space-y-2">
            {events.map((event) => (
              <div key={event.id} className="text-xs text-muted-foreground">
                {event.event_type === "criada"
                  ? "Tarefa criada"
                  : event.event_type === "comentario"
                    ? "Comentário adicionado"
                    : `Status alterado para ${event.new_status ? STATUS_LABEL[event.new_status] : "—"}`}{" "}
                · por {name(event.actor_id)} · {format(parseISO(event.created_at), "dd/MM HH:mm")}
              </div>
            ))}
          </div>
        </details>
      )}

      {isAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 /> Excluir tarefa
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                A exclusão ficará registrada no histórico. Informe o motivo para continuar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Motivo da exclusão (mínimo de 5 caracteres)"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteReason.trim().length < 5}
                onClick={remove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
