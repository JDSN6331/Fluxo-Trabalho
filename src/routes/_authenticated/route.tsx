import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { CalendarDays, LogOut, NotebookPen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { meQuery } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);

  // live updates when tasks change
  useEffect(() => {
    const ch = supabase
      .channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link to="/tarefas" className="font-display text-lg font-bold"><span className="text-gold">Fluxo</span></Link>
          <nav className="flex gap-1">
            <Link to="/tarefas" className={nav} activeProps={{ className: "bg-accent text-foreground" }}>
              <NotebookPen className="h-4 w-4" /> Tarefas
            </Link>
            <Link to="/calendario" className={nav} activeProps={{ className: "bg-accent text-foreground" }}>
              <CalendarDays className="h-4 w-4" /> Calendário
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {me && (
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight">{me.name}</div>
                <div className="text-xs text-primary">{me.role === "solicitante" ? "Solicitante" : "Responsável"}</div>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair"><LogOut /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
