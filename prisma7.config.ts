import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * As migrations rodam com o usuário ADMINISTRADOR (DIRECT_DATABASE_URL), porque
 * precisam criar tabelas e policies. A aplicação conecta com o papel restrito
 * (DATABASE_URL), para quem o Row Level Security de fato vale.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"],
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
