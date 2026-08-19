import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  outputFileTracingIncludes: {
    "/api/setup/migrate": ["./supabase/migrations/*.sql"],
  },
};

export default nextConfig;
