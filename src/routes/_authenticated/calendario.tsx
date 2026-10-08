import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { peopleQuery, tasksQuery, STATUS_DOT, STATUS_LABEL, type Task } from "@/lib/tasks";
import { PriorityChip, StatusChip, TaskDetail } from "@/components/TaskDetail";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Fluxo" },
      { name: "description", content: "Todas as tarefas no calendário mensal, semanal e diário." },
      { property: "og:title", content: "Calendário — Fluxo" },
      { property: "og:description", content: "Todas as tarefas no calendário mensal, semanal e diário." },
    ],
  }),
  component: CalendarPage,
});

type View = "mes" | "semana" | "dia";
const WEEK = { weekStartsOn: 0 as const, locale: ptBR };

function CalendarPage() {
  const { data: tasks = [] } = useQuery(tasksQuery);
  const { data: people = [] } = useQuery(peopleQuery);
  const [view, setView] = useState<View>("mes");
  const [date, setDate] = useState(new Date());
  const [selected, setSelected] = useState<Task | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) m.set(t.due_date, [...(m.get(t.due_date) ?? []), t]);
    return m;
  }, [tasks]);
  const dayTasks = (d: Date) => byDay.get(format(d, "yyyy-MM-dd")) ?? [];
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";

  const move = (n: number) =>
    setDate((d) => (view === "mes" ? addMonths(d, n) : view === "semana" ? addWeeks(d, n) : addDays(d, n)));

  const title =
    view === "mes"
      ? format(date, "MMMM yyyy", { locale: ptBR })
      : view === "semana"
        ? `${format(startOfWeek(date, WEEK), "d MMM", { locale: ptBR })} – ${format(endOfWeek(date, WEEK), "d MMM yyyy", { locale: ptBR })}`
        : format(date, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold capitalize">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {([["mes", "Mês"], ["semana", "Semana"], ["dia", "Dia"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {l}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft /></Button>
          <Button variant="outline" onClick={() => setDate(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Próximo"><ChevronRight /></Button>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        {(["em_andamento", "concluida", "cancelada"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />{STATUS_LABEL[s]}</span>
        ))}
      </div>

      {view === "mes" && <MonthView date={date} dayTasks={dayTasks} onPick={setSelected} onDay={(d) => { setDate(d); setView("dia"); }} />}
      {view === "semana" && <WeekView date={date} dayTasks={dayTasks} onPick={setSelected} onDay={(d) => { setDate(d); setView("dia"); }} />}
      {view === "dia" && (
        <div className="rounded-xl border border-border bg-card">
          {dayTasks(date).length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma tarefa neste dia.</p>}
          {dayTasks(date).map((t) => (
            <button key={t.id} onClick={() => setSelected(t)} className="flex w-full items-center gap-4 border-b border-border/50 px-5 py-4 text-left last:border-0 hover:bg-accent/60">
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[t.status])} />
              <div className="flex-1">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">{name(t.created_by)} → {name(t.assigned_to)}</div>
              </div>
              <PriorityChip p={t.priority} />
              <StatusChip status={t.status} />
            </button>
          ))}
        </div>
      )}

      <TaskDetail task={selected ? tasks.find((t) => t.id === selected.id) ?? null : null} onClose={() => setSelected(null)} />
    </div>
  );
}

type ViewProps = { date: Date; dayTasks: (d: Date) => Task[]; onPick: (t: Task) => void; onDay: (d: Date) => void };

function Pill({ t, onPick }: { t: Task; onPick: (t: Task) => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onPick(t); }}
      className="flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-xs hover:bg-accent">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[t.status])} />
      <span className={cn("truncate", t.status !== "em_andamento" && "text-muted-foreground line-through")}>{t.title}</span>
    </button>
  );
}

function Weekdays() {
  return (
    <div className="grid grid-cols-7 border-b border-border">
      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
        <div key={d} className="px-2 py-2 text-xs uppercase tracking-wider text-muted-foreground">{d}</div>
      ))}
    </div>
  );
}

function MonthView({ date, dayTasks, onPick, onDay }: ViewProps) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(date), WEEK), end: endOfWeek(endOfMonth(date), WEEK) });
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Weekdays />
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const ts = dayTasks(d);
          return (
            <div key={d.toISOString()} onClick={() => onDay(d)}
              className={cn("min-h-28 cursor-pointer border-b border-r border-border/60 p-1.5 transition-colors hover:bg-accent/30 [&:nth-child(7n)]:border-r-0", !isSameMonth(d, date) && "opacity-40")}>
              <div className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday(d) && "bg-gradient-gold font-semibold text-primary-foreground")}>
                {format(d, "d")}
              </div>
              {ts.slice(0, 3).map((t) => <Pill key={t.id} t={t} onPick={onPick} />)}
              {ts.length > 3 && <div className="px-1.5 text-xs text-primary">+{ts.length - 3} mais</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ date, dayTasks, onPick, onDay }: ViewProps) {
  const days = eachDayOfInterval({ start: startOfWeek(date, WEEK), end: endOfWeek(date, WEEK) });
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <div key={d.toISOString()} className="min-h-96 border-r border-border/60 last:border-r-0">
            <button onClick={() => onDay(d)} className="w-full border-b border-border p-3 text-left hover:bg-accent/30">
              <div className="text-xs uppercase text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</div>
              <div className={cn("font-display text-xl font-semibold", isToday(d) && "text-gold", isSameDay(d, date) && "underline decoration-primary")}>{format(d, "d")}</div>
            </button>
            <div className="space-y-1 p-1.5">{dayTasks(d).map((t) => <Pill key={t.id} t={t} onPick={onPick} />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
