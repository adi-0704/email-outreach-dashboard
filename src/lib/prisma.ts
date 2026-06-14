import { PrismaClient } from '@prisma/client';

// Bug Fix: Singleton PrismaClient to prevent connection pool exhaustion on Vercel serverless.
// Without this, every page load creates a new PrismaClient with its own pool → DB hits connection limit fast.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
