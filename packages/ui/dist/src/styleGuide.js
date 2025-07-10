// Learnology AI Design System Tokens
// Following the comprehensive style guide for light, spacious, airy, and flowing design
export const colors = {
    // Brand Colors
    primary: 'hsl(var(--primary))',
    primaryForeground: 'hsl(var(--primary-foreground))',
    secondary: 'hsl(var(--secondary))',
    secondaryForeground: 'hsl(var(--secondary-foreground))',
    accent: 'hsl(var(--accent))',
    accentForeground: 'hsl(var(--accent-foreground))',
    muted: 'hsl(var(--muted))',
    mutedForeground: 'hsl(var(--muted-foreground))',
    // Semantic Colors
    destructive: 'hsl(var(--destructive))',
    destructiveForeground: 'hsl(var(--destructive-foreground))',
    success: 'hsl(var(--success))',
    successForeground: 'hsl(var(--success-foreground))',
    warning: 'hsl(var(--warning))',
    warningForeground: 'hsl(var(--warning-foreground))',
    info: 'hsl(var(--info))',
    infoForeground: 'hsl(var(--info-foreground))',
    // Layout Colors
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    surface: 'hsl(var(--surface))',
    border: 'hsl(var(--border))',
    input: 'hsl(var(--input))',
    inputBorder: 'hsl(var(--input-border))',
    ring: 'hsl(var(--ring))',
    divider: 'hsl(var(--divider))',
    // Text Colors
    textPrimary: 'hsl(var(--text-primary))',
    textSecondary: 'hsl(var(--text-secondary))',
    // Brand Gradient Values
    gradientStart: 'var(--gradient-start)',
    gradientMid: 'var(--gradient-mid)',
    gradientEnd: 'var(--gradient-end)',
    // Chart Colors
    chart1: 'hsl(var(--chart-1))',
    chart2: 'hsl(var(--chart-2))',
    chart3: 'hsl(var(--chart-3))',
    chart4: 'hsl(var(--chart-4))',
    chart5: 'hsl(var(--chart-5))',
};
// Typography following style guide Section 3
export const typography = {
    fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
    },
    fontSize: {
        // Following style guide typography scale
        h1: '2.25rem', // 36px
        h2: '1.5rem', // 24px
        h3: '1.125rem', // 18px
        body: '1rem', // 16px
        caption: '0.875rem', // 14px
        xs: '0.75rem', // 12px
        sm: '0.875rem', // 14px
        base: '1rem', // 16px
        lg: '1.125rem', // 18px
        xl: '1.25rem', // 20px
        '2xl': '1.5rem', // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem', // 36px
    },
    fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },
    lineHeight: {
        tight: '1.25', // 20px for 16px text
        normal: '1.5', // 24px for 16px text
        relaxed: '1.75', // 28px for 16px text
        loose: '2', // 32px for 16px text
        h1: '2.75rem', // 44px for h1
        h2: '2rem', // 32px for h2
        h3: '1.75rem', // 28px for h3
        body: '1.5rem', // 24px for body
        caption: '1.25rem', // 20px for caption
    },
    letterSpacing: {
        tight: '-0.025em',
        normal: '0',
        wide: '0.025em', // For h1 and h2
        wider: '0.05em',
        widest: '0.1em',
    },
};
// Spacing following style guide generous spacing principles
export const spacing = {
    // Base spacing scale
    px: '1px',
    0: '0',
    0.5: '0.125rem', // 2px
    1: '0.25rem', // 4px
    1.5: '0.375rem', // 6px
    2: '0.5rem', // 8px
    2.5: '0.625rem', // 10px
    3: '0.75rem', // 12px
    3.5: '0.875rem', // 14px
    4: '1rem', // 16px
    5: '1.25rem', // 20px
    6: '1.5rem', // 24px - Generous spacing start
    7: '1.75rem', // 28px
    8: '2rem', // 32px - Generous spacing
    9: '2.25rem', // 36px
    10: '2.5rem', // 40px
    12: '3rem', // 48px
    14: '3.5rem', // 56px
    16: '4rem', // 64px
    // Style guide specific spacing
    xs: 'var(--spacing-xs)', // 8px
    sm: 'var(--spacing-sm)', // 12px
    md: 'var(--spacing-md)', // 16px
    lg: 'var(--spacing-lg)', // 24px - Generous padding
    xl: 'var(--spacing-xl)', // 32px - Generous padding
    '2xl': 'var(--spacing-2xl)', // 48px
    '3xl': 'var(--spacing-3xl)', // 64px
};
// Breakpoints following style guide Section 4
export const breakpoints = {
    xs: '600px', // XS: < 600px
    sm: '600px', // SM: ≥ 600px
    md: '960px', // MD: ≥ 960px
    lg: '1280px', // LG: ≥ 1280px
    xl: '1920px', // XL: ≥ 1920px
};
// Shadows following style guide Section 6.3
export const shadows = {
    // Card shadows
    card: '0 1px 3px rgba(0, 0, 0, 0.1)',
    cardDark: '0 1px 3px rgba(0, 0, 0, 0.5)',
    // Standard shadows
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
};
// Border radius following style guide Section 6
export const borderRadius = {
    none: '0',
    sm: 'calc(var(--radius) - 4px)', // 4px
    DEFAULT: 'var(--radius)', // 8px - buttons
    md: 'calc(var(--radius) - 2px)', // 6px - inputs
    lg: 'var(--radius)', // 8px
    xl: 'calc(var(--radius) + 4px)', // 12px - cards
    full: '9999px',
    // Style guide specific radius
    input: 'var(--radius-input)', // 6px
    button: 'var(--radius)', // 8px
    card: 'var(--radius-card)', // 12px
};
// Animation and transitions following style guide Section 9
export const animation = {
    duration: {
        short: '100ms',
        base: '200ms',
        long: '300ms',
    },
    easing: {
        ease: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // ease-in-out
        easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
        easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    },
};
// Layout dimensions following style guide Section 4.1
export const layout = {
    sidebar: {
        expanded: '240px',
        collapsed: '64px',
    },
    aiPanel: {
        width: '320px',
    },
    grid: {
        columns: 12,
        gutter: '24px',
        margin: '16px',
    },
};
export const designTokens = {
    colors,
    typography,
    spacing,
    breakpoints,
    shadows,
    borderRadius,
    animation,
    layout,
};
