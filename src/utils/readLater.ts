import { ALL_CATEGORIE, defaultCategories } from "@/utils/common"
import { KEYS, storageGet, storageSet } from "@/utils/storage"
import type { Category, ReadingItem } from "@/utils/typing"

const TRASH_MAX = 100

export interface ReadLaterState {
  readingList: ReadingItem[]
  categories: Category[]
  selectedCategory: string
  trash: ReadingItem[]
}

interface StoragePayload {
  readLaterLinks?: ReadingItem[]
  readLaterCategories?: unknown[]
  lastSelectedCategory?: string
  readLaterTrash?: ReadingItem[]
}

export const normalizeReadingItem = (item: Partial<ReadingItem>): ReadingItem => ({
  url: item.url || "",
  title: item.title || item.url || "",
  addedAt: item.addedAt || new Date().toISOString(),
  category: item.category || ALL_CATEGORIE,
  position: item.position,
})

export const normalizeReadingList = (items: Partial<ReadingItem>[] = []) =>
  items
    .filter((item): item is Partial<ReadingItem> => Boolean(item?.url))
    .map(normalizeReadingItem)

/**
 * 将存储中的分类数据（旧版 string[] 或新版 Category[]）统一规范化为 Category[]
 * 旧版数据自动迁移，不丢失任何分类
 */
export const normalizeCategories = (raw?: unknown[]): Category[] => {
  const items = raw?.filter(Boolean) || []

  // 旧版 string[] 兼容迁移
  const categories: Category[] = items.map((item) => {
    if (typeof item === "string") {
      return { name: item, isArchived: false }
    }
    const c = item as Category
    return { name: c.name || "", isArchived: Boolean(c.isArchived) }
  }).filter((c) => c.name && c.name !== ALL_CATEGORIE)

  if (categories.length === 0) {
    return defaultCategories.filter((n) => n !== ALL_CATEGORIE).map((n) => ({ name: n, isArchived: false }))
  }

  return categories
}

export const filterReadingList = (links: ReadingItem[], term: string, category: string) => {
  const normalizedTerm = term.trim().toLowerCase()

  return links.filter((item) => {
    const matchesTerm =
      normalizedTerm.length === 0 ||
      item.title.toLowerCase().includes(normalizedTerm) ||
      item.url.toLowerCase().includes(normalizedTerm)

    const matchesCategory = category === ALL_CATEGORIE || item.category === category

    return matchesTerm && matchesCategory
  })
}

export const sortReadingListByDate = (links: ReadingItem[], sortOrder: "asc" | "desc") =>
  [...links].sort((a, b) => {
    const dateA = new Date(a.addedAt).getTime()
    const dateB = new Date(b.addedAt).getTime()
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA
  })

export const createReadingItem = (url: string, title: string, category = ALL_CATEGORIE): ReadingItem => ({
  url,
  title: title || url,
  addedAt: new Date().toISOString(),
  category,
})

export const replaceReadingItem = (
  links: ReadingItem[],
  url: string,
  updater: (item: ReadingItem) => ReadingItem,
) => links.map((item) => (item.url === url ? updater(item) : item))

export const moveReadingItem = (links: ReadingItem[], sourceUrl: string, targetUrl?: string) => {
  const sourceIndex = links.findIndex((item) => item.url === sourceUrl)

  if (sourceIndex === -1) {
    return links
  }

  const next = [...links]
  const [moved] = next.splice(sourceIndex, 1)

  if (!targetUrl) {
    next.push(moved)
    return next
  }

  const targetIndex = next.findIndex((item) => item.url === targetUrl)

  if (targetIndex === -1) {
    next.push(moved)
    return next
  }

  next.splice(targetIndex, 0, moved)
  return next
}

/** 将条目加入回收站，超出上限时 FIFO 清除最旧的 */
export const addToTrash = (trash: ReadingItem[], item: ReadingItem): ReadingItem[] => {
  const filtered = trash.filter((t) => t.url !== item.url)
  const next = [...filtered, item]
  return next.length > TRASH_MAX ? next.slice(next.length - TRASH_MAX) : next
}

/** 从阅读列表中移除指定 URL（配合 addToTrash 实现软删除） */
export const softDeleteItem = (list: ReadingItem[], url: string): ReadingItem[] =>
  list.filter((item) => item.url !== url)

/** 从回收站还原条目到阅读列表 */
export const restoreFromTrash = (
  trash: ReadingItem[],
  list: ReadingItem[],
  url: string,
): { trash: ReadingItem[]; list: ReadingItem[] } => {
  const item = trash.find((t) => t.url === url)
  if (!item) return { trash, list }

  return {
    trash: trash.filter((t) => t.url !== url),
    list: list.some((l) => l.url === url) ? list : [item, ...list],
  }
}

export const loadReadLaterState = async (): Promise<ReadLaterState> => {
  const result = await storageGet<StoragePayload>([
    KEYS.readLaterLinks,
    KEYS.readLaterCategories,
    KEYS.lastSelectedCategory,
    KEYS.readLaterTrash,
  ])

  const readingList = normalizeReadingList(result.readLaterLinks)
  const categories = normalizeCategories(result.readLaterCategories)
  const trash = normalizeReadingList(result.readLaterTrash)

  // 选中分类：存储值需在未归档分类中存在，否则回退到 ALL_CATEGORIE
  const activeCategoryNames = categories.filter((c) => !c.isArchived).map((c) => c.name)
  const selectedCategory =
    result.lastSelectedCategory && activeCategoryNames.includes(result.lastSelectedCategory)
      ? result.lastSelectedCategory
      : ALL_CATEGORIE

  return {
    readingList,
    categories,
    selectedCategory,
    trash,
  }
}

export const saveReadingList = async (readingList: ReadingItem[]) =>
  storageSet({ [KEYS.readLaterLinks]: readingList })

/** 保存分类列表，自动过滤虚拟的「全部」分类 */
export const saveCategories = async (categories: Category[]) =>
  storageSet({ [KEYS.readLaterCategories]: categories.filter((c) => c.name !== ALL_CATEGORIE) })

export const saveSelectedCategory = async (category: string) =>
  storageSet({ [KEYS.lastSelectedCategory]: category })

export const saveTrash = async (trash: ReadingItem[]) =>
  storageSet({ [KEYS.readLaterTrash]: trash })
