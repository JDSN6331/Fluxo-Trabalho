import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { databaseClient, databaseKind, row } from "./database.server";

export const auth = betterAuth({
  database: databaseClient,
  secret:
    process.env["BETTER_AUTH_SECRET"] ?? "local-development-secret-change-before-production-123456",
  baseURL: process.env["BETTER_AUTH_URL"],
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      workflowRole: { type: "string", required: false, defaultValue: "pendente", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const result = await row<{ total: number | string }>(
            `SELECT COUNT(*) AS total FROM "user"`,
          );
          const first = Number(result?.total ?? 0) === 0;
          return {
            data: {
              ...user,
              role: first ? "admin" : "user",
              workflowRole: first ? "administrador" : "pendente",
            },
          };
        },
      },
    },
  },
  plugins: [admin(), tanstackStartCookies()],
  advanced: { database: { generateId: "uuid" } },
});

export { databaseKind };
