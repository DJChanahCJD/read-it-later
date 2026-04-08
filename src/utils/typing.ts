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
