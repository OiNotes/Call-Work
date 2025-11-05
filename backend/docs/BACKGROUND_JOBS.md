# Background Jobs Documentation

## P0-PERF-1: Product Sync Background Queue

### Problem

Previously, when creating a follow relationship in "resell" mode, the API would sync all products (100+) synchronously, blocking the HTTP request for 10+ seconds. This caused:
- Poor user experience (long wait times)
- Potential request timeouts
- Server performance issues under load

### Solution

Implemented **Bull Queue** with Redis for background job processing:
- HTTP request returns immediately (202 Accepted)
- Product sync happens in background worker
- User can poll for sync status

### Architecture

```
User → POST /api/follows
         ↓
    Controller creates follow record
         ↓
    Queue sync job (instant)
         ↓
    Return 202 Accepted ← User gets response in <500ms
    
Background Worker:
    → Pick up job from queue
    → Sync products
    → Update status
    → Complete job
```

### Components

#### 1. Sync Queue (`src/jobs/syncQueue.js`)

Bull queue that handles product sync jobs:
- **Queue Name:** `product-sync`
- **Job Type:** `sync-products`
- **Redis:** localhost:6379 (configurable via env)
- **Retry:** 3 attempts with exponential backoff
- **Timeout:** 2 minutes per job

**Key Functions:**
```javascript
// Queue a sync job
await queueProductSync(followId, sourceShopId, followerShopId);

// Check sync status
const status = await getSyncStatus(followId);
// Returns: { status: 'waiting'|'active'|'completed'|'failed', progress: 0-100, ... }
```

#### 2. Sync Worker (`src/workers/syncWorker.js`)

Background process that executes sync jobs:
```bash
npm run worker        # Production
npm run worker:dev    # Development
```

**What it does:**
1. Connects to Redis queue
2. Listens for `sync-products` jobs
3. Calls `syncAllProductsForFollow(followId)`
4. Updates job progress (0% → 10% → 90% → 100%)
5. Logs results and errors

#### 3. Updated Controller (`src/controllers/shopFollowController.js`)

**Changes:**
- Creates follow record in transaction
- Queues sync job (non-blocking)
- Returns 202 status for resell mode
- Returns 201 status for monitor mode (no sync needed)

**Response Format (resell mode):**
```json
{
  "success": true,
  "data": { ...follow object... },
  "message": "Follow created. Products are syncing in background.",
  "sync_status": "pending"
}
```

#### 4. New Endpoint: Sync Status

**GET /api/follows/:id/sync-status**

Returns current sync status:
```json
{
  "success": true,
  "data": {
    "follow_id": 1,
    "status": "active",        // 'waiting', 'active', 'completed', 'failed'
    "progress": 45,            // 0-100
    "jobId": "12345",
    "createdAt": "2025-11-05T...",
    "results": {               // Only when completed
      "synced": 98,
      "skipped": 2,
      "errors": 0
    }
  }
}
```

### Environment Setup

**1. Install Redis**

```bash
# macOS
brew install redis
brew services start redis

# Docker
docker run -d -p 6379:6379 --name telegram-shop-redis redis:alpine

# Verify
redis-cli ping  # Should return "PONG"
```

**2. Configure Environment**

Add to `.env`:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

**3. Start Services**

```bash
# Terminal 1: API Server
npm run dev

# Terminal 2: Sync Worker
npm run worker
```

Or in production with PM2:
```bash
pm2 start src/server.js --name api
pm2 start src/workers/syncWorker.js --name sync-worker
pm2 logs
```

### Frontend Integration

**Before (blocking):**
```javascript
const response = await api.post('/follows', { mode: 'resell', ... });
// User waits 10+ seconds
```

**After (non-blocking):**
```javascript
const response = await api.post('/follows', { mode: 'resell', ... });

if (response.status === 202) {
  // Show "Syncing products..." message
  pollSyncStatus(response.data.data.id);
}

async function pollSyncStatus(followId) {
  const interval = setInterval(async () => {
    const status = await api.get(`/follows/${followId}/sync-status`);
    
    if (status.data.data.status === 'completed') {
      clearInterval(interval);
      // Show "Sync complete" message
      // Refresh follow details
    }
    
    if (status.data.data.status === 'failed') {
      clearInterval(interval);
      // Show error message
    }
    
    // Update progress bar
    updateProgress(status.data.data.progress);
  }, 2000); // Poll every 2 seconds
}
```

### Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Response Time | 10-15s | <500ms | **95% faster** |
| User Wait Time | 10-15s | Instant | **Background** |
| Concurrent Requests | Blocked | Non-blocking | **No limit** |
| Timeout Risk | High | None | **Eliminated** |

### Monitoring

**Check Queue Status:**
```bash
# Redis CLI
redis-cli
> KEYS bull:product-sync:*
> LLEN bull:product-sync:waiting
> LLEN bull:product-sync:active
```

**Check Worker Logs:**
```bash
tail -f backend/logs/combined-*.log | grep SyncQueue
```

**Expected Log Output:**
```
[SyncQueue] Queued product sync job for follow 123
[SyncQueue] Starting product sync for follow 123
[SyncQueue] Completed product sync for follow 123
[SyncQueue] Job 456 completed successfully - synced: 98, errors: 0
```

### Error Handling

**Automatic Retry:**
- Failed jobs retry 3 times with exponential backoff
- Backoff: 2s → 4s → 8s
- After 3 failures, job marked as failed

**Failed Job Recovery:**
```javascript
// Get failed jobs
const failed = await syncQueue.getFailed();

// Retry specific job
await failedJob.retry();

// Or clean failed jobs older than 7 days
await syncQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
```

### Testing

**Unit Tests:**
```bash
npm test -- syncQueue.test.js
```

**Manual Test:**
1. Start worker: `npm run worker`
2. Create follow via API (resell mode)
3. Verify 202 response
4. Check sync status endpoint
5. Verify products synced in database

**Load Test:**
```bash
# Create 10 follows simultaneously
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/follows \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"mode":"resell","followerShopId":1,"sourceShopId":'$i',"markupPercentage":20}' &
done

# All should return 202 in <500ms
```

### Troubleshooting

**Worker not processing jobs:**
```bash
# Check Redis connection
redis-cli ping

# Check worker process
ps aux | grep syncWorker

# Restart worker
pm2 restart sync-worker
```

**Jobs stuck in queue:**
```bash
# Clean stuck jobs
redis-cli
> DEL bull:product-sync:active
> DEL bull:product-sync:stalled
```

**High memory usage:**
```bash
# Clean completed jobs (keep last 100)
# Clean failed jobs (keep last 500)
# This is configured in syncQueue.js defaultJobOptions
```

### Future Improvements

- [ ] Add job priority (premium users first)
- [ ] Implement job progress updates via WebSocket
- [ ] Add Bull Board UI for queue monitoring
- [ ] Scale workers horizontally (multiple instances)
- [ ] Add job scheduling (periodic re-sync)

---

**Last Updated:** 2025-11-05  
**Issue:** P0-PERF-1  
**Status:** ✅ Implemented
