import { buildApp } from './app.js';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.port, host: env.host });
  app.log.info(`SunPower API ready at http://localhost:${env.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
