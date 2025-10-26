import { useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { useTelegram } from './hooks/useTelegram';
import { useWebSocket } from './hooks/useWebSocket';
import { useKeyboardViewport } from './hooks/useKeyboardViewport';
import { initI18n, getLanguage } from './i18n';
import TabBarPortal from './components/TabBarPortal';
import CartSheet from './components/Cart/CartSheet';
import PaymentFlowManager from './components/Payment/PaymentFlowManager';
import './styles/globals.css';

// Lazy load pages for code splitting
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Catalog = lazy(() => import('./pages/Catalog'));
const Settings = lazy(() => import('./pages/Settings'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-white/60 text-sm">Loading...</p>
    </div>
  </div>
);

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

  // Инициализация Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      tg.setHeaderColor('#0A0A0A');
      tg.setBackgroundColor('#0A0A0A');
    }
  }, []);

  // Keyboard viewport management
  useKeyboardViewport();

  useEffect(() => {
    if (isReady && user) {
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
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ height: 'var(--vh-dynamic)' }}
    >
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(180deg, #0A0A0A 0%, #17212b 100%)'
        }}
      />

      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 20%, rgba(255, 107, 0, 0.03), transparent 60%)`,
          opacity: 0.6
        }}
      />

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

      <div className="scroll-container relative z-10 flex-1">
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            {renderPage()}
          </AnimatePresence>
        </Suspense>
      </div>

      <div className="relative z-20">
        <TabBarPortal />
        <CartSheet />
        <PaymentFlowManager />
      </div>
    </div>
  );
}

export default App;
