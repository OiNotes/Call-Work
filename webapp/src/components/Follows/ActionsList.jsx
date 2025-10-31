import { PencilIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import InteractiveListItem from '../common/InteractiveListItem';

export default function ActionsList({
  mode,
  markup,
  onEditMarkup,
  onSwitchMode,
  onDelete
}) {
  const modeLabel = mode === 'monitor' ? 'Мониторинг' : 'Перепродажа';
  const switchToMode = mode === 'monitor' ? 'resell' : 'monitor';
  const switchToLabel = switchToMode === 'monitor' ? 'Мониторинг' : 'Перепродажа';

  return (
    <div className="space-y-6">
      {/* Секция: НАСТРОЙКИ */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">
          НАСТРОЙКИ
        </h3>
        <div className="glass-card rounded-2xl border border-white/10">
          {/* Изменить наценку (только для resell) */}
          {mode === 'resell' && (
            <>
              <InteractiveListItem
                onClick={onEditMarkup}
                className="w-full"
                style={{
                  minHeight: '72px',
                  padding: '16px 18px',
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-primary/10 flex items-center justify-center flex-shrink-0">
                  <PencilIcon className="w-5 h-5 text-orange-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-base">
                    Изменить наценку
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    Текущая: +{markup}%
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </InteractiveListItem>
              <div className="h-px bg-white/5" />
            </>
          )}

          {/* Переключить режим */}
          <InteractiveListItem
            onClick={onSwitchMode}
            className="w-full"
            style={{
              minHeight: '72px',
              padding: '16px 18px',
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <ArrowPathIcon className="w-5 h-5 text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium text-base">
                Переключить режим
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                Сейчас: {modeLabel} → Переключить на: {switchToLabel}
              </div>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </InteractiveListItem>
        </div>
      </div>

      {/* Секция: ОПАСНАЯ ЗОНА */}
      <div>
        <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider px-2 mb-3">
          ОПАСНАЯ ЗОНА
        </h3>
        <div className="glass-card rounded-2xl border border-red-500/20">
          <InteractiveListItem
            onClick={onDelete}
            className="w-full"
            rippleColor="rgba(239, 68, 68, 0.35)"
            style={{
              minHeight: '72px',
              padding: '16px 18px',
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <TrashIcon className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-red-500 font-medium text-base">
                Удалить подписку
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                Это действие нельзя отменить
              </div>
            </div>
            <svg
              className="w-5 h-5 text-red-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </InteractiveListItem>
        </div>
      </div>
    </div>
  );
}
