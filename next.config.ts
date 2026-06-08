import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must NOT be bundled by webpack — they ship .node binaries
  // that webpack can't parse. Mark them external so Node require()s them at
  // runtime from node_modules.
  serverExternalPackages: ["@napi-rs/canvas", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  // Disable Next's floating dev-mode indicator (the ⚡ at bottom of the page)
  devIndicators: false,
};

export default nextConfig;
