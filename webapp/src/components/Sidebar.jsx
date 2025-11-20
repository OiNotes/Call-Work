import { memo, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';

const Sidebar = memo(function Sidebar() {
  const { activeTab, setActiveTab, hasFollows } = useStore();
  const { t } = useTranslation();

  const items = useMemo(() => {
    const base = [
      { id: 'subscriptions', label: t('tabs.subscriptions') },
      { id: 'catalog', label: t('tabs.catalog') },
      { id: 'settings', label: t('tabs.settings') },
    ];

    if (hasFollows) {
      base.splice(1, 0, { id: 'follows', label: t('tabs.follows') });
    }

    return base;
  }, [hasFollows, t]);

  if (!items.length) {
    return null;
  }

  return (
    <nav className="hidden xl:block w-64 p-4 space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`w-full text-left px-4 py-2 rounded-xl transition-colors ${
            activeTab === item.id
              ? 'bg-orange-primary/10 text-orange-primary'
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
});

export default Sidebar;
