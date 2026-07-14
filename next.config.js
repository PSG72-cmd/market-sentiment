/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable font optimization to avoid build-time Google Fonts fetching
  optimizeFonts: false,
};

module.exports = nextConfig;
