import { Markup } from 'telegraf';
import { getWebAppUrl } from '../utils/webappUrl.js';
import { buttons as buttonText } from '../texts/messages.js';

// Seller menu (with active shop) - redesigned hierarchical structure
export const sellerMenu = (activeOrdersCount = 0) => Markup.inlineKeyboard([
  [Markup.button.webApp(buttonText.openCatalog, getWebAppUrl())],
  [Markup.button.callback(
    `${buttonText.activeOrders}${activeOrdersCount > 0 ? ` (${activeOrdersCount})` : ''}`,
    'seller:active_orders'
  )],
  [Markup.button.callback(buttonText.orderHistory, 'seller:order_history')],
  [Markup.button.callback(buttonText.tools, 'seller:tools')],
  [Markup.button.callback(buttonText.switchRole, 'role:toggle')]
]);

// Seller Tools Submenu - advanced features (Wallets, Follows, Workers)
export const sellerToolsMenu = (isOwner = false) => {
  const buttons = [
    [Markup.button.callback(buttonText.manageWallets, 'seller:wallets')],
    [Markup.button.callback(buttonText.manageFollows, 'seller:follows')]
  ];

  if (isOwner) {
    buttons.push([Markup.button.callback(buttonText.manageWorkers, 'seller:workers')]);
  }

  if (isOwner) {
    buttons.push([Markup.button.callback(buttonText.changeChannel, 'seller:migrate_channel')]);
  }
  buttons.push([Markup.button.callback(buttonText.backToMenu, 'seller:menu')]);

  return Markup.inlineKeyboard(buttons);
};

// Products menu (inside "Товары" screen) - minimalist
export const productsMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.addProduct, 'seller:add_product')],
  [Markup.button.callback(buttonText.backToTools, 'seller:tools')]
]);

// Follows menu - minimalist
export const followsMenu = (hasFollows = false) => Markup.inlineKeyboard([
  [Markup.button.callback(hasFollows ? buttonText.addFollowMore : buttonText.addFollow, 'follows:create')],
  [Markup.button.callback(buttonText.backToTools, 'seller:tools')]
]);

// Follow detail menu
export const followDetailMenu = (followId, mode = 'monitor') => {
  const modeButtonText = mode === 'resell'
    ? 'Переключить на Мониторинг'
    : 'Переключить на Перепродажу';

  return Markup.inlineKeyboard([
    [Markup.button.callback(buttonText.editMarkup, `follow_edit:${followId}`)],
    [Markup.button.callback(modeButtonText, `follow_mode:${followId}`)],
    [Markup.button.callback(buttonText.delete, `follow_delete:${followId}`)],
    [Markup.button.callback(buttonText.backToFollows, 'follows:list')],
    [Markup.button.callback(buttonText.backToTools, 'seller:tools')]
  ]);
};

// Seller menu (no shop - need registration) - minimalist
export const sellerMenuNoShop = Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.createShop, 'seller:create_shop')],
  [Markup.button.callback(buttonText.mainMenu, 'main_menu')]
]);

// Subscription status menu
export const subscriptionStatusMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.backToTools, 'seller:tools')]
]);
