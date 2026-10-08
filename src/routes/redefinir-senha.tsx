import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { resetPassword } from "@/lib/workflow.functions";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s["token"] === "string" ? s["token"] : "",
  }),
  component: ResetPage,
});
function ResetPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ data: { token, password } });
      toast.success("Senha redefinida. Entre novamente.");
      navigate({ to: "/auth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível redefinir a senha");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="notepad flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-8"
      >
        <h1 className="font-display text-2xl font-bold">Criar nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Informe uma senha segura com pelo menos 8 caracteres.
        </p>
        <PasswordInput
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha"
        />
        <PasswordInput
          minLength={8}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmar senha"
        />
        <Button className="w-full" disabled={loading || !token}>
          {loading ? "Salvando…" : "Redefinir senha"}
        </Button>
      </form>
    </div>
  );
}
