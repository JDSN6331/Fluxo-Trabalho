import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("password is known to be weak")) {
    return "Esta senha é muito fraca e fácil de adivinhar. Escolha uma senha diferente.";
  }
  if (normalized.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalized.includes("user already registered")) {
    return "Já existe uma conta cadastrada com este e-mail.";
  }
  if (
    normalized.includes("unable to validate email address") ||
    normalized.includes("invalid email")
  ) {
    return "Informe um endereço de e-mail válido.";
  }
  if (normalized.includes("signup is disabled")) {
    return "O cadastro de novos usuários está desativado.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  return "Não foi possível concluir a autenticação. Verifique os dados e tente novamente.";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Fluxo" },
      { name: "description", content: "Acesse sua conta no Fluxo para gerenciar tarefas." },
      { property: "og:title", content: "Entrar — Fluxo" },
      { property: "og:description", content: "Acesse sua conta no Fluxo para gerenciar tarefas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.session) navigate({ to: "/tarefas", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw error;
        navigate({ to: "/tarefas" });
      } else {
        const { data, error } = await authClient.signUp.email({ email, password, name });
        if (error) throw error;
        if (data) navigate({ to: "/tarefas" });
        else setSent(true);
      }
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="notepad flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 block text-center font-display text-2xl font-bold">
          <span className="text-gold">Fluxo</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          {sent ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold">Confirme seu e-mail</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enviamos um link para {email}. Clique nele para ativar sua conta.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-2xl font-semibold">
                {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
              </h2>
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    O administrador definirá seu papel após o cadastro.
                  </p>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <PasswordInput
                  id="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                >
                  {mode === "login" ? "Cadastre-se" : "Entrar"}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
