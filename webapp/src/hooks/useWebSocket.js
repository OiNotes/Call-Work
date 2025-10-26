import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';

/**
 * WebSocket hook for real-time updates
 * Connects to backend WebSocket server and handles incoming messages
 */
export const useWebSocket = () => {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const {
    refetchProducts,
    updateOrderStatus,
    incrementSubscribers
  } = useStore();

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const wsUrl = API_URL.replace(/^http/, 'ws').replace(/\/api$/, '');

    function connect() {
      // Prevent multiple connections
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
      }

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✅ WebSocket connected');
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;

          // Clear reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected', {
            code: event.code,
            reason: event.reason
          });
          setIsConnected(false);
          wsRef.current = null;

          // Exponential backoff for reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;

          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setIsConnected(false);

        // Retry connection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    }

    function handleWebSocketMessage(data) {
      console.log('📨 WebSocket message:', data);

      switch (data.type) {
        case 'connected':
          console.log('✅ WebSocket welcome:', data.message);
          break;

        case 'pong':
          // Heartbeat response
          break;

        case 'product_added':
          console.log('🆕 Product added:', data);
          if (data.shopId) {
            refetchProducts(data.shopId);
          }
          break;

        case 'product_updated':
          console.log('✏️ Product updated:', data);
          if (data.shopId) {
            refetchProducts(data.shopId);
          }
          break;

        case 'product_deleted':
          console.log('🗑️ Product deleted:', data);
          if (data.shopId) {
            refetchProducts(data.shopId);
          }
          break;

        case 'order_status':
          console.log('📦 Order status update:', data);
          if (data.orderId && data.status) {
            updateOrderStatus(data.orderId, data.status);
          }
          break;

        case 'new_subscriber':
          console.log('👤 New subscriber:', data);
          if (data.shopId) {
            incrementSubscribers(data.shopId);
          }
          break;

        case 'shop_updated':
          console.log('🏪 Shop updated:', data);
          // Could refetch shop data here
          break;

        default:
          console.log('❓ Unknown WebSocket message type:', data.type);
      }
    }

    // Start connection
    connect();

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds

    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [refetchProducts, updateOrderStatus, incrementSubscribers]);

  return { isConnected };
};
