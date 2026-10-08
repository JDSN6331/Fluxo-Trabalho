import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fluxo — Tarefas simples e elegantes" },
      { name: "description", content: "Registre tarefas, delegue para sua equipe e acompanhe tudo no calendário." },
      { property: "og:title", content: "Fluxo — Tarefas simples e elegantes" },
      { property: "og:description", content: "Registre tarefas, delegue para sua equipe e acompanhe tudo no calendário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="notepad min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-bold">
          <span className="text-gold">Fluxo</span>
        </span>
        <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center">
        <p className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">Gestão de fluxo de tarefas</p>
        <h1 className="font-display text-5xl font-bold leading-tight md:text-7xl">
          Anote. Delegue.<br /><span className="text-gold">Conclua.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Um bloco de notas compartilhado para sua equipe — com prioridades, status e calendário.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Button asChild variant="gold" size="lg"><Link to="/auth">Começar agora</Link></Button>
        </div>
        <div className="mt-24 grid gap-4 text-left md:grid-cols-3">
          {[
            { icon: NotebookPen, t: "Estilo bloco de notas", d: "Registre tarefas em segundos, sem formulários complicados." },
            { icon: CheckCircle2, t: "Status claros", d: "Em andamento, concluída ou cancelada — com um clique." },
            { icon: CalendarDays, t: "Calendário", d: "Visualize por mês, semana ou dia." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
              <Icon className="mb-4 h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
