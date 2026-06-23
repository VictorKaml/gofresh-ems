import "dotenv/config";
import { defineConfig } from "prisma/config";

// Ensure the environment variable is loaded cleanly
const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

if (!databaseUrl) {
  throw new Error("CRITICAL: DATABASE_URL environment variable is missing in this runtime context.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl // databaseUrl, // Use DIRECT_URL for migrations if available, otherwise fallback to DATABASE_URL
  },
});