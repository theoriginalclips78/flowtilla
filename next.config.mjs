/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // archiver (zip streaming) uses Node built-ins that shouldn't be bundled by webpack.
  experimental: { serverComponentsExternalPackages: ["archiver"] },
};

export default nextConfig;
