import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from '../../hooks/useTelegram';

/**
 * iOS-style Segmented Control with glassmorphism design
 *
 * @param {Object} props
 * @param {Array<{value: string, label: string}>} props.options - Array of options to display
 * @param {string} props.value - Currently selected value
 * @param {Function} props.onChange - Callback when selection changes (value) => void
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.size='md'] - Size variant: 'sm' | 'md' | 'lg'
 *
 * @example
 * <SegmentedControl
 *   options={[
 *     { value: 'month', label: 'Month' },
 *     { value: 'year', label: 'Year' }
 *   ]}
 *   value={period}
 *   onChange={setPeriod}
 * />
 */
export default function SegmentedControl({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}) {
  const { triggerHaptic } = useTelegram();

  const sizeClasses = {
    sm: 'h-8 text-xs px-3',
    md: 'h-11 text-sm px-4',
    lg: 'h-12 text-base px-5',
  };

  const handleSelect = (newValue) => {
    if (newValue !== value) {
      triggerHaptic('selection');
      onChange(newValue);
    }
  };

  return (
    <div
      className={`
        relative inline-flex items-center gap-1 p-1 rounded-full
        backdrop-blur-lg bg-white/5 border border-white/10
        ${className}
      `}
    >
      {/* Background sliding pill */}
      <AnimatePresence mode="wait">
        {options.map(
          (option) =>
            option.value === value && (
              <motion.div
                key={`pill-${option.value}`}
                layoutId="segmented-pill"
                className="absolute rounded-full bg-gradient-to-r from-orange-700 to-orange-500 shadow-glow-orange-sm"
                style={{
                  left: `${options.findIndex((o) => o.value === value) * (100 / options.length) + 2}%`,
                  right: `${(options.length - options.findIndex((o) => o.value === value) - 1) * (100 / options.length) + 2}%`,
                  top: '4px',
                  bottom: '4px',
                }}
                initial={false}
                animate={{
                  left: `${options.findIndex((o) => o.value === value) * (100 / options.length) + 2}%`,
                  right: `${(options.length - options.findIndex((o) => o.value === value) - 1) * (100 / options.length) + 2}%`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
              />
            )
        )}
      </AnimatePresence>

      {/* Buttons */}
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`
              relative z-10 rounded-full font-semibold
              transition-colors duration-200
              ${sizeClasses[size]}
              ${isSelected ? 'text-white' : 'text-gray-400 hover:text-gray-300'}
            `}
            style={{ minWidth: `${100 / options.length - 2}%` }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
