import { ALL_CATEGORIE, defaultCategories } from "@/utils/common"
import { KEYS, storageGet, storageSet } from "@/utils/storage"
import type { ReadingItem } from "@/utils/typing"

export interface ReadLaterState {
  readingList: ReadingItem[]
  categories: string[]
  selectedCategory: string
}

interface StoragePayload {
  readLaterLinks?: ReadingItem[]
  readLaterCategories?: string[]
  lastSelectedCategory?: string
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

export const normalizeCategories = (categories?: string[]) => {
  const normalized = categories?.filter(Boolean) || []

  if (normalized.length === 0) {
    return [...defaultCategories]
  }

  return normalized.includes(ALL_CATEGORIE)
    ? [ALL_CATEGORIE, ...normalized.filter((category) => category !== ALL_CATEGORIE)]
    : [ALL_CATEGORIE, ...normalized]
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

export const loadReadLaterState = async (): Promise<ReadLaterState> => {
  const result = await storageGet<StoragePayload>([
    KEYS.readLaterLinks,
    KEYS.readLaterCategories,
    KEYS.lastSelectedCategory,
  ])

  const readingList = normalizeReadingList(result.readLaterLinks)
  const categories = normalizeCategories(result.readLaterCategories)
  const selectedCategory =
    result.lastSelectedCategory && categories.includes(result.lastSelectedCategory)
      ? result.lastSelectedCategory
      : ALL_CATEGORIE

  return {
    readingList,
    categories,
    selectedCategory,
  }
}

export const saveReadingList = async (readingList: ReadingItem[]) =>
  storageSet({ [KEYS.readLaterLinks]: readingList })

export const saveCategories = async (categories: string[]) =>
  storageSet({ [KEYS.readLaterCategories]: normalizeCategories(categories) })

export const saveSelectedCategory = async (category: string) =>
  storageSet({ [KEYS.lastSelectedCategory]: category })
