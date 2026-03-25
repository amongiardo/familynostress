const fs = require('fs');
const path = require('path');

/** @type {import('next').NextConfig} */
const backendOrigin =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';
const appVersion = fs
  .readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8')
  .trim();

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: `${backendOrigin}/auth/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${backendOrigin}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
