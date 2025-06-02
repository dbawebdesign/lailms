// Placeholder utils package
// This can be expanded with shared utility functions as needed

export const version = "0.0.1";

// Basic utility function for demonstration
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Export placeholder - can be expanded later
export default {
  version,
  isObject,
}; 