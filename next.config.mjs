/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin', 'googleapis', 'mammoth'],
  eslint: { dirs: ['src', 'tests'] },
};

export default nextConfig;
