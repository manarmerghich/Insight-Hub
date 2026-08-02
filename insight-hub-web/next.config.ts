import { config } from "dotenv";
import type { NextConfig } from "next";

// Secrets live in the repo root .env.local, shared with insight-hub-pipeline —
// not in insight-hub-web's own directory, which Next.js would load by default.
config({ path: "../.env.local" });

const nextConfig: NextConfig = {};

export default nextConfig;
