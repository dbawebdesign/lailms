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
    // Use CSS variables that can be overridden for theming
    // Fallbacks defined in the comprehensive guide should be handled in global CSS
    sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
    // Keep mono if needed, or remove if not specified in the guide
    mono: ['var(--font-mono)', 'monospace'],
  },
  fontSize: {
    // Based on Comprehensive Guide Section 3
    h1: '36px', // 36px
    h2: '24px', // 24px
    h3: '18px', // 18px
    base: '16px', // Body Text 16px
    sm: '14px', // Caption/Small 14px
    // Add other sizes if needed (e.g., xs, lg, xl, etc.)
  },
  fontWeight: {
    // Based on Comprehensive Guide Section 3
    light: '300', // Example, if needed
    normal: '400', // Body, Caption/Small
    medium: '500', // H3
    semibold: '600', // H2
    bold: '700', // H1
    extrabold: '800', // Example, if needed
    black: '900', // Example, if needed
  },
  lineHeight: {
    // Based on Comprehensive Guide Section 3 (px values converted to relative units)
    // Assuming base font size of 16px for relative calculations
    h1: 'calc(44 / 36)',     // 44px for 36px font
    h2: 'calc(32 / 24)',     // 32px for 24px font
    h3: 'calc(28 / 18)',     // 28px for 18px font
    base: 'calc(24 / 16)',   // 24px for 16px font (1.5)
    sm: 'calc(20 / 14)',     // 20px for 14px font (~1.43)
  },
  letterSpacing: {
      // Based on Comprehensive Guide Section 3
      tight: '+0.25px', // H1, H2
      normal: '0px',   // H3, Body, Caption/Small
      // Add other spacings if needed
  }
};

export const spacing = {
  // Enhanced spacing scale based on guide's common values (2, 4, 6.1, 6.3) and grid (4)
  // Using pixel values for clarity and direct mapping
  px0: '0px',
  px4: '4px',   // 0.25rem
  px8: '8px',   // 0.5rem
  px12: '12px',  // 0.75rem (Button padding Y)
  px16: '16px',  // 1rem (Body line-height diff, Input padding, Grid outer margins)
  px24: '24px',  // 1.5rem (Common padding, Button padding X, Grid gutters, Card padding)
  px32: '32px',  // 2rem (Generous padding high end)
  px64: '64px',  // 4rem (Nav collapsed width)
  // Add other values as needed (e.g., px2, px6)
};

export const breakpoints = {
  // Based on Comprehensive Guide Section 4
  // Note: The guide defines ranges (e.g., < 600px), 
  // but typically these are defined as minimum widths in CSS/Tailwind.
  xs: '600px', // Corresponds to guide's SM start
  sm: '600px', // Actual SM definition
  md: '960px',
  lg: '1280px',
  xl: '1920px',
  // '2xl' from original is removed as guide stops at XL
};

export const shadows = {
  // Define shadow styles
  // Card shadow from guide (6.3) for light mode. Dark mode likely needs CSS var.
  // Guide syntax: 0 1 3 px rgba(0,0,0,0.1)/(0,0,0,0.5)
  card: '0 1px 3px 0 rgb(0 0 0 / 0.1)', // Light mode value
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1)', // Adjusted to match card light mode
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none',
};

export const borderRadius = {
  // Based on Comprehensive Guide Section 6.1, 6.2, 6.3 and original values
  none: '0px',
  input: '6px', // 6.2 Form Inputs
  button: '8px', // 6.1 Buttons
  card: '12px', // 6.3 Cards & Panels

  // Keep variable-based radii for general consistency if needed
  // Ensure --radius CSS variable is defined appropriately (e.g., 8px or 12px)
  sm: 'calc(var(--radius, 8px) - 4px)', // Default to 8px if --radius not set
  DEFAULT: 'var(--radius, 8px)',      // Default to 8px
  md: 'calc(var(--radius, 8px) - 2px)', // Default to 8px
  lg: 'var(--radius, 8px)',           // Default to 8px
  xl: 'calc(var(--radius, 8px) + 4px)', // Default to 8px

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