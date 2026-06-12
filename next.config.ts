import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must NOT be bundled by webpack — they ship .node binaries
  // that webpack can't parse. Mark them external so Node require()s them at
  // runtime from node_modules.
  // ffmpeg-static / ffprobe-static export an absolute path to a platform-
  // specific binary. webpack would mangle the path resolution, so leave them
  // external and let Vercel ship the binaries from node_modules.
  serverExternalPackages: ["@napi-rs/canvas", "sharp", "ffmpeg-static", "ffprobe-static"],
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  // ── Security headers — applied to every response ─────────────────
  // These give us the same protection layer Lovable users get out of
  // the box (and that most production sites need).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Block clickjacking — only our own origin can iframe us.
          { key: "X-Frame-Options",        value: "SAMEORIGIN" },
          // Prevent MIME-sniffing attacks
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak URLs to other origins
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          // Force HTTPS for 2 years, include subdomains
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Restrict powerful browser features we don't use
          { key: "Permissions-Policy",     value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()" },
          // Basic XSS protection (legacy browsers)
          { key: "X-XSS-Protection",       value: "1; mode=block" },
          // Cross-origin isolation — moderate
          { key: "Cross-Origin-Opener-Policy",     value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy",   value: "same-origin" },
          // Content Security Policy — permissive enough for our needs but
          // blocks injected scripts. data: allowed for our base64 logo + lottie thumbs.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // Next.js needs unsafe-inline; eval for some dev tools
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "media-src 'self' blob: data:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
