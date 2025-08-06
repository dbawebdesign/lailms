import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Image optimization configuration - disable for static assets to reduce log noise
  images: {
    // Completely disable optimization for static assets to prevent repeated requests
    unoptimized: true,
    // Configure domains if you're using external images
    domains: [],
    // Allow SVG files
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Disable static optimization for pages that use dynamic APIs
  experimental: {
    // This helps with bundle optimization
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  
  // Force dynamic rendering for pages that use cookies API
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  
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
};

export default nextConfig;
