/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Cloudflare Pages compatible output
  output: 'standalone',
};

module.exports = nextConfig;
