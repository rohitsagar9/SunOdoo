import type { Role } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
    authorize: (
      ...roles: Role[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  }

  interface FastifyRequest {
    user: {
      sub: string;
      role: Role;
      name: string;
      email: string;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: Role;
      name: string;
      email: string;
    };
    user: {
      sub: string;
      role: Role;
      name: string;
      email: string;
    };
  }
}
