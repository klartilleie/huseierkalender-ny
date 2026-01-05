import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Add sslmode=require if not already present (required for Render)
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl.includes('sslmode=')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
