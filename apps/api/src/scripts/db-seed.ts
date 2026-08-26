import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runSeed() {
  const dbUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  console.log(`[DB Seed] Connecting to PostgreSQL...`);

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    const seedPath = path.resolve(__dirname, '../../../../infra/migrations/002_seed.sql');
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed file not found at ${seedPath}`);
    }

    const sql = fs.readFileSync(seedPath, 'utf8');
    console.log('[DB Seed] Executing 002_seed.sql...');
    await client.query(sql);

    console.log(
      '[DB Seed] Database seeded successfully with test organizations, users, and initial audit logs.',
    );
  } catch (error: any) {
    console.error('[DB Seed] Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  runSeed();
}
