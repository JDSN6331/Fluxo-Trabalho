import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarDays, LogOut, NotebookPen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { meQuery } from "@/lib/tasks";
import { getMe } from "@/lib/workflow.functions";
import { authClient } from "@/lib/auth-client";
import { PwaInstallButton } from "@/components/PwaInstall";

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
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:gap-6 md:px-6">
          <Link to="/tarefas" className="font-display text-lg font-bold">
            <span className="text-gold">Fluxo</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
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
            <PwaInstallButton />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 pb-28 md:px-6 md:py-8 md:pb-8">
        <Outlet />
      </main>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        <Link
          to="/tarefas"
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] text-muted-foreground"
          activeProps={{ className: "bg-accent text-primary" }}
        >
          <NotebookPen className="h-5 w-5" /> <span>Tarefas</span>
        </Link>
        <Link
          to="/analises"
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] text-muted-foreground"
          activeProps={{ className: "bg-accent text-primary" }}
        >
          <BarChart3 className="h-5 w-5" /> <span>Análises</span>
        </Link>
        <Link
          to="/calendario"
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] text-muted-foreground"
          activeProps={{ className: "bg-accent text-primary" }}
        >
          <CalendarDays className="h-5 w-5" /> <span>Calendário</span>
        </Link>
        {me?.role === "administrador" && (
          <Link
            to="/administracao"
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "bg-accent text-primary" }}
          >
            <Settings className="h-5 w-5" /> <span>Admin</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
