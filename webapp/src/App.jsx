import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { useTelegram } from './hooks/useTelegram';
import { useWebSocket } from './hooks/useWebSocket';
import { initI18n, getLanguage } from './i18n';
import TabBar from './components/Layout/TabBar';
import CartSheet from './components/Cart/CartSheet';
import PaymentFlowManager from './components/Payment/PaymentFlowManager';
import Subscriptions from './pages/Subscriptions';
import Catalog from './pages/Catalog';
import Settings from './pages/Settings';
import './styles/globals.css';

function App() {
  const { activeTab } = useStore();
  const { user, isReady, isValidating, error } = useTelegram();
  const { isConnected } = useWebSocket();

  // Инициализация i18n
  useEffect(() => {
    const loadLanguage = async () => {
      const lang = getLanguage()
      await initI18n()
      useStore.getState().setLanguage(lang)
    }
    loadLanguage()
  }, [])

  useEffect(() => {
    if (isReady && user) {
      // Сохраняем пользователя в store
      useStore.getState().setUser(user);
    }
  }, [isReady, user]);

  const renderPage = () => {
    switch (activeTab) {
      case 'subscriptions':
        return <Subscriptions />;
      case 'catalog':
        return <Catalog />;
      case 'settings':
        return <Settings />;
      default:
        return <Subscriptions />;
    }
  };

  // Show loading state during validation
  if (isValidating || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-white text-xl font-bold mb-2">Authentication Failed</h1>
          <p className="text-white/60 mb-4">{error}</p>
          <p className="text-white/40 text-sm">
            Please open this app from the Telegram bot menu button.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* Fixed background gradient - никогда не двигается */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(180deg, #0A0A0A 0%, #17212b 100%)'
        }}
      />

      {/* Subtle orange glow - barely visible, fixed */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 20%, rgba(255, 107, 0, 0.03), transparent 60%)`,
          opacity: 0.6
        }}
      />

      {/* WebSocket connection indicator (dev mode only) */}
      {import.meta.env.DEV && (
        <div className="fixed top-2 right-2 z-50">
          <div
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              isConnected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {isConnected ? '🟢 WS Connected' : '🔴 WS Disconnected'}
          </div>
        </div>
      )}

      {/* Scrollable content area - только контент скроллится */}
      <div className="scroll-container relative z-10 flex-1">
        <AnimatePresence mode="wait">
          {renderPage()}
        </AnimatePresence>
      </div>

      {/* Fixed components at bottom - всегда видны */}
      <div className="relative z-20">
        <TabBar />
        <CartSheet />
        <PaymentFlowManager />
      </div>
    </div>
  );
}

export default App;
