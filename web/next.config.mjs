import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this app. Without this, Next infers the repo-root
  // (where a stray package-lock.json lives) and the RSC bundler intermittently
  // fails to resolve its own internal modules ("React Client Manifest" 500s).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
