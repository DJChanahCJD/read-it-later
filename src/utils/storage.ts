/**
 * Chrome 存储服务 - 提供类型安全的存储访问
 * @author DJCHAN
 * @created 2024-01-20
 */

// 存储键名常量
export const KEYS = {
  readLaterLinks: "readLaterLinks",
  readLaterCategories: "readLaterCategories",
  lastSelectedCategory: "lastSelectedCategory",
  readingProgress: "readingProgress",
  readLaterTrash: "readLaterTrash",
} as const

export const storage = chrome.storage.local

export type StorageKey = keyof typeof KEYS
export type StorageKeyValue = (typeof KEYS)[StorageKey]

type StorageShape = {
  [KEYS.readLaterLinks]?: unknown
  [KEYS.readLaterCategories]?: unknown
  [KEYS.lastSelectedCategory]?: unknown
  [KEYS.readingProgress]?: unknown
  [KEYS.readLaterTrash]?: unknown
}

export const storageGet = <T extends Partial<StorageShape>>(keys: string[]) =>
  storage.get(keys) as Promise<T>

export const storageSet = (items: Partial<StorageShape>) => storage.set(items)
