import { createClient } from 'redis';


/**
 * Chrome 存储服务 - 提供类型安全的存储访问
 * @author DJCHAN
 * @created 2024-01-20
 */

// 存储键名常量
export const KEYS = {
    readLaterLinks: 'readLaterLinks',
    readLaterCategories: 'readLaterCategories',
    lastSelectedCategory: 'lastSelectedCategory',
    readingProgress: 'readingProgress'
} as const;

// 导出存储实例
export const storage = chrome.storage.local;

// 导出类型
export type StorageKey = keyof typeof KEYS;
export type StorageKeyValue = typeof KEYS[StorageKey];

