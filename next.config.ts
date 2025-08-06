import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Image optimization configuration to reduce log noise
  images: {
    // Enable static imports for better caching
    unoptimized: false,
    // Configure domains if you're using external images
    domains: [],
    // Reduce the number of generated sizes to minimize requests
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [32, 64, 128, 256],
    // Cache optimized images longer to reduce repeated requests
    minimumCacheTTL: 86400, // 24 hours
    // Formats to generate (webp is more efficient)
    formats: ['image/webp', 'image/avif'],
    // Disable optimization for static logos to prevent repeated requests
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
