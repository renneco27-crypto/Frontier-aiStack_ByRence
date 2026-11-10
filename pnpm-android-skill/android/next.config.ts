import type { NextConfig } from "next";

const BUILD_VERSION =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.NEXT_PUBLIC_APP_CACHE_SHA ||
  String(Date.now());

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
  async headers() {
    return [
      {
        source: '/api/relay/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-relay-sha' },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      { source: '/data-deletion', destination: '/data-deletion.html' },
      { source: '/privacy-policy', destination: '/privacy-policy.html' },
      { source: '/privacy', destination: '/privacy-policy.html' },
      { source: '/terms-of-service', destination: '/terms-of-service.html' },
      { source: '/tos', destination: '/terms-of-service.html' },
    ]
  },
};

export default nextConfig;
