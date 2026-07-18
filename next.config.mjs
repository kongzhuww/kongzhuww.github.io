/** @type {import('next').NextConfig} */
const nextConfig = {
  // 允许本地代理访问 HMR 资源，解决你看到的 Blocked cross-origin 警告
  devIndicators: {
    appIsrStatus: false,
  },
  // 如果通过 127.0.0.1 访问，允许跨域
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3002', '127.0.0.1:3002'],
    }
  }
};

export default nextConfig;
