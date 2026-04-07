import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR WebSocket from LAN IPs — CIDR notation not supported, must use wildcard hostnames
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
};

export default nextConfig;
