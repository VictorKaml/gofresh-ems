import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (!globalForPrisma.prisma) {
  // 1. Establish the native PostgreSQL Connection Pool using your environment URL
  const pool = new Pool({ 
    connectionString: 
  });
  
  // 2. Wrap the pool into Prisma's native v7 driver adapter 
  const adapter = new PrismaPg(pool);
  
  // 3. Pass the adapter explicitly into the PrismaClient constructor configuration
  globalForPrisma.prisma = new PrismaClient({ 
    adapter,
    log: ["query"]
  });
}

export const prisma = globalForPrisma.prisma;