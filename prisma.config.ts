import "dotenv/config";
import { defineConfig } from "prisma/config";

const isGenerateCommand = process.argv.includes("generate");
const needsDatabase = process.argv.some((argument) => ["migrate", "studio", "db"].includes(argument));
const databaseUrl = process.env.DATABASE_URL
  ?? (isGenerateCommand ? "postgresql://postgres:postgres@localhost:5432/trading_journal" : undefined);

if (needsDatabase && !databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma migrate commands. Copy .env.example to .env and configure PostgreSQL.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl ?? "postgresql://postgres:postgres@localhost:5432/trading_journal",
  },
});
