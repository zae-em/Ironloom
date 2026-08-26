import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runReset() {
  const dbUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  console.log(`[DB Reset] Connecting to PostgreSQL...`);

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('[DB Reset] Dropping existing public schema tables...');
    await client.query(`
      DROP TABLE IF EXISTS public.audit_log CASCADE;
      DROP TABLE IF EXISTS public.projects CASCADE;
      DROP TABLE IF EXISTS public.organization_members CASCADE;
      DROP TABLE IF EXISTS public.organizations CASCADE;
      DROP TABLE IF EXISTS public.users CASCADE;
    `);

    console.log('[DB Reset] Re-applying schema migration...');
    const migrationPath = path.resolve(
      __dirname,
      '../../../../infra/migrations/001_initial_schema.sql',
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(migrationSql);

    console.log('[DB Reset] Re-applying seed data...');
    const seedPath = path.resolve(__dirname, '../../../../infra/migrations/002_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);

    console.log('[DB Reset] Database reset and reseeded successfully.');
  } catch (error: any) {
    console.error('[DB Reset] Reset failed:', error.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  runReset();
}
