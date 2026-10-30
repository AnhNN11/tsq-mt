import type { NextConfig } from "next";

const allowedDevOrigins = ["127.0.0.1"];
try {
  if (process.env.APP_PUBLIC_URL)
    allowedDevOrigins.push(new URL(process.env.APP_PUBLIC_URL).hostname);
} catch {
  /* Invalid base URLs are reported by the capture API. */
}
const nextConfig: NextConfig = {
  allowedDevOrigins,
  devIndicators: { position: "bottom-right" },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
