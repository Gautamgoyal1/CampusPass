import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      const { rows } = await client.query(
        'SELECT id FROM schema_migrations WHERE name = $1',
        [file]
      );

      if (rows.length === 0) {
        console.log(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`Successfully applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Migration failed in ${file}:`, err);
          throw err;
        }
      } else {
        console.log(`Migration already applied: ${file}`);
      }
    }
    console.log('All migrations applied successfully.');
  } finally {
    client.release();
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration failed:', err);
      pool.end();
      process.exit(1);
    });
}
