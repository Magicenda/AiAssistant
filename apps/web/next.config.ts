import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Единый .env лежит в корне монорепы, а Next ищет файлы только рядом с apps/web.
// forceReload — чтобы файл прочитался, даже если Next уже обработал env.
loadEnvConfig(path.resolve(__dirname, "../.."), false, console, true);

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
