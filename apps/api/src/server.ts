import { createApp } from './app.js';
const port = Number(process.env.PORT ?? 4180);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('PORT must be an integer from 1024 to 65535');
const app = createApp({ dbPath: process.env.ORBIT_DB_PATH ?? '.local/orbit.sqlite', logger: true });
await app.listen({ host: '127.0.0.1', port });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close();
  });
