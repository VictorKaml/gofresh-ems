import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Forces serverless environments to resolve Prisma 7/PG modules outside the edge bundle wrapper
  serverExternalPackages: ["@prisma/client", "pg"],
};

export default nextConfig;
