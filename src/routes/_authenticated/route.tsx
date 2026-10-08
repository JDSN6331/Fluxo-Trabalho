import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarDays, LogOut, NotebookPen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { meQuery } from "@/lib/tasks";
import { getMe } from "@/lib/workflow.functions";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await authClient.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav =
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link to="/tarefas" className="font-display text-lg font-bold">
            <span className="text-gold">Fluxo</span>
          </Link>
          <nav className="flex gap-1">
            <Link
              to="/tarefas"
              className={nav}
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              <NotebookPen className="h-4 w-4" /> Tarefas
            </Link>
            <Link
              to="/analises"
              className={nav}
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">Análises</span>
            </Link>
            <Link
              to="/calendario"
              className={nav}
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              <CalendarDays className="h-4 w-4" /> Calendário
            </Link>
            {me?.role === "administrador" && (
              <Link
                to="/administracao"
                className={nav}
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <Settings className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Administração</span>
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {me && (
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight">{me.name}</div>
                <div className="text-xs text-primary">
                  {
                    {
                      solicitante: "Solicitante",
                      responsavel: "Responsável",
                      administrador: "Administrador",
                      pendente: "Aguardando liberação",
                    }[me.role]
                  }
                </div>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
