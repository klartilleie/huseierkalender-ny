import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Dette gjør at appen kan snakke med både Render (port 5432) og Neon (port 443)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Påkrevd for sikre tilkoblinger på Render/Neon
  }
});

export const db = drizzle(pool, { schema });