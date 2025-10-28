import { Markup } from 'telegraf';
import { getWebAppUrl } from '../utils/webappUrl.js';
import { buttons as buttonText } from '../texts/messages.js';

/**
 * Workspace menu (restricted seller menu for workers)
 * Workers can: manage products, use AI, view sales
 * Workers cannot: wallets, subscriptions, workers management, shop settings
 */
export const workspaceMenu = () => Markup.inlineKeyboard([
  [Markup.button.webApp(buttonText.openCatalog, getWebAppUrl())],
  [Markup.button.callback(buttonText.viewSales, 'seller:sales')],
  [Markup.button.callback(buttonText.back, 'workspace:back')],
  [Markup.button.callback(buttonText.switchRole, 'role:toggle')]
]);

/**
 * Workspace shop selection keyboard
 * Shows list of shops where user is worker
 */
export const workspaceShopSelection = (shops) => {
  const buttons = shops.map(shop => 
    [Markup.button.callback(`${shop.name}`, `workspace:select:${shop.id}`)]
  );
  buttons.push([Markup.button.callback(buttonText.mainMenu, 'main_menu')]);
  return Markup.inlineKeyboard(buttons);
};

/**
 * Worker management menu (for shop owners)
 */
export const manageWorkersMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.addWorker, 'workers:add')],
  [Markup.button.callback(buttonText.listWorkers, 'workers:list')],
  [Markup.button.callback(buttonText.backToTools, 'seller:tools')]
]);

/**
 * Worker list item keyboard
 */
export const workerItemMenu = (workerId) => Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.delete, `workers:remove:${workerId}`)]
]);

/**
 * Confirm worker removal keyboard
 */
export const confirmWorkerRemoval = (workerId) => Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.delete, `workers:remove:confirm:${workerId}`)],
  [Markup.button.callback(buttonText.cancel, 'workers:list')]
]);

export default {
  workspaceMenu,
  workspaceShopSelection,
  manageWorkersMenu,
  workerItemMenu,
  confirmWorkerRemoval
};
