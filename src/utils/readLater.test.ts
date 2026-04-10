import {
  ALL_CATEGORIE,
} from "@/utils/common"
import {
  filterReadingList,
  loadReadLaterState,
  moveReadingItem,
  normalizeCategories,
  normalizeReadingItem,
  normalizeReadingList,
  replaceReadingItem,
  sortReadingListByDate,
} from "@/utils/readLater"
import * as storageModule from "@/utils/storage"
import type { ReadingItem } from "@/utils/typing"

const sampleList: ReadingItem[] = [
  {
    url: "https://a.example.com",
    title: "Alpha Article",
    addedAt: "2026-04-01T00:00:00.000Z",
    category: ALL_CATEGORIE,
  },
  {
    url: "https://b.example.com/docs",
    title: "Beta Docs",
    addedAt: "2026-04-03T00:00:00.000Z",
    category: "工作",
  },
  {
    url: "https://c.example.com/blog",
    title: "Gamma Blog",
    addedAt: "2026-04-02T00:00:00.000Z",
    category: "收藏",
  },
]

describe("readLater helpers", () => {
  it("normalizes a reading item with defaults", () => {
    const item = normalizeReadingItem({ url: "https://example.com" })

    expect(item.url).toBe("https://example.com")
    expect(item.title).toBe("https://example.com")
    expect(item.category).toBe(ALL_CATEGORIE)
    expect(typeof item.addedAt).toBe("string")
  })

  it("filters invalid items and normalizes list defaults", () => {
    const list = normalizeReadingList([
      { url: "https://example.com", title: "Valid" },
      { title: "Missing URL" },
    ])

    expect(list).toHaveLength(1)
    expect(list[0].category).toBe(ALL_CATEGORIE)
  })

  it(`keeps ${ALL_CATEGORIE} as the first category`, () => {
    expect(normalizeCategories(undefined)).toEqual([])
    expect(normalizeCategories(["工作", ALL_CATEGORIE, "收藏"])).toEqual([
      { name: "工作", isArchived: false },
      { name: "收藏", isArchived: false },
    ])
  })

  it("filters by search term and category", () => {
    expect(filterReadingList(sampleList, "docs", ALL_CATEGORIE)).toEqual([sampleList[1]])
    expect(filterReadingList(sampleList, "example.com/blog", "收藏")).toEqual([sampleList[2]])
    expect(filterReadingList(sampleList, "", "工作")).toEqual([sampleList[1]])
  })

  it("sorts by date in both directions", () => {
    expect(sortReadingListByDate(sampleList, "asc").map((item) => item.url)).toEqual([
      "https://a.example.com",
      "https://c.example.com/blog",
      "https://b.example.com/docs",
    ])
    expect(sortReadingListByDate(sampleList, "desc").map((item) => item.url)).toEqual([
      "https://b.example.com/docs",
      "https://c.example.com/blog",
      "https://a.example.com",
    ])
  })

  it("replaces only the matching item", () => {
    const updated = replaceReadingItem(sampleList, "https://b.example.com/docs", (item) => ({
      ...item,
      title: "Updated Title",
    }))

    expect(updated[1].title).toBe("Updated Title")
    expect(updated[0].title).toBe(sampleList[0].title)
  })

  it("moves an item before the target item", () => {
    const moved = moveReadingItem(sampleList, "https://c.example.com/blog", "https://a.example.com")

    expect(moved.map((item) => item.url)).toEqual([
      "https://c.example.com/blog",
      "https://a.example.com",
      "https://b.example.com/docs",
    ])
  })

  it("returns the original list when source item does not exist", () => {
    expect(moveReadingItem(sampleList, "https://missing.example.com")).toEqual(sampleList)
  })

  it("moves an item to the end when target is missing", () => {
    const moved = moveReadingItem(sampleList, "https://a.example.com", "https://missing.example.com")

    expect(moved.map((item) => item.url)).toEqual([
      "https://b.example.com/docs",
      "https://c.example.com/blog",
      "https://a.example.com",
    ])
  })
})

describe("loadReadLaterState", () => {
  it("builds a stable default state from storage", async () => {
    const storageGetSpy = vi
      .spyOn(storageModule, "storageGet")
      .mockResolvedValue({
        readLaterLinks: [{ url: "https://example.com" }],
        readLaterCategories: ["工作"],
        lastSelectedCategory: "失效分类",
      })

    await expect(loadReadLaterState()).resolves.toEqual({
      readingList: [
        {
          url: "https://example.com",
          title: "https://example.com",
          addedAt: expect.any(String),
          category: ALL_CATEGORIE,
          position: undefined,
        },
      ],
      categories: [
        { name: "工作", isArchived: false },
      ],
      selectedCategory: ALL_CATEGORIE,
      trash: [],
    })

    storageGetSpy.mockRestore()
  })
})
