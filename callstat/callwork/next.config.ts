import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Явно указываем output для Vercel
  output: 'standalone',
  
  // ✅ Turbopack конфигурация (по умолчанию в Next.js 16)
  turbopack: {},
  
  // ✅ Experimental: оптимизация импортов тяжелых библиотек
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', '@radix-ui/react-avatar', '@radix-ui/react-dropdown-menu'],
  },

  // ✅ Webpack оптимизации
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Разделяем тяжелые библиотеки в отдельные chunks для лучшей загрузки
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Framer Motion в отдельный chunk (3MB)
            framerMotion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              priority: 30,
            },
            // Recharts в отдельный chunk (7.4MB - если будет использоваться)
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: 'recharts',
              priority: 25,
            },
            // Radix UI компоненты
            radixUI: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              priority: 20,
            },
            // Lucide icons
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'lucide',
              priority: 15,
            },
          },
        },
      }
    }
    return config
  },
};

export default nextConfig;
