import { motion } from 'framer-motion';

const controlSpring = { type: 'spring', stiffness: 400, damping: 32 };

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6">
      {tabs.map((tab) => (
        <motion.button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 relative py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === tab.id ? 'text-white' : 'text-gray-400'
          }`}
          whileHover={activeTab !== tab.id ? { backgroundColor: 'rgba(255, 255, 255, 0.05)' } : undefined}
          whileTap={{ scale: 0.98 }}
          transition={activeTab === tab.id ? controlSpring : { duration: 0.2 }}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTabBackground"
              className="absolute inset-0 bg-white/10 rounded-lg"
              transition={controlSpring}
              style={{ zIndex: 0 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
