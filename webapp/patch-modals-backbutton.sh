#!/bin/bash

# Скрипт для автоматического добавления useBackButton hook во все модалки

MODALS=(
  "src/components/Settings/ProductsModal.jsx"
  "src/components/Settings/WorkspaceModal.jsx"
  "src/components/Settings/LanguageModal.jsx"
  "src/components/Settings/WalletsModal.jsx"
  "src/components/Settings/SubscriptionModal.jsx"
  "src/components/Settings/FollowsModal.jsx"
)

for MODAL in "${MODALS[@]}"; do
  echo "Patching $MODAL..."

  # Проверка существования файла
  if [ ! -f "$MODAL" ]; then
    echo "  ⚠️  File not found: $MODAL"
    continue
  fi

  # 1. Добавить import useBackButton (если еще нет)
  if ! grep -q "useBackButton" "$MODAL"; then
    # Найти строку с useTelegram import и добавить после нее
    sed -i '' "/import.*useTelegram.*from/a\\
import { useBackButton } from '../../hooks/useBackButton';
" "$MODAL"
    echo "  ✅ Added useBackButton import"
  else
    echo "  ℹ️  useBackButton import already exists"
  fi

  # 2. Удалить onBack из PageHeader (заменить onBack={...} на пустую строку)
  if grep -q "PageHeader.*onBack=" "$MODAL"; then
    sed -i '' 's/<PageHeader \(.*\) onBack={[^}]*}/<PageHeader \1/g' "$MODAL"
    echo "  ✅ Removed onBack prop from PageHeader"
  fi

  # 3. Добавить useBackButton hook перед первым useEffect
  # Ищем функцию export default и добавляем hook после объявления constов
  if ! grep -q "useBackButton(isOpen" "$MODAL"; then
    # Найти первый useEffect и добавить перед ним
    sed -i '' "/useEffect.*{/i\\
\\
  // Используем Telegram BackButton API для закрытия модалки\\
  useBackButton(isOpen ? (handleClose || onClose) : null);
" "$MODAL"
    echo "  ✅ Added useBackButton hook"
  else
    echo "  ℹ️  useBackButton hook already exists"
  fi

  echo "  ✨ Done"
  echo ""
done

echo "🎉 All modals patched successfully!"
