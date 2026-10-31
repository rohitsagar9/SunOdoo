import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import type { Role } from '@prisma/client';
import { env, allowedOrigins } from './lib/env.js';
import { AppError } from './lib/errors.js';
import { prisma } from './lib/prisma.js';
import { apiRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger:
      env.nodeEnv === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }
        : true,
    trustProxy: true,
    bodyLimit: 12 * 1024 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Too many requests. Please slow down.',
      code: 'RATE_LIMITED',
    }),
  });

  await app.register(jwt, {
    secret: env.jwtSecret,
    sign: { expiresIn: '12h' },
  });

  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  });

  fs.mkdirSync(env.uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: env.uploadDir,
    prefix: '/uploads/',
    cacheControl: true,
    maxAge: '7d',
  });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({
        error: 'Please sign in again',
        code: 'UNAUTHORIZED',
      });
    }
  });

  app.decorate('authorize', (...roles: Role[]) => {
    return async (request, reply) => {
      if (!request.user || !roles.includes(request.user.role)) {
        return reply.code(403).send({
          error: 'You do not have access to this area',
          code: 'FORBIDDEN',
        });
      }
    };
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const prismaCode = (error as { code?: string }).code;
    if (prismaCode === 'P2002') {
      return reply.code(409).send({
        error: 'This record already exists',
        code: 'DUPLICATE_RECORD',
      });
    }
    if (prismaCode === 'P2025') {
      return reply.code(404).send({
        error: 'The requested record was not found',
        code: 'NOT_FOUND',
      });
    }

    if ((error as { validation?: unknown }).validation) {
      const message = error instanceof Error ? error.message : 'Invalid request';
      return reply.code(400).send({
        error: message,
        code: 'INVALID_REQUEST',
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: 'Something went wrong on our side. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: `Route ${request.method} ${request.url} not found`,
      code: 'ROUTE_NOT_FOUND',
    });
  });

  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      service: 'sunpower-api',
      time: new Date().toISOString(),
    };
  });

  app.get('/', async () => ({
    name: 'SunPower Solutions API',
    version: '1.0.0',
    docs: '/api/health',
    roles: ['DIRECTOR', 'SALES', 'TECHNICIAN', 'WAREHOUSE', 'SUPPORT'],
  }));

  await app.register(apiRoutes, { prefix: '/api' });

  return app;
}
