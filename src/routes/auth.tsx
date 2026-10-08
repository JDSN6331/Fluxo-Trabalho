import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/tasks";

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
  const [role, setRole] = useState<Role>("solicitante");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/tarefas", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/tarefas" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/tarefas", data: { full_name: name, role } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/tarefas" });
        else setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
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
              <p className="mt-2 text-sm text-muted-foreground">Enviamos um link para {email}. Clique nele para ativar sua conta.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-2xl font-semibold">{mode === "login" ? "Bem-vindo de volta" : "Criar conta"}</h2>
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Seu papel</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ["solicitante", "Solicitante", "Cria tarefas"],
                        ["responsavel", "Responsável", "Executa tarefas"],
                      ] as const).map(([v, l, d]) => (
                        <button
                          type="button"
                          key={v}
                          onClick={() => setRole(v)}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            role === v ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                          )}
                        >
                          <div className="text-sm font-medium">{l}</div>
                          <div className="text-xs text-muted-foreground">{d}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
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
