import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { audit } from '../lib/audit.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['DIRECTOR', 'SALES', 'TECHNICIAN', 'WAREHOUSE', 'SUPPORT']),
  phone: z.string().optional(),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  active: true,
  createdAt: true,
} as const;

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const body = loginSchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

      if (!user || !user.active) {
        throw new AppError(401, 'Incorrect email or password', 'INVALID_CREDENTIALS');
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        throw new AppError(401, 'Incorrect email or password', 'INVALID_CREDENTIALS');
      }

      const payload = {
        sub: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      };

      const token = await app.jwt.sign(payload, { expiresIn: '12h' });
      await audit(user.id, 'LOGIN', 'User', user.id);

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
        },
      };
    },
  );

  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: userSelect,
    });
    if (!user) throw new AppError(401, 'Session expired', 'UNAUTHORIZED');
    return user;
  });

  app.get('/users', { preHandler: [app.authenticate] }, async (request) => {
    const query = z
      .object({ role: z.enum(['DIRECTOR', 'SALES', 'TECHNICIAN', 'WAREHOUSE', 'SUPPORT']).optional() })
      .parse(request.query);
    return prisma.user.findMany({
      where: { active: true, ...(query.role ? { role: query.role } : {}) },
      select: userSelect,
      orderBy: { name: 'asc' },
    });
  });

  app.post(
    '/users',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR')] },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (exists) throw new AppError(409, 'A user with this email already exists', 'EMAIL_TAKEN');

      const passwordHash = await bcrypt.hash(body.password, 10);
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash,
          role: body.role,
          phone: body.phone,
        },
        select: userSelect,
      });

      await audit(request.user.sub, 'USER_CREATED', 'User', user.id, { role: user.role });
      return reply.code(201).send(user);
    },
  );
};
