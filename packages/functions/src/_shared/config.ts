// Type declarations for Deno (if available)
declare global {
  var Deno: {
    env: {
      get(key: string): string | undefined;
    };
  } | undefined;
}

// Environment configuration that works in both Deno and Node.js
const getEnvVar = (key: string, defaultValue?: string): string => {
  // Check if we're in Deno environment
  if (typeof globalThis.Deno !== 'undefined' && globalThis.Deno?.env) {
    return globalThis.Deno.env.get(key) || defaultValue || '';
  }
  // Fall back to Node.js process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue || '';
  }
  return defaultValue || '';
};

export const LOGIN_REDIRECT_URL = getEnvVar('LOGIN_REDIRECT_URL', 'http://localhost:3000/'); 