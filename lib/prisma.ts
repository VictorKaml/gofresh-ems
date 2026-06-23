import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!globalForPrisma.prisma) {
  // Fallback to the standard PrismaClient when @prisma/adapter-pg is not available
  globalForPrisma.prisma = new PrismaClient({ log: ["query"] });
}

export const prisma = globalForPrisma.prisma as PrismaClient;