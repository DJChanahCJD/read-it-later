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

export type Tab = chrome.tabs.Tab
