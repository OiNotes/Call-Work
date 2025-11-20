import { Markup } from 'telegraf';
import { buttons as buttonText } from '../texts/messages.js';

// Back button
export const backButton = Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.back, 'back')],
]);

// Cancel button
export const cancelButton = Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.cancel, 'cancel_scene')],
]);

// Main menu button
export const mainMenuButton = Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.mainMenu, 'main_menu')],
]);

// Success with main menu
export const successButtons = Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.mainMenu, 'main_menu')],
]);
