/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  devIndicators: {
    appIsrStatus: false,
  },
};

export default nextConfig;
