import '../../../server/polyfill';
import { AppDataSource } from './data-source';

async function runMigrations() {
  const action = process.argv[2] || 'up';
  console.log(`[DB Migrate] Connecting to database (${AppDataSource.options.type})...`);

  await AppDataSource.initialize();

  try {
    if (action === 'up') {
      console.log('[DB Migrate] Executing pending migrations...');
      const migrations = await AppDataSource.runMigrations();
      console.log(`[DB Migrate] Successfully executed ${migrations.length} migrations.`);
    } else if (action === 'down') {
      console.log('[DB Migrate] Rolling back last migration...');
      await AppDataSource.undoLastMigration();
      console.log('[DB Migrate] Rollback completed.');
    } else if (action === 'status') {
      const hasPending = await AppDataSource.showMigrations();
      console.log(`[DB Migrate] Pending migrations exist: ${hasPending}`);
    } else {
      console.warn(`[DB Migrate] Unknown action: ${action}. Use 'up', 'down', or 'status'.`);
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runMigrations().catch((err) => {
  console.error('[DB Migrate] Error:', err);
  process.exit(1);
});
