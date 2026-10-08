import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, History, KeyRound, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getMe, createPasswordResetLink, listTaskDeletions } from "@/lib/workflow.functions";
import { meQuery, peopleQuery, type Role } from "@/lib/tasks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/administracao")({
  beforeLoad: async () => {
    const me = await getMe();
    if (me?.role !== "administrador") throw redirect({ to: "/tarefas" });
  },
  head: () => ({ meta: [{ title: "Administração — Fluxo" }] }),
  component: AdministrationPage,
});
const LABEL: Record<Role, string> = {
  administrador: "Administrador",
  solicitante: "Solicitante",
  responsavel: "Responsável",
  pendente: "Pendente",
};

function AdministrationPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: people = [], isLoading, error } = useQuery(peopleQuery);
  const { data: deletions = [] } = useQuery({
    queryKey: ["task-deletions"],
    queryFn: () => listTaskDeletions(),
  });
  const [editing, setEditing] = useState<(typeof people)[number] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [resetLink, setResetLink] = useState("");
  async function changeRole(userId: string, role: Role) {
    const data =
      role === "administrador"
        ? { role: "admin", workflowRole: "administrador" }
        : { role: "user", workflowRole: role };
    const result = await authClient.admin.updateUser({ userId, data });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  async function save() {
    if (!editing) return;
    const result = await authClient.admin.updateUser({ userId: editing.id, data: { name, email } });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Usuário atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir este usuário permanentemente?")) return;
    const result = await authClient.admin.removeUser({ userId: id });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Usuário excluído");
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  async function reset(id: string) {
    try {
      const result = await createPasswordResetLink({
        data: { userId: id, baseUrl: window.location.origin },
      });
      setResetLink(result.link);
      toast.success("Link gerado e incluído na fila de e-mail");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link");
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm text-primary">
          <ShieldCheck className="h-4 w-4" /> Acesso administrativo
        </p>
        <h1 className="font-display text-4xl font-bold">Usuários e papéis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Edite cadastros, papéis, redefina senhas ou exclua usuários.
        </p>
      </div>
      {isLoading && <p>Carregando usuários…</p>}
      {error && <p className="text-destructive">Não foi possível carregar os usuários.</p>}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {people.map((person) => (
          <div
            key={person.id}
            className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4 last:border-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Users className="h-4 w-4" />
            </div>
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setEditing(person);
                setName(person.full_name);
                setEmail(person.email);
              }}
            >
              <div className="truncate font-medium">{person.full_name}</div>
              <div className="truncate text-sm text-muted-foreground">{person.email}</div>
            </button>
            <Select
              value={person.role ?? "pendente"}
              disabled={person.id === me?.id}
              onValueChange={(v) => changeRole(person.id, v as Role)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["solicitante", "responsavel", "administrador"] as Role[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {LABEL[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => reset(person.id)}
              aria-label="Redefinir senha"
            >
              <KeyRound />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={person.id === me?.id}
              onClick={() => remove(person.id)}
              aria-label="Excluir usuário"
            >
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <History className="h-5 w-5 text-primary" /> Histórico de exclusões
          </h2>
          <p className="text-sm text-muted-foreground">
            Registro permanente das tarefas excluídas pelos administradores.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {deletions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma tarefa foi excluída.</p>
          ) : (
            deletions.map((deletion) => (
              <div
                key={deletion.id}
                className="grid gap-2 border-b border-border/60 p-4 last:border-0 md:grid-cols-[1fr_1fr_2fr_auto] md:items-center"
              >
                <div>
                  <p className="text-xs text-muted-foreground">Tarefa</p>
                  <p className="font-medium">{deletion.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Excluída por</p>
                  <p className="text-sm">{deletion.deleted_by_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="whitespace-pre-wrap text-sm">{deletion.reason}</p>
                </div>
                <time className="text-sm text-muted-foreground" dateTime={deletion.deleted_at}>
                  {format(parseISO(deletion.deleted_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </time>
              </div>
            ))
          )}
        </div>
      </section>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize o nome e o e-mail.</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
          />
          <Button onClick={save}>Salvar</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!resetLink} onOpenChange={(o) => !o && setResetLink("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de redefinição</DialogTitle>
            <DialogDescription>Válido por uma hora e enviado também por e-mail.</DialogDescription>
          </DialogHeader>
          <Input readOnly value={resetLink} />
          <Button
            onClick={() => {
              navigator.clipboard.writeText(resetLink);
              toast.success("Link copiado");
            }}
          >
            <Copy /> Copiar link
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
