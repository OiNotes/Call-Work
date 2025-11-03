/**
 * WebSocket utility for broadcasting events to clients
 */

let wssInstance = null;

/**
 * Initialize WebSocket server instance
 * Called from server.js after WebSocket server is created
 */
export function initWebSocket(wss) {
  wssInstance = wss;
}

/**
 * Broadcast event to all connected WebSocket clients
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export function broadcast(event, data) {
  if (!wssInstance) {
    console.warn('[WebSocket] Instance not initialized, skipping broadcast');
    return;
  }

  const message = JSON.stringify({
    type: event,
    data,
    timestamp: Date.now()
  });

  let sentCount = 0;
  wssInstance.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
      sentCount++;
    }
  });

  if (sentCount > 0) {
    console.log(`[WebSocket] Broadcasted ${event} to ${sentCount} clients`);
  }
}

/**
 * Broadcast event to clients in a specific room (shop)
 * Note: Basic implementation - broadcasts to all clients
 * For production: implement room-based subscriptions
 *
 * @param {string} room - Room name (e.g., "shop:123")
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export function broadcastToRoom(room, event, data) {
  // TODO: Implement room-based broadcasting when rooms are added
  // For now, broadcast to all clients
  broadcast(event, { ...data, room });
}
