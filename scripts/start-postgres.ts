import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';

async function startLocalPostgres() {
  console.log('🐘 Initializing Embedded PostgreSQL Cluster for Shiraz Pro Farm...');
  const dataDir = path.join(process.cwd(), '.data', 'postgres_cluster');

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 5432,
    persistent: true,
    autoRehydrateSymlinks: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  try {
    console.log(`📁 Cluster directory: ${dataDir}`);
    const fs = require('fs');
    const isAlreadyInitialized = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
    if (!isAlreadyInitialized) {
      console.log('🌱 First-time initialization of PostgreSQL cluster...');
      await pg.initialise();
    } else {
      console.log('⚡ Cluster already initialized. Skipping initdb...');
    }
    console.log('🚀 Starting PostgreSQL daemon on port 5432...');
    await pg.start();

    console.log('📦 Ensuring "profarm_db" database exists...');
    try {
      await pg.createDatabase('profarm_db');
      console.log('✅ Database "profarm_db" created successfully!');
    } catch (e: any) {
      if (e?.message?.includes('already exists') || e?.code === '42P04') {
        console.log('ℹ️ Database "profarm_db" already exists.');
      } else {
        console.log('Database init status:', e?.message || e);
      }
    }

    console.log('\n======================================================');
    console.log('🎉 PostgreSQL is ONLINE and LISTENING on localhost:5432');
    console.log('   Connection URL: postgresql://postgres:postgres@localhost:5432/profarm_db?schema=public');
    console.log('======================================================\n');

    // Keep process alive indefinitely
    process.on('SIGINT', async () => {
      console.log('Shutting down PostgreSQL...');
      await pg.stop();
      process.exit(0);
    });

    setInterval(() => {}, 10000);
  } catch (err) {
    console.error('❌ Failed starting Embedded Postgres:', err);
    process.exit(1);
  }
}

startLocalPostgres();
