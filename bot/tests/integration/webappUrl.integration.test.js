import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sellerMenu } from '../../src/keyboards/seller.js';
import { buyerMenu, buyerMenuNoShop } from '../../src/keyboards/buyer.js';
import { workspaceMenu } from '../../src/keyboards/workspace.js';

describe('WebApp URL Integration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.WEBAPP_URL;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.WEBAPP_URL = originalEnv;
    } else {
      delete process.env.WEBAPP_URL;
    }
  });

  it('seller menu should use dynamic WEBAPP_URL', () => {
    const testUrl = 'https://test123.ngrok-free.app';
    process.env.WEBAPP_URL = testUrl;

    const menu = sellerMenu('Test Shop');
    const webAppButton = menu.reply_markup.inline_keyboard[0][0];

    expect(webAppButton.web_app.url).toBe(testUrl);
  });

  it('buyer menu should use dynamic WEBAPP_URL', () => {
    const testUrl = 'https://test456.ngrok-free.app';
    process.env.WEBAPP_URL = testUrl;

    const menu = buyerMenu;
    const webAppButton = menu.reply_markup.inline_keyboard[0][0];

    expect(webAppButton.web_app.url).toBe(testUrl);
  });

  it('buyer menu (no shop) should use dynamic WEBAPP_URL', () => {
    const testUrl = 'https://test789.ngrok-free.app';
    process.env.WEBAPP_URL = testUrl;

    const menu = buyerMenuNoShop;
    const webAppButton = menu.reply_markup.inline_keyboard[0][0];

    expect(webAppButton.web_app.url).toBe(testUrl);
  });

  it('workspace menu should use dynamic WEBAPP_URL', () => {
    const testUrl = 'https://workspace.ngrok-free.app';
    process.env.WEBAPP_URL = testUrl;

    const menu = workspaceMenu('Test Shop');
    const webAppButton = menu.reply_markup.inline_keyboard[0][0];

    expect(webAppButton.web_app.url).toBe(testUrl);
  });

  it('all menus should update when WEBAPP_URL changes', () => {
    // First URL
    process.env.WEBAPP_URL = 'https://first-url.ngrok-free.app';
    const menu1 = sellerMenu('Shop');
    expect(menu1.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://first-url.ngrok-free.app');

    // Change URL (simulating ngrok restart)
    process.env.WEBAPP_URL = 'https://second-url.ngrok-free.app';
    const menu2 = sellerMenu('Shop');
    expect(menu2.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://second-url.ngrok-free.app');
  });

  it('should throw error if WEBAPP_URL is missing', () => {
    delete process.env.WEBAPP_URL;

    expect(() => sellerMenu('Shop')).toThrow('WEBAPP_URL is not configured in environment');
    expect(() => buyerMenu).toThrow('WEBAPP_URL is not configured in environment');
  });

  it('should throw error if WEBAPP_URL is not HTTPS', () => {
    process.env.WEBAPP_URL = 'http://insecure.com';

    expect(() => sellerMenu('Shop')).toThrow('WEBAPP_URL must use HTTPS');
  });
});
