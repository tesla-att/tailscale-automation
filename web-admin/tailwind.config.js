/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Enhanced animation system
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'heartbeat': 'heartbeat 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s linear infinite',
        'float': 'float 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)', opacity: '0.8' },
          '70%': { transform: 'scale(0.9)', opacity: '0.9' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.1)' },
          '50%': { transform: 'scale(1)' },
          '75%': { transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeInUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      // Enhanced responsive breakpoints
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      // Enhanced color system
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      // Enhanced typography
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
      },
    },
  },
  plugins: [],
  // Optimized safelist for production builds
  safelist: [
    // Component classes
    'mobile-padding',
    'mobile-scroll', 
    'safe-padding-x',
    'safe-padding-y',
    'container-responsive',
    'responsive-spacing',
    'card',
    'card-glass',
    'btn-ghost',
    'btn-primary',
    'form-input',
    'nav-link',
    'nav-link-active',
    'mobile-nav',
    'touch-target',
    'shadow-soft',
    'shadow-medium',
    'shadow-strong',
    'text-rendering',
    // Animation classes
    'animate-fade-in',
    'animate-slide-up',
    'animate-slide-down',
    'animate-scale-in',
    'animate-bounce-in',
    'animate-pulse-soft',
    'animate-heartbeat',
    'animate-shimmer',
    'animate-float',
    'animate-fade-in-up',
    // Dynamic classes that might not be detected
    { pattern: /^(animate-|transition-|duration-|ease-|delay-)/ },
    { pattern: /^(bg-|text-|border-|ring-|shadow-)(primary|secondary|success|warning|error)/ },
  ],
  // Performance optimizations
  corePlugins: {
    preflight: false, // We handle this in our CSS
  },
}
