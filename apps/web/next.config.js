/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ironloom/shared'],
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
