import { http, HttpResponse } from 'msw';
import ordersData from '../data/orders.json';
import productsData from '../data/products.json';

const BASE_URL = 'http://localhost:3000';

export const analyticsHandlers = [
  // GET /api/analytics/dashboard - общая статистика магазина
  http.get(`${BASE_URL}/api/analytics/dashboard`, ({ request }) => {
    const url = new URL(request.url);
    const shopId = url.searchParams.get('shopId') || url.searchParams.get('shop_id');

    if (!shopId) {
      return HttpResponse.json(
        { error: 'shopId is required' },
        { status: 400 }
      );
    }

    const id = Number(shopId);

    // Заказы магазина
    const shopOrders = ordersData.filter(o => o.shop_id === id);

    // Товары магазина
    const shopProducts = productsData.filter(p => p.shop_id === id);

    // Активные товары
    const activeProducts = shopProducts.filter(p => p.is_active);

    // Общая выручка (только delivered заказы)
    const totalRevenue = shopOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total_price, 0);

    // Pending заказы
    const pendingOrders = shopOrders.filter(o => o.status === 'pending').length;

    // Confirmed заказы
    const confirmedOrders = shopOrders.filter(o => o.status === 'confirmed').length;

    // Shipped заказы
    const shippedOrders = shopOrders.filter(o => o.status === 'shipped').length;

    // Delivered заказы
    const deliveredOrders = shopOrders.filter(o => o.status === 'delivered').length;

    // Cancelled заказы
    const cancelledOrders = shopOrders.filter(o => o.status === 'cancelled').length;

    // Топ 5 товаров по продажам
    const productSales = {};
    shopOrders
      .filter(o => o.status === 'delivered')
      .forEach(order => {
        if (!productSales[order.product_id]) {
          productSales[order.product_id] = {
            product_id: order.product_id,
            product_name: order.product_name,
            quantity_sold: 0,
            revenue: 0
          };
        }
        productSales[order.product_id].quantity_sold += order.quantity;
        productSales[order.product_id].revenue += order.total_price;
      });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Выручка за последние 7 дней (по дням)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayRevenue = shopOrders
        .filter(o => {
          const orderDate = new Date(o.created_at).toISOString().split('T')[0];
          return orderDate === dateStr && o.status === 'delivered';
        })
        .reduce((sum, o) => sum + o.total_price, 0);

      last7Days.push({
        date: dateStr,
        revenue: dayRevenue
      });
    }

    // Валюта (берем из первого заказа)
    const currency = shopOrders[0]?.currency || 'USD';

    return HttpResponse.json({
      success: true,
      data: {
        shop_id: id,
        totalOrders: shopOrders.length,
        totalRevenue: totalRevenue,
        currency: currency,
        activeProducts: activeProducts.length,
        totalProducts: shopProducts.length,
        pendingOrders: pendingOrders,
        confirmedOrders: confirmedOrders,
        shippedOrders: shippedOrders,
        deliveredOrders: deliveredOrders,
        cancelledOrders: cancelledOrders,
        topProducts: topProducts,
        revenueChart: last7Days
      }
    });
  }),

  // GET /api/analytics/sales - детальная аналитика продаж
  http.get(`${BASE_URL}/api/analytics/sales`, ({ request }) => {
    const url = new URL(request.url);
    const shopId = url.searchParams.get('shopId') || url.searchParams.get('shop_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const groupBy = url.searchParams.get('groupBy') || 'day'; // day, week, month

    if (!shopId) {
      return HttpResponse.json(
        { error: 'shopId is required' },
        { status: 400 }
      );
    }

    const id = Number(shopId);
    let filtered = ordersData.filter(o => o.shop_id === id && o.status === 'delivered');

    // Фильтрация по датам
    if (from) {
      filtered = filtered.filter(o => new Date(o.created_at) >= new Date(from));
    }
    if (to) {
      filtered = filtered.filter(o => new Date(o.created_at) <= new Date(to));
    }

    // Группировка
    const grouped = {};
    filtered.forEach(order => {
      let key;
      const date = new Date(order.created_at);

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekNum = Math.ceil((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        key = `${date.getFullYear()}-W${weekNum}`;
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          orders: 0,
          revenue: 0,
          quantity: 0
        };
      }

      grouped[key].orders += 1;
      grouped[key].revenue += order.total_price;
      grouped[key].quantity += order.quantity;
    });

    const sales = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));

    return HttpResponse.json({
      success: true,
      data: {
        shop_id: id,
        period: { from, to },
        groupBy: groupBy,
        sales: sales,
        totalRevenue: filtered.reduce((sum, o) => sum + o.total_price, 0),
        totalOrders: filtered.length,
        totalQuantity: filtered.reduce((sum, o) => sum + o.quantity, 0)
      }
    });
  }),

  // GET /api/analytics/products - аналитика по товарам
  http.get(`${BASE_URL}/api/analytics/products`, ({ request }) => {
    const url = new URL(request.url);
    const shopId = url.searchParams.get('shopId') || url.searchParams.get('shop_id');

    if (!shopId) {
      return HttpResponse.json(
        { error: 'shopId is required' },
        { status: 400 }
      );
    }

    const id = Number(shopId);
    const shopProducts = productsData.filter(p => p.shop_id === id);
    const shopOrders = ordersData.filter(o => o.shop_id === id && o.status === 'delivered');

    // Статистика по каждому товару
    const productStats = shopProducts.map(product => {
      const productOrders = shopOrders.filter(o => o.product_id === product.id);
      const totalSold = productOrders.reduce((sum, o) => sum + o.quantity, 0);
      const totalRevenue = productOrders.reduce((sum, o) => sum + o.total_price, 0);

      return {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        currency: product.currency,
        stock_quantity: product.stock_quantity,
        reserved_quantity: product.reserved_quantity,
        is_active: product.is_active,
        total_sold: totalSold,
        total_revenue: totalRevenue,
        orders_count: productOrders.length
      };
    });

    // Сортировка по выручке
    productStats.sort((a, b) => b.total_revenue - a.total_revenue);

    return HttpResponse.json({
      success: true,
      data: {
        shop_id: id,
        products: productStats,
        total_products: shopProducts.length,
        active_products: shopProducts.filter(p => p.is_active).length
      }
    });
  })
];
