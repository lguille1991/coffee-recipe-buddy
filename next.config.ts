import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.OCR_E2E_TEST_MODE === '1'
    ? '.next-e2e'
    : process.env.NODE_ENV === 'development'
      ? '.next-dev'
      : '.next',
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? '1.0.0',
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Supabase Storage (bean bag photos)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [{
      source: '/ocr/v7/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }]
  },
};

export default nextConfig;
