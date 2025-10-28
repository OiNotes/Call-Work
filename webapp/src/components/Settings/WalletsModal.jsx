import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../common/PageHeader';
import { useStore } from '../../store/useStore';
import { useTelegram } from '../../hooks/useTelegram';
import { useTranslation } from '../../i18n/useTranslation';
import { useBackButton } from '../../hooks/useBackButton';

// Регулярные выражения для определения типа кошелька
const WALLET_PATTERNS = {
  BTC: /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/,
  LTC: /^(L|M)[a-zA-HJ-NP-Z0-9]{26,33}$/,
  ETH: /^0x[a-fA-F0-9]{40}$/,
  USDT: /^0x[a-fA-F0-9]{40}$/, // USDT (ERC-20) использует те же адреса что и ETH
};

// Определение типа кошелька
const detectWalletType = (address) => {
  if (WALLET_PATTERNS.BTC.test(address)) return 'BTC';
  if (WALLET_PATTERNS.LTC.test(address)) return 'LTC';
  if (WALLET_PATTERNS.ETH.test(address)) return 'ETH/USDT';
  return null;
};

// Компонент карточки кошелька
function WalletCard({ wallet, onRemove }) {
  const { triggerHaptic, confirm } = useTelegram();
  const { t } = useTranslation();

  const handleRemove = async () => {
    triggerHaptic('medium');
    const confirmed = await confirm(t('wallet.confirmRemove'));
    if (confirmed) {
      triggerHaptic('success');
      onRemove(wallet.address);
    }
  };

  const typeColors = {
    'BTC': 'text-orange-500',
    'LTC': 'text-yellow-500',
    'ETH/USDT': 'text-blue-500',
  };

  return (
    <motion.div
      className="glass-card rounded-2xl p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm font-bold ${typeColors[wallet.type] || 'text-gray-400'}`}>
              {wallet.type}
            </span>
            <span className="text-green-500 text-xs">✓</span>
          </div>
          <p className="text-white font-mono text-sm break-all">
            {wallet.address}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {t('wallet.added', { date: new Date(wallet.addedAt).toLocaleDateString('ru-RU') })}
          </p>
        </div>
        <motion.button
          onClick={handleRemove}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-red-400"
          style={{
            background: 'rgba(255, 59, 48, 0.1)',
            border: '1px solid rgba(255, 59, 48, 0.2)'
          }}
          whileTap={{ scale: 0.9 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}

// Основной компонент модалки
export default function WalletsModal({ isOpen, onClose }) {
  const { wallets, addWallet, removeWallet } = useStore();
  const { triggerHaptic, alert } = useTelegram();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [btcAddress, setBtcAddress] = useState('');
  const [ethAddress, setEthAddress] = useState('');
  const [usdtAddress, setUsdtAddress] = useState('');
  const [ltcAddress, setLtcAddress] = useState('');

  // Validation helpers
  const isValidBTC = (addr) => WALLET_PATTERNS.BTC.test(addr);
  const isValidLTC = (addr) => WALLET_PATTERNS.LTC.test(addr);
  const isValidETH = (addr) => WALLET_PATTERNS.ETH.test(addr);
  const hasValidAddress = (btcAddress && isValidBTC(btcAddress)) || 
                          (ethAddress && isValidETH(ethAddress)) ||
                          (usdtAddress && isValidETH(usdtAddress)) ||
                          (ltcAddress && isValidLTC(ltcAddress));

  const handleClose = useCallback(() => {
    setShowForm(false);
    setBtcAddress('');
    setEthAddress('');
    setUsdtAddress('');
    setLtcAddress('');
    onClose();
  }, [onClose]);

  useBackButton(isOpen ? handleClose : null);

  const handleCancelForm = () => {
    triggerHaptic('light');
    setShowForm(false);
    setBtcAddress('');
    setEthAddress('');
    setUsdtAddress('');
    setLtcAddress('');
  };

  const handleSaveWallets = async () => {
    if (!hasValidAddress) {
      await alert('Введите хотя бы один валидный адрес');
      return;
    }

    const walletsToAdd = [];

    if (btcAddress && isValidBTC(btcAddress)) {
      if (!wallets.some(w => w.address === btcAddress)) {
        walletsToAdd.push({ address: btcAddress, type: 'BTC', addedAt: new Date().toISOString() });
      }
    }

    if (ethAddress && isValidETH(ethAddress)) {
      if (!wallets.some(w => w.address === ethAddress)) {
        walletsToAdd.push({ address: ethAddress, type: 'ETH', addedAt: new Date().toISOString() });
      }
    }

    if (usdtAddress && isValidETH(usdtAddress)) {
      if (!wallets.some(w => w.address === usdtAddress)) {
        walletsToAdd.push({ address: usdtAddress, type: 'USDT', addedAt: new Date().toISOString() });
      }
    }

    if (ltcAddress && isValidLTC(ltcAddress)) {
      if (!wallets.some(w => w.address === ltcAddress)) {
        walletsToAdd.push({ address: ltcAddress, type: 'LTC', addedAt: new Date().toISOString() });
      }
    }

    if (walletsToAdd.length === 0) {
      await alert('Все адреса уже добавлены');
      return;
    }

    triggerHaptic('success');
    walletsToAdd.forEach(wallet => addWallet(wallet));

    setBtcAddress('');
    setEthAddress('');
    setUsdtAddress('');
    setLtcAddress('');
    setShowForm(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-dark-bg"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <PageHeader title={t('wallet.title')} onBack={handleClose} />
          <div
            className="min-h-screen pb-24"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}
          >
            <div className="px-4 py-6 space-y-4">
              {/* Context Header */}
              <motion.div
                className="glass-card rounded-2xl p-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-primary/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-orange-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">
                      💼 Кошельки для получения оплаты
                    </h3>
                    <p className="text-gray-400 text-sm mb-2">
                      Укажите адреса для приёма криптовалюты от покупателей.
                    </p>
                    <p className="text-gray-500 text-xs">
                      Поддерживаемые: BTC, LTC, ETH, USDT, TON
                    </p>
                  </div>
                </div>
              </motion.div>

        {/* Кнопка добавления кошелька */}
        {!showForm && (
          <motion.button
            onClick={() => {
              triggerHaptic('light');
              setShowForm(true);
            }}
            className="w-full h-14 rounded-2xl font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)',
              boxShadow: '0 4px 16px rgba(255, 107, 0, 0.3)'
            }}
            whileTap={{ scale: 0.98 }}
          >
            + {t('wallet.add')}
          </motion.button>
        )}

        {/* Форма добавления */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              className="glass-card rounded-2xl p-4 space-y-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {/* BTC Input */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Bitcoin (BTC)</label>
                <input
                  type="text"
                  value={btcAddress}
                  onChange={(e) => setBtcAddress(e.target.value)}
                  placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-orange-primary"
                />
                {btcAddress && (isValidBTC(btcAddress) ? 
                  <span className="text-green-500 text-sm">✓ Valid BTC</span> :
                  <span className="text-red-500 text-sm">⚠️ Invalid BTC</span>
                )}
              </div>

              {/* ETH Input */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Ethereum (ETH)</label>
                <input
                  type="text"
                  value={ethAddress}
                  onChange={(e) => setEthAddress(e.target.value)}
                  placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-orange-primary"
                />
                {ethAddress && (isValidETH(ethAddress) ? 
                  <span className="text-green-500 text-sm">✓ Valid ETH</span> :
                  <span className="text-red-500 text-sm">⚠️ Invalid ETH</span>
                )}
              </div>

              {/* USDT Input */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">USDT (ERC-20)</label>
                <input
                  type="text"
                  value={usdtAddress}
                  onChange={(e) => setUsdtAddress(e.target.value)}
                  placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-orange-primary"
                />
                {usdtAddress && (isValidETH(usdtAddress) ? 
                  <span className="text-green-500 text-sm">✓ Valid USDT</span> :
                  <span className="text-red-500 text-sm">⚠️ Invalid USDT</span>
                )}
              </div>

              {/* LTC Input */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Litecoin (LTC)</label>
                <input
                  type="text"
                  value={ltcAddress}
                  onChange={(e) => setLtcAddress(e.target.value)}
                  placeholder="LQTpS7vVUqFcCW8vJhEJhd8wNEZ3WCqkEu"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-orange-primary"
                />
                {ltcAddress && (isValidLTC(ltcAddress) ? 
                  <span className="text-green-500 text-sm">✓ Valid LTC</span> :
                  <span className="text-red-500 text-sm">⚠️ Invalid LTC</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <motion.button
                  onClick={handleCancelForm}
                  className="flex-1 h-11 rounded-xl font-medium text-gray-300"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Отмена
                </motion.button>
                <motion.button
                  onClick={handleSaveWallets}
                  disabled={!hasValidAddress}
                  className="flex-1 h-11 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{
                    background: hasValidAddress
                      ? 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }}
                  whileTap={hasValidAddress ? { scale: 0.98 } : {}}
                >
                  Сохранить
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Список кошельков */}
        {wallets.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 px-2">
              {t('wallet.saved')}
            </h3>
            <AnimatePresence mode="popLayout">
              {wallets.map((wallet) => (
                <WalletCard
                  key={wallet.address}
                  wallet={wallet}
                  onRemove={removeWallet}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          !showForm && (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <p className="text-gray-400 text-sm">
                {t('wallet.empty')}
              </p>
            </div>
          )
        )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
