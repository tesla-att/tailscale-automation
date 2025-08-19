export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: { 
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'heartbeat': 'heartbeat 1.5s infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          from: { transform: 'translateY(-20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
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
          from: { transform: 'translateY(30px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      screens: {
        'xs': '475px',
      },
    }
  },
  plugins: [],
  safelist: [
    // Ensure custom classes are not purged
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
  ],
}
