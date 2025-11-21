'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-full bg-[var(--secondary)] border border-[var(--border)]" />
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative w-9 h-9 rounded-full bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      aria-label="Toggle Theme"
    >
      <motion.div
        initial={false}
        animate={{ scale: isDark ? 0 : 1, opacity: isDark ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Sun className="w-4 h-4" />
      </motion.div>
      
      <motion.div
        initial={false}
        animate={{ scale: isDark ? 1 : 0, opacity: isDark ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Moon className="w-4 h-4" />
      </motion.div>
    </button>
  )
}
