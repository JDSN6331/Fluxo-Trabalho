import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { meQuery, peopleQuery, tasksQuery, STATUS_DOT, PRIORITY_LABEL, type Priority, type Status, type Task } from "@/lib/tasks";
import { PriorityChip, StatusChip, TaskDetail } from "@/components/TaskDetail";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Fluxo" },
      { name: "description", content: "Seu bloco de notas de tarefas." },
      { property: "og:title", content: "Tarefas — Fluxo" },
      { property: "og:description", content: "Seu bloco de notas de tarefas." },
    ],
  }),
  component: TasksPage,
});

const FILTERS: { v: Status | "todas"; l: string }[] = [
  { v: "todas", l: "Todas" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "concluida", l: "Concluídas" },
  { v: "cancelada", l: "Canceladas" },
];

function TasksPage() {
  const { data: me } = useQuery(meQuery);
  const { data: tasks = [] } = useQuery(tasksQuery);
  const [filter, setFilter] = useState<Status | "todas">("em_andamento");
  const [selected, setSelected] = useState<Task | null>(null);

  const mine = tasks.filter((t) => t.created_by === me?.id || t.assigned_to === me?.id);
  const list = mine.filter((t) => filter === "todas" || t.status === filter);
  const count = (s: Status) => mine.filter((t) => t.status === s).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          <h1 className="font-display text-4xl font-bold">
            {me?.role === "responsavel" ? "Tarefas recebidas" : "Minhas tarefas"}
          </h1>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat n={count("em_andamento")} l="Em andamento" dot={STATUS_DOT.em_andamento} />
          <Stat n={count("concluida")} l="Concluídas" dot={STATUS_DOT.concluida} />
          <Stat n={count("cancelada")} l="Canceladas" dot={STATUS_DOT.cancelada} />
        </div>
      </div>

      {me?.role === "solicitante" && <QuickAdd meId={me.id} />}

      <div className="flex gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition-colors",
              filter === f.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="notepad overflow-hidden rounded-xl border border-border bg-card">
        {list.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">Nada por aqui.</p>}
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="flex h-14 w-full items-center gap-4 border-b border-border/50 px-5 text-left transition-colors last:border-0 hover:bg-accent/60"
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[t.status])} />
            <span className={cn("flex-1 truncate", t.status !== "em_andamento" && "text-muted-foreground line-through decoration-muted-foreground/50")}>
              {t.title}
            </span>
            <span className="hidden sm:block"><PriorityChip p={t.priority} /></span>
            <span className="hidden md:block"><StatusChip status={t.status} /></span>
            <span className="w-16 text-right text-xs text-muted-foreground">{format(parseISO(t.due_date), "dd MMM", { locale: ptBR })}</span>
          </button>
        ))}
      </div>

      <TaskDetail task={selected ? tasks.find((t) => t.id === selected.id) ?? null : null} onClose={() => setSelected(null)} />
    </div>
  );
}

function Stat({ n, l, dot }: { n: number; l: string; dot: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold">{n}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", dot)} />{l}</div>
    </div>
  );
}

function QuickAdd({ meId }: { meId: string }) {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery(peopleQuery);
  const assignees = people.filter((p) => p.role === "responsavel");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [assignedTo, setAssignedTo] = useState("");
  const [due, setDue] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!assignedTo) { toast.error("Escolha um responsável"); return; }
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), description, priority, assigned_to: assignedTo, created_by: meId, due_date: due,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarefa registrada");
    setTitle(""); setDescription(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-border bg-card p-4 shadow-elegant">
      <div className="flex items-center gap-3">
        <Plus className="h-5 w-5 text-primary" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Escreva uma nova tarefa..."
          className="flex-1 bg-transparent font-display text-lg outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <Textarea placeholder="Detalhes (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder={assignees.length ? "Responsável" : "Nenhum responsável cadastrado"} /></SelectTrigger>
              <SelectContent>{assignees.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["alta", "media", "baixa"] as Priority[]).map((p) => <SelectItem key={p} value={p}>Prioridade {PRIORITY_LABEL[p].toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="gold" disabled={saving || !title.trim()}>Registrar</Button>
          </div>
        </div>
      )}
    </form>
  );
}
