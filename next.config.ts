import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // Fix for Supabase realtime critical dependency warnings
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Ignore dynamic import warnings from Supabase realtime
    config.ignoreWarnings = [
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    // Handle websocket imports for realtime (if needed)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        ws: false,
      };
    }

    return config;
  },
  
  // Optional: Disable realtime entirely if not needed
  experimental: {
    // This helps with bundle optimization
    optimizePackageImports: ['@supabase/supabase-js'],
  },
};

export default nextConfig;
