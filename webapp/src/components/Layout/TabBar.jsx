import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useTelegram } from '../../hooks/useTelegram';
import { useTranslation } from '../../i18n/useTranslation';
import { usePlatform } from '../../hooks/usePlatform';
import { getSurfaceStyle, getSpringPreset, isAndroid } from '../../utils/platform';
import { gpuAccelStyle } from '../../utils/animationHelpers';

const getTabsConfig = (t) => [
  {
    id: 'subscriptions',
    label: t('tabs.subscriptions'),
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  },
  {
    id: 'catalog',
    label: t('tabs.catalog'),
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: t('tabs.settings'),
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const { activeTab, setActiveTab, setCartOpen, setPaymentStep } = useStore();
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();
  const platform = usePlatform();

  const tabs = getTabsConfig(t);

  const containerStyle = useMemo(
    () => getSurfaceStyle('tabbar', platform),
    [platform]
  );

  const activeIndicatorStyle = useMemo(
    () => getSurfaceStyle('accentGlow', platform),
    [platform]
  );

  const tapSpring = useMemo(
    () => getSpringPreset('quick', platform),
    [platform]
  );

  const indicatorSpring = useMemo(
    () => getSpringPreset('press', platform),
    [platform]
  );

  const android = isAndroid(platform);

  const handleTabChange = (tabId) => {
    triggerHaptic('light');
    
    // Close all modals BEFORE switching tabs
    setCartOpen(false);
    setPaymentStep('idle'); // Closes all payment modals
    
    // Switch tab
    setActiveTab(tabId);
  };

  return (
    <div className="tabbar">
      <div className="rounded-t-3xl" style={{ ...containerStyle, paddingBottom: 'var(--safe-bottom)' }}>
        <div className="flex items-center justify-around px-4 py-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="relative px-2"
              >
                <motion.div
                  className={`flex flex-col items-center gap-1 relative px-4 py-2 ${
                    isActive ? 'text-orange-primary' : 'text-gray-400'
                  }`}
                  whileTap={{ scale: android ? 0.95 : 0.92 }}
                  transition={tapSpring}
                >
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      layoutId="activeTab"
                      initial={false}
                      transition={indicatorSpring}
                      style={{ willChange: 'transform', ...activeIndicatorStyle, zIndex: -1 }}
                    />
                  )}

                  {tab.icon}
                  <span
                    className="text-xs font-semibold"
                    style={{ letterSpacing: '0.02em' }}
                  >
                    {tab.label}
                  </span>
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
