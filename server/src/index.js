const http = require('http');
const { connectDatabase } = require('./config/db');
const { env } = require('./config/env');
const { buildApp } = require('./app');
const { buildSocketServer } = require('./socket');

async function bootstrap() {
  await connectDatabase();
  const app = buildApp();
  const server = http.createServer(app);
  await buildSocketServer(server);

  server.listen(env.port, () => {
    console.log(`Ludo server running on :${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
