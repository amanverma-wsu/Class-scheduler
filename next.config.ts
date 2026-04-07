import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the app to be accessed from any hostname on the local network
  // (e.g. http://192.168.x.x:3000) without HMR WebSocket getting stuck.
  allowedDevOrigins: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
};

export default nextConfig;
