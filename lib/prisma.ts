// lib/prisma.ts or prisma.ts
import { PrismaClient } from "../prisma/generated"; // 👈 Crucial: Point to your custom generated output folder
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// 1. Establish the native PostgreSQL connection pooling driver
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// 2. Wrap the pool engine inside Prisma 7's Driver Adapter
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 3. Pass the adapter directly into the constructor to clear the Next.js worker crash
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ 
    adapter,
    log: ["query"] 
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;