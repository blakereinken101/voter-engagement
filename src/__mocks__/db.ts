import { vi } from 'vitest'

export function createMockPool() {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  }

  const pool = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn().mockResolvedValue(undefined),
    _mockClient: mockClient,
  }

  return pool
}

const defaultPool = createMockPool()

export const getPool = vi.fn(() => defaultPool)
export const getDb = vi.fn(async () => defaultPool)
export const logActivity = vi.fn()
export const isShuttingDown = vi.fn(() => false)

export function getMockPool() {
  return defaultPool
}
