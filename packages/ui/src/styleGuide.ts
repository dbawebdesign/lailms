export const colors = {
  primary: 'oklch(var(--primary))',
  primaryForeground: 'oklch(var(--primary-foreground))',
  secondary: 'oklch(var(--secondary))',
  secondaryForeground: 'oklch(var(--secondary-foreground))',
  accent: 'oklch(var(--accent))',
  accentForeground: 'oklch(var(--accent-foreground))',
  muted: 'oklch(var(--muted))',
  mutedForeground: 'oklch(var(--muted-foreground))',
  destructive: 'oklch(var(--destructive))',
  border: 'oklch(var(--border))',
  input: 'oklch(var(--input))',
  ring: 'oklch(var(--ring))',
  background: 'oklch(var(--background))',
  foreground: 'oklch(var(--foreground))',
  // Add more specific colors as needed
};

export const typography = {
  fontFamily: {
    sans: ['var(--font-geist-sans)', 'sans-serif'],
    mono: ['var(--font-geist-mono)', 'monospace'],
  },
  fontSize: {
    // Define text sizes (e.g., xs, sm, base, lg, xl, 2xl, ...)
    base: '1rem',
  },
  fontWeight: {
    // Define font weights (e.g., normal, medium, bold)
    normal: '400',
    bold: '700',
  },
  lineHeight: {
    // Define line heights
    normal: '1.5',
  },
};

export const spacing = {
  // Define spacing scale (e.g., 0, 1, 2, 4, 8, 16, ...)
  '0': '0px',
  '1': '0.25rem', // 4px
  '2': '0.5rem',  // 8px
  '4': '1rem',    // 16px
  '8': '2rem',    // 32px
  '16': '4rem',   // 64px
};

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const shadows = {
  // Define shadow styles
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none',
};

export const borderRadius = {
  none: '0px',
  sm: 'calc(var(--radius) - 4px)',
  DEFAULT: 'var(--radius)', // Matches --radius CSS var
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) + 4px)',
  full: '9999px',
};

export const designTokens = {
  colors,
  typography,
  spacing,
  breakpoints,
  shadows,
  borderRadius,
}; 