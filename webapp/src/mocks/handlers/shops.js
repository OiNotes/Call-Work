import { http, HttpResponse } from 'msw';
import shopsData from '../data/shops.json';

const BASE_URL = 'http://localhost:3000';

export const shopsHandlers = [
  // GET /api/shops - список всех магазинов
  http.get(`${BASE_URL}/api/shops`, () => {
    return HttpResponse.json({
      success: true,
      data: shopsData.filter((s) => s.is_active),
    });
  }),

  // GET /api/shops/active - список активных магазинов
  http.get(`${BASE_URL}/api/shops/active`, () => {
    return HttpResponse.json({
      success: true,
      data: shopsData.filter((s) => s.is_active),
    });
  }),

  // GET /api/shops/search - поиск магазинов
  http.get(`${BASE_URL}/api/shops/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.toLowerCase() || '';

    const filtered = shopsData.filter(
      (s) =>
        s.is_active &&
        (s.name.toLowerCase().includes(query) || s.description?.toLowerCase().includes(query))
    );

    return HttpResponse.json({ success: true, data: filtered });
  }),

  // GET /api/shops/my - мои магазины (owner_id === 1)
  http.get(`${BASE_URL}/api/shops/my`, () => {
    const myShops = shopsData.filter((s) => s.owner_id === 1);
    return HttpResponse.json({ success: true, data: myShops });
  }),

  // GET /api/shops/:id - один магазин
  http.get(`${BASE_URL}/api/shops/:id`, ({ params }) => {
    const shop = shopsData.find((s) => s.id === Number(params.id));

    if (!shop) {
      return HttpResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    return HttpResponse.json({ success: true, data: shop });
  }),

  // POST /api/shops - создать магазин
  http.post(`${BASE_URL}/api/shops`, async ({ request }) => {
    const body = await request.json();

    const newShop = {
      id: Math.max(...shopsData.map((s) => s.id)) + 1,
      owner_id: 1, // Mock user
      name: body.name,
      description: body.description || null,
      logo: body.logo || null,
      tier: 'FREE',
      is_active: true,
      product_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    shopsData.push(newShop);

    return HttpResponse.json({ success: true, data: newShop }, { status: 201 });
  }),

  // PUT /api/shops/:id - обновить магазин
  http.put(`${BASE_URL}/api/shops/:id`, async ({ params, request }) => {
    const body = await request.json();
    const shopIndex = shopsData.findIndex((s) => s.id === Number(params.id));

    if (shopIndex === -1) {
      return HttpResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const shop = shopsData[shopIndex];

    // Проверка прав (только владелец)
    if (shop.owner_id !== 1) {
      return HttpResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Обновляем поля
    const updatedShop = {
      ...shop,
      name: body.name !== undefined ? body.name : shop.name,
      description: body.description !== undefined ? body.description : shop.description,
      logo: body.logo !== undefined ? body.logo : shop.logo,
      updated_at: new Date().toISOString(),
    };

    shopsData[shopIndex] = updatedShop;

    return HttpResponse.json({ success: true, data: updatedShop });
  }),

  // DELETE /api/shops/:id - удалить магазин (мягкое удаление)
  http.delete(`${BASE_URL}/api/shops/:id`, ({ params }) => {
    const shopIndex = shopsData.findIndex((s) => s.id === Number(params.id));

    if (shopIndex === -1) {
      return HttpResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const shop = shopsData[shopIndex];

    // Проверка прав
    if (shop.owner_id !== 1) {
      return HttpResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Мягкое удаление
    shopsData[shopIndex] = {
      ...shop,
      is_active: false,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      message: 'Shop deleted successfully',
    });
  }),

  // GET /api/shops/:id/wallets - кошельки магазина
  http.get(`${BASE_URL}/api/shops/:id/wallets`, ({ params }) => {
    const shop = shopsData.find((s) => s.id === Number(params.id));

    if (!shop) {
      return HttpResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Проверка прав
    if (shop.owner_id !== 1) {
      return HttpResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Временно возвращаем пустые кошельки (синхронно)
    return HttpResponse.json({
      success: true,
      data: {
        wallet_btc: null,
        wallet_eth: null,
        wallet_usdt: null,
        wallet_ltc: null,
      },
    });
  }),

  // PUT /api/shops/:id/wallets - обновить кошельки
  http.put(`${BASE_URL}/api/shops/:id/wallets`, async ({ params, request }) => {
    const body = await request.json();
    const shop = shopsData.find((s) => s.id === Number(params.id));

    if (!shop) {
      return HttpResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Проверка прав
    if (shop.owner_id !== 1) {
      return HttpResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // В реальности здесь обновление через storage
    return HttpResponse.json({
      success: true,
      data: body,
    });
  }),
];
