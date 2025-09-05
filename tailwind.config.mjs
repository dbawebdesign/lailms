/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'fade-in': 'fadeIn 1s ease-out forwards',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-right': 'slideRight 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'blur-in': 'blurIn 1.2s ease-out forwards',
        'scale-in': 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 8s ease-in-out infinite',
        'sparkle': 'sparkle 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 2s ease infinite',
        'digit-flip': 'digitFlip 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
        'progress-ring': 'progressRing 2.5s ease-out forwards',
        'progress-pulse': 'progressPulse 1s ease-in-out infinite',
        'count-up': 'countUp 2s ease-out forwards',
        'number-bounce': 'numberBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
        'progress-fill': 'progressFill 2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'premium-entrance': 'premiumEntrance 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'subtle-slide-up': 'subtleSlideUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'gentle-fade-in': 'gentleFadeIn 0.7s ease-out forwards',
        'calm-scale': 'calmScale 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'icon-pulse': 'iconPulse 2s ease-in-out infinite',
        'gentle-pulse': 'gentlePulse 2s ease-in-out infinite',
        'simple-icon-pulse': 'simpleIconPulse 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        fadeIn: {
          'to': { opacity: '1' },
        },
        slideUp: {
          'to': { 
            opacity: '1', 
            transform: 'translateY(0)' 
          },
        },
        slideRight: {
          'to': { 
            opacity: '1', 
            transform: 'translateX(0)' 
          },
        },
        blurIn: {
          'to': { 
            opacity: '1', 
            filter: 'blur(0)' 
          },
        },
        scaleIn: {
          'to': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        },
        pulseGlow: {
          '0%, 100%': {
            'box-shadow': '0 0 20px rgba(107, 93, 229, 0.3)',
            'transform': 'scale(1)',
          },
          '50%': {
            'box-shadow': '0 0 30px rgba(107, 93, 229, 0.6)',
            'transform': 'scale(1.02)',
          },
        },
        float: {
          '0%, 100%': { 
            transform: 'translate(0, 0) rotate(0deg)' 
          },
          '33%': { 
            transform: 'translate(20px, -30px) rotate(120deg)' 
          },
          '66%': { 
            transform: 'translate(-20px, 20px) rotate(240deg)' 
          },
        },
        sparkle: {
          '0%, 100%': { 
            opacity: '0', 
            transform: 'scale(0)' 
          },
          '50%': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        },
        gradientShift: {
          '0%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' },
        },
        digitFlip: {
          '0%': {
            opacity: '0',
            transform: 'rotateX(90deg) scale(0.5)',
          },
          '50%': {
            opacity: '0.7',
            transform: 'rotateX(0deg) scale(1.1)',
          },
          '100%': {
            opacity: '1',
            transform: 'rotateX(0deg) scale(1)',
          },
        },
        progressRing: {
          'from': { 'stroke-dashoffset': '251' },
          'to': { 'stroke-dashoffset': '62.75' },
        },
        progressPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        countUp: {
          'from': {
            opacity: '0',
            transform: 'translateY(20px) scale(0.8)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
        numberBounce: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.3) translateY(30px)',
          },
          '50%': {
            transform: 'scale(1.1) translateY(-10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1) translateY(0)',
          },
        },
        progressFill: {
          'from': { width: '0' },
          'to': { width: 'var(--progress-width)' },
        },
        premiumEntrance: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px) scale(0.98)',
            filter: 'blur(2px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0)',
          },
        },
        subtleSlideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(15px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        gentleFadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        calmScale: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.96)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        iconPulse: {
          '0%, 100%': {
            'box-shadow': '0 0 15px rgba(107, 93, 229, 0.4)',
          },
          '50%': {
            'box-shadow': '0 0 25px rgba(107, 93, 229, 0.7)',
          },
        },
        gentlePulse: {
          '0%, 100%': {
            'box-shadow': '0 0 20px rgba(107, 93, 229, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          '50%': {
            'box-shadow': '0 0 30px rgba(107, 93, 229, 0.6), 0 6px 16px rgba(0, 0, 0, 0.2)',
          },
        },
        simpleIconPulse: {
          '0%, 100%': {
            'filter': 'drop-shadow(0 0 8px rgba(107, 93, 229, 0.6))',
          },
          '50%': {
            'filter': 'drop-shadow(0 0 12px rgba(107, 93, 229, 0.8))',
          },
        },
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
      },
    },
  },
  plugins: [],
};
export default config; 