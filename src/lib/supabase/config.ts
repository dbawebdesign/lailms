// Supabase configuration for production-ready setup
export const supabaseConfig = {
  // Disable realtime for production to avoid critical dependency warnings
  realtime: {
    params: {
      eventsPerSecond: 1,
    },
  },
  // Global configuration
  global: {
    headers: {
      'X-Client-Info': 'learnologyai@1.0.0',
    },
  },
  // Auth configuration
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  // Storage configuration
  storage: {
    // Add any storage-specific config here
  },
};

// Environment-specific settings
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

// Error handling configuration
export const errorConfig = {
  logErrors: isDevelopment,
  throwOnError: isDevelopment,
}; 