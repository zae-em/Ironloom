import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runMigration() {
  const dbUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  console.log(`[DB Migrate] Connecting to PostgreSQL at ${dbUrl.replace(/:[^:@]+@/, ':***@')}...`);

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('[DB Migrate] Connected successfully.');

    const migrationPath = path.resolve(
      __dirname,
      '../../../../infra/migrations/001_initial_schema.sql',
    );
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('[DB Migrate] Executing 001_initial_schema.sql...');
    await client.query(sql);

    console.log('[DB Migrate] Migration completed successfully.');
  } catch (error: any) {
    console.error('[DB Migrate] Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  runMigration();
}
