import BottomSheet from '../common/BottomSheet';
import { motion } from 'framer-motion';

export default function PreorderSheet({ product, shop, isOpen, onClose }) {
  if (!product) {
    return null;
  }

  const sellerUsername = shop?.seller_username || shop?.sellerUsername || shop?.sellerUserName;
  const contactLink = sellerUsername ? `https://t.me/${sellerUsername.replace(/^@/, '')}` : null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Предзаказ">
      <div className="space-y-5 pb-6">
        <div className="space-y-1">
          <h3 className="text-white text-xl font-semibold" style={{ letterSpacing: '-0.01em' }}>
            {product.name}
          </h3>
          <p className="text-white/60 text-sm">
            ${product.price} • {shop?.name || 'магазин'}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-500/35 bg-orange-500/12 px-4 py-3 text-sm text-orange-100 leading-relaxed">
          Эта позиция доступна по предзаказу. Напишите продавцу, чтобы закрепить товар и уточнить сроки поставки.
        </div>

        <div className="grid gap-3">
          {contactLink && (
            <motion.a
              href={contactLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-primary text-white font-semibold py-3"
              whileTap={{ scale: 0.97 }}
            >
              Написать продавцу
            </motion.a>
          )}

          <motion.button
            onClick={onClose}
            className="w-full rounded-xl border border-white/12 text-white/80 py-3 font-medium"
            whileTap={{ scale: 0.97 }}
          >
            Закрыть
          </motion.button>
        </div>
      </div>
    </BottomSheet>
  );
}
