// Push database schema to the database
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';

console.log('Starting database schema push...');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Create a Postgres connection
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

// Push the schema to the database
console.log('Pushing schema to database...');

try {
  db.execute(sql`
    DO $$ 
    BEGIN
      -- Create case tables if they don't exist
      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        admin_id INTEGER REFERENCES users(id),
        case_number VARCHAR(20) NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        is_closed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMP,
        closed_by_id INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS case_messages (
        id SERIAL PRIMARY KEY,
        case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        target_user_id INTEGER REFERENCES users(id),
        message TEXT NOT NULL,
        is_admin_message BOOLEAN NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        attachment_url TEXT
      );

      CREATE TABLE IF NOT EXISTS case_attachments (
        id SERIAL PRIMARY KEY,
        case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        message_id INTEGER REFERENCES case_messages(id) ON DELETE SET NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_url TEXT NOT NULL,
        uploader_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

    END $$;
  `);
  console.log('Schema push complete!');
} catch (error) {
  console.error('Error pushing schema:', error);
  process.exit(1);
} finally {
  await sql.end();
  process.exit(0);
}