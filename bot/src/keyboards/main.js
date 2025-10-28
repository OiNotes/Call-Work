import { Markup } from 'telegraf';
import { buttons as buttonText } from '../texts/messages.js';

/**
 * Main menu - role selection
 * @param {boolean} showWorkspace - Show workspace button if user is worker
 */
export const mainMenu = (showWorkspace = false) => {
  const rows = [
    [
      Markup.button.callback(buttonText.buyerRole, 'role:buyer'),
      Markup.button.callback(buttonText.sellerRole, 'role:seller')
    ]
  ];

  if (showWorkspace) {
    rows.push([Markup.button.callback(buttonText.workspace, 'role:workspace')]);
  }

  return Markup.inlineKeyboard(rows);
};

// Default main menu (backward compatible)
export const mainMenuDefault = Markup.inlineKeyboard([
  [
    Markup.button.callback(buttonText.buyerRole, 'role:buyer'),
    Markup.button.callback(buttonText.sellerRole, 'role:seller')
  ]
]);
