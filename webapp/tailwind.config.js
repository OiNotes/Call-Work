/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // UPDATED: Soft Dark palette (was #0A0A0A)
        'dark-bg': '#181818',
        'dark-card': '#212121',
        'dark-elevated': '#2C2C2C',
        
        // 5-step Orange palette
        'orange-900': '#CC5500',
        'orange-700': '#FF6B00',  // primary
        'orange-500': '#FF8C42',
        'orange-300': '#FFB366',
        'orange-100': '#FFE0CC',
        
        // Legacy aliases (backward compatibility)
        'orange-primary': '#FF6B00',
        'orange-light': '#FF8533',
        'orange-dark': '#CC5500',
        'orange-accent': '#FFA366',
        
        // Metallic accents
        'chrome-light': '#BDC3C7',
        'chrome-mid': '#7F8C8D',
        'gold-light': '#F4D03F',
        'gold-deep': '#C5A032',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        'hero': '-0.04em',      // Hero headings (28px+)
        'heading': '-0.02em',   // Card titles
        'subheading': '-0.01em', // Subheadings
        'normal': '0em',        // Body text
        'caption': '0.03em',    // Small labels
        'uppercase': '0.05em',  // Badges, currency
      },
      lineHeight: {
        'tight': '1.1',    // Hero headings
        'snug': '1.3',     // Card titles
        'normal': '1.5',   // Body text
        'relaxed': '1.6',  // Long paragraphs
      },
      fontWeight: {
        'extrabold': '800', // Hero text
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        // Multi-layer premium shadows (Linear-style)
        'premium-sm': `
          0.5px 1px 1px hsl(0deg 0% 0% / 0.7)
        `,
        'premium-md': `
          1px 2px 2px hsl(0deg 0% 0% / 0.333),
          2px 4px 4px hsl(0deg 0% 0% / 0.333),
          3px 6px 6px hsl(0deg 0% 0% / 0.333)
        `,
        'premium-lg': `
          1px 2px 2px hsl(0deg 0% 0% / 0.2),
          2px 4px 4px hsl(0deg 0% 0% / 0.2),
          4px 8px 8px hsl(0deg 0% 0% / 0.2),
          8px 16px 16px hsl(0deg 0% 0% / 0.2),
          16px 32px 32px hsl(0deg 0% 0% / 0.2)
        `,
        // Orange glow shadows
        'glow-orange': '0 0 20px rgba(255, 107, 0, 0.3), 0 0 40px rgba(255, 107, 0, 0.15)',
        'glow-orange-lg': '0 0 30px rgba(255, 107, 0, 0.4), 0 0 60px rgba(255, 107, 0, 0.2)',
        // Button state shadows
        'glow-orange-sm': '0 0 20px rgba(255, 107, 0, 0.3)',
        'glow-orange-md': '0 0 30px rgba(255, 107, 0, 0.4), 0 0 60px rgba(255, 107, 0, 0.2)',
        'button-hover': '0 4px 8px rgba(255, 107, 0, 0.3), 0 8px 20px rgba(255, 107, 0, 0.25), 0 0 40px rgba(255, 107, 0, 0.2)',
        'button-pressed': 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-orange': 'linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%)',
        'gradient-orange-hover': 'linear-gradient(135deg, #FF8C42 0%, #FFB366 100%)',
        'gradient-dark': 'linear-gradient(145deg, rgba(26, 26, 26, 0.9) 0%, rgba(20, 20, 20, 0.95) 100%)',
        'gradient-bg-subtle': 'linear-gradient(180deg, #0A0A0A 0%, #17212b 100%)',
      },
      fontVariantNumeric: {
        'tabular': 'tabular-nums',
      },
    },
  },
  plugins: [],
}
