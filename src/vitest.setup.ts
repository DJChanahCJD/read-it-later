import { vi } from "vitest"

const mockStorage = {
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(undefined),
}

globalThis.chrome = {
  storage: {
    local: mockStorage,
  },
} as unknown as typeof chrome
