export interface ReadingItem {
  url: string
  title: string
  addedAt: string
  category: string
  position?: ReadingPosition
}

export interface ReadingPosition {
  url: string
  position: number
}

/** 分类，支持归档标记 */
export interface Category {
  name: string
  isArchived: boolean
}

export type Tab = chrome.tabs.Tab

/** 云同步配置，存储在 chrome.storage.local */
export interface SyncConfig {
  /** Cloudflare Pages 部署 URL，例如 https://xxx.pages.dev */
  apiUrl: string
  /** API 密钥，对应服务端 API_SECRET 环境变量 */
  apiSecret: string
}

/** 同步数据的完整结构（KV 存储格式） */
export interface SyncPayload {
  /** 最后更新时间戳（ms） */
  updatedAt: number
  links: ReadingItem[]
  categories: Category[]
  trash: ReadingItem[]
}

/** 同步操作结果 */
export type SyncResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string }
