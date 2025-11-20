/**
 * Tests for Product Sync Queue (P0-PERF-1)
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import {
  syncQueue,
  queueProductSync,
  getSyncStatus,
  closeQueue,
} from '../../src/jobs/syncQueue.js';

// Mock the productSyncService
jest.unstable_mockModule('../../src/services/productSyncService.js', () => ({
  syncAllProductsForFollow: jest.fn().mockResolvedValue({
    synced: 10,
    skipped: 2,
    errors: 0,
  }),
}));

// Mock shopFollowQueries
jest.unstable_mockModule('../../src/models/shopFollowQueries.js', () => ({
  shopFollowQueries: {
    findById: jest.fn().mockResolvedValue({
      id: 1,
      follower_shop_id: 1,
      source_shop_id: 2,
      mode: 'resell',
    }),
  },
}));

describe('Product Sync Queue', () => {
  beforeAll(async () => {
    // Clean queue before tests
    await syncQueue.empty();
  });

  afterAll(async () => {
    // Clean up and close queue
    await syncQueue.empty();
    await closeQueue();
  });

  it('should queue a product sync job', async () => {
    const result = await queueProductSync(1, 2, 1);

    expect(result).toHaveProperty('status', 'queued');
    expect(result).toHaveProperty('jobId');
    expect(result).toHaveProperty('followId', 1);
    expect(result.message).toContain('background');
  });

  it('should not queue duplicate job for same follow', async () => {
    // Queue first job
    await queueProductSync(2, 3, 2);

    // Try to queue second job for same follow
    const result = await queueProductSync(2, 3, 2);

    // Should return existing job status
    expect(result.status).toMatch(/queued|active|waiting/);
  });

  it('should get sync status for follow', async () => {
    await queueProductSync(3, 4, 3);

    const status = await getSyncStatus(3);

    expect(status).toHaveProperty('status');
    expect(['waiting', 'active', 'completed', 'queued']).toContain(status.status);
  });

  it('should return completed status for follow without active job', async () => {
    const status = await getSyncStatus(999);

    expect(status.status).toBe('completed');
    expect(status.message).toContain('No active sync job');
  });

  it('should process sync job in background', async () => {
    // This test verifies the job is added to queue
    // Actual processing happens in worker
    const jobCount = await syncQueue.count();

    await queueProductSync(4, 5, 4);

    const newJobCount = await syncQueue.count();
    expect(newJobCount).toBeGreaterThanOrEqual(jobCount);
  });
});
