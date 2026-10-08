import nodemailer from "nodemailer";
import Database from "better-sqlite3";
import pg from "pg";
const postgres = process.env.DATABASE_URL?.startsWith("postgres");
const client = postgres
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : new Database(process.env.LOCAL_DATABASE_PATH ?? "./data/fluxo.sqlite");
const pgSql = (sql) => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};
const query = async (sql, params = []) =>
  postgres ? (await client.query(pgSql(sql), params)).rows : client.prepare(sql).all(...params);
const run = async (sql, params = []) => {
  return postgres ? client.query(pgSql(sql), params) : client.prepare(sql).run(...params);
};
const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(", ")}`);
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
const labels = {
  criada: "Nova tarefa",
  status_alterado: "Tarefa atualizada",
  comentario: "Novo comentário",
  excluida: "Tarefa excluída",
  redefinir_senha: "Redefinição de senha",
};
async function batch() {
  const items = await query(
    "SELECT * FROM notification_outbox WHERE processed_at IS NULL AND attempts < 5 ORDER BY created_at LIMIT 20",
  );
  for (const item of items) {
    const p = JSON.parse(item.payload);
    const subject = labels[item.event_type] ?? "Notificação do Fluxo";
    const text =
      item.event_type === "redefinir_senha"
        ? `Olá, ${p.name}. Use este link para criar uma nova senha (válido por uma hora): ${p.link}`
        : `${subject}: ${p.title}\nStatus: ${p.status ?? "—"}\nPrazo: ${p.due_date ?? "—"}`;
    try {
      await transport.sendMail({
        from: process.env.EMAIL_FROM,
        to: item.recipient_email,
        subject,
        text,
      });
      await run(
        "UPDATE notification_outbox SET processed_at=?,attempts=attempts+1,last_error=NULL WHERE id=?",
        [new Date().toISOString(), item.id],
      );
    } catch (error) {
      await run("UPDATE notification_outbox SET attempts=attempts+1,last_error=? WHERE id=?", [
        String(error).slice(0, 1000),
        item.id,
      ]);
    }
  }
}
await transport.verify();
console.log("Worker de e-mail iniciado");
while (true) {
  try {
    await batch();
  } catch (error) {
    console.error(error);
  }
  await new Promise((r) => setTimeout(r, Number(process.env.EMAIL_POLL_INTERVAL_MS ?? 15000)));
}
