# Flow Master

Bom dia, tudo bem?

Preciso criar um aplicativo web de gestão de fluxo de tarefas com as seguintes características:

Algo simples

Bonito, elegante e profissional

Fluxo de trabalho simples estilo bloco de notas

Modo escuro

Com calendário

A ideia é simples: um usuário irá registrar uma tarefa. Outro usuário irá receber essa tarefa e marcar ela como concluída ou não feita/cancelada (a tarefa já virá com o status em andamento). Além disso, o usuário que registrar a tarefa, terá a opção de colocar uma prioridade (alta, média e baixa).

No calendário, irá mostrar todas as tarefas já registradas e seu status. O calendário terá a possibilidade de visualização mensal, semanal e diária.

O usuário que criar a tarefa terá a opção de inserir comentários. Já o usuário que irá registrar a tarefa como concluída ou cancelada apenas irá flagar.

Conseguiu entender o que preciso?

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e1f06ddf-ccaa-4be5-9eb6-73ccdd7d5eba).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Banco local (SQLite)

O desenvolvimento local não depende de Supabase nem de PostgreSQL. Por padrão, a aplicação cria automaticamente `data/fluxo.sqlite` no primeiro acesso.

```env
LOCAL_DATABASE_PATH=./data/fluxo.sqlite
BETTER_AUTH_URL=http://localhost:4175
BETTER_AUTH_SECRET=troque-por-um-segredo-local-com-32-caracteres
```

Execute `npm install` e `npm run dev -- --port 4175`. O primeiro usuário cadastrado recebe o papel de administrador; os seguintes ficam pendentes até a definição de papel.

## Produção no Easypanel (PostgreSQL)

O projeto inclui um `Dockerfile` com dois alvos:

- `app`: aplicação web, porta `3000`;
- `email-worker`: processamento confiável da fila de e-mails.

Crie dois serviços a partir do mesmo repositório. No serviço web use o alvo `app`; no worker use `email-worker`. Os dois serviços usam o mesmo `DATABASE_URL` PostgreSQL.

No worker configure:

```env
DATABASE_URL=postgresql://usuario:senha@postgres:5432/fluxo
BETTER_AUTH_URL=https://fluxo.seudominio.com
BETTER_AUTH_SECRET=segredo-aleatorio-com-pelo-menos-32-caracteres
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=senha
EMAIL_FROM=Fluxo <tarefas@seudominio.com>
APP_URL=https://fluxo.seudominio.com
EMAIL_POLL_INTERVAL_MS=15000
```

As tabelas de autenticação e da aplicação são criadas automaticamente na inicialização. Use apenas uma instância do worker para evitar processamento simultâneo da mesma mensagem. O primeiro usuário cadastrado será administrador; os demais ficarão pendentes até a liberação de um papel.
