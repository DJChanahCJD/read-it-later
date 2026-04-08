"use client"

import React from "react"
import { useEffect, useRef, useState, type DragEvent } from "react"
import "./Popup.css"
import "@/assets/fonts/remixicon.css"
import { ReadingCard } from "./components/ReadingCard"
import { ALL_CATEGORIE, CONTEXT_MENU_ACTION, MESSAGE_TYPE, extractHostname, formatDate } from "@/utils/common"
import {
  addToTrash,
  createReadingItem,
  filterReadingList,
  loadReadLaterState,
  moveReadingItem,
  replaceReadingItem,
  saveCategories,
  saveReadingList,
  saveSelectedCategory,
  saveTrash,
  softDeleteItem,
} from "@/utils/readLater"
import { KEYS } from "@/utils/storage"
import type { Category, ReadingItem } from "@/utils/typing"

const Popup: React.FC = () => {
  const [readingList, setReadingList] = useState<ReadingItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIE)
  const [trash, setTrash] = useState<ReadingItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [draggedItemUrl, setDraggedItemUrl] = useState<string | null>(null)
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null)
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const syncState = async () => {
      const nextState = await loadReadLaterState()
      setReadingList(nextState.readingList)
      setCategories(nextState.categories)
      setSelectedCategory(nextState.selectedCategory)
      setTrash(nextState.trash)
    }

    syncState()

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local") {
        return
      }

      if (
        changes[KEYS.readLaterLinks] ||
        changes[KEYS.readLaterCategories] ||
        changes[KEYS.lastSelectedCategory] ||
        changes[KEYS.readLaterTrash]
      ) {
        syncState().catch((error) => console.error("Failed to sync popup state:", error))
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    searchInputRef.current?.focus()

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  useEffect(() => {
    if (editingCategoryIndex !== null) {
      editInputRef.current?.focus()
    }
  }, [editingCategoryIndex])

  /** 当前可见分类（未归档的），用于 Tab 渲染 */
  const visibleCategories = categories.filter((c) => !c.isArchived)

  /** 全部分类 name 列表（含已归档，用于卡片分类选择器） */
  const allCategoryNames = categories.map((c) => c.name)

  /** 当前 Tab 对应的分类 name 列表（不含归档） */
  const visibleCategoryNames = [ALL_CATEGORIE, ...visibleCategories.map((c) => c.name)]

  const filteredList = filterReadingList(readingList, searchTerm, selectedCategory)

  const persistReadingList = async (nextList: ReadingItem[]) => {
    setReadingList(nextList)
    await saveReadingList(nextList)
  }

  const persistCategories = async (nextCategories: Category[]) => {
    setCategories(nextCategories)
    await saveCategories(nextCategories)
  }

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
  }

  const handleCategorySelect = async (category: string) => {
    setSelectedCategory(category)
    await saveSelectedCategory(category)
  }

  /** 软删除：将条目移入回收站 */
  const handleDelete = async (url: string) => {
    const item = readingList.find((i) => i.url === url)
    if (!item) return

    const newTrash = addToTrash(trash, item)
    const newList = softDeleteItem(readingList, url)

    setTrash(newTrash)
    await Promise.all([persistReadingList(newList), saveTrash(newTrash)])

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0]
      if (currentTab?.url === url) {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPE.UPDATE_CONTEXT_MENU,
          action: CONTEXT_MENU_ACTION.REMOVE,
        })
      }
    })
  }

  const handleEdit = async (url: string, newTitle: string) => {
    await persistReadingList(replaceReadingItem(readingList, url, (item) => ({ ...item, title: newTitle })))
  }

  const handleChangeCategory = async (url: string, category: string) => {
    await persistReadingList(replaceReadingItem(readingList, url, (item) => ({ ...item, category })))
  }

  const addCurrentPage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTab = tabs[0]
      const url = currentTab?.url || ""
      const title = currentTab?.title || url

      if (!url) {
        return
      }

      const existingItem = readingList.find((item) => item.url === url)
      if (!existingItem) {
        const category = selectedCategory === ALL_CATEGORIE ? ALL_CATEGORIE : selectedCategory
        const nextList = [createReadingItem(url, title, category), ...readingList]
        await persistReadingList(nextList)
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPE.UPDATE_CONTEXT_MENU,
          action: CONTEXT_MENU_ACTION.ADD,
        })
        return
      }

      if (existingItem.category !== selectedCategory) {
        await handleChangeCategory(url, selectedCategory)
      }
    })
  }

  const handleDragStart = (_event: DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItemUrl(filteredList[index]?.url || null)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    event.currentTarget.classList.add("drag-over")
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove("drag-over")
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>, dropIndex: number) => {
    event.preventDefault()
    event.currentTarget.classList.remove("drag-over")

    if (!draggedItemUrl) {
      return
    }

    const targetUrl = filteredList[dropIndex]?.url
    if (draggedItemUrl === targetUrl) {
      return
    }

    const nextList = moveReadingItem(readingList, draggedItemUrl, targetUrl)
    await persistReadingList(nextList)
  }

  const handleDragEnd = (event: DragEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove("dragging")
    setDraggedItemUrl(null)
    document.querySelectorAll(".card").forEach((card) => {
      ;(card as HTMLElement).classList.remove("drag-over")
    })
  }

  const handleCategoryDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    const category = visibleCategoryNames[index]
    if (category === ALL_CATEGORIE) {
      event.preventDefault()
      return
    }

    setDraggedCategory(category)
    event.currentTarget.classList.add("dragging")
    event.dataTransfer.effectAllowed = "move"
  }

  const handleCategoryDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault()
    if (visibleCategoryNames[index] === ALL_CATEGORIE) {
      return
    }
    event.currentTarget.classList.add("drag-over")
  }

  const handleCategoryDrop = async (event: DragEvent<HTMLDivElement>, dropIndex: number) => {
    event.preventDefault()
    event.currentTarget.classList.remove("drag-over")

    if (draggedCategory) {
      if (dropIndex === 0) {
        setDraggedCategory(null)
        return
      }

      // 在完整 categories（含归档）中操作排序，仅移动未归档分类
      const nextCategories = [...categories]
      const sourceIndex = nextCategories.findIndex((c) => c.name === draggedCategory)
      const targetName = visibleCategoryNames[dropIndex]
      const targetIndex = nextCategories.findIndex((c) => c.name === targetName)

      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        setDraggedCategory(null)
        return
      }

      const [moved] = nextCategories.splice(sourceIndex, 1)
      nextCategories.splice(targetIndex, 0, moved)
      await persistCategories(nextCategories)
      setDraggedCategory(null)
      return
    }

    if (draggedItemUrl) {
      await handleChangeCategory(draggedItemUrl, visibleCategoryNames[dropIndex])
    }
  }

  const handleCategoryDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove("drag-over")
  }

  const handleCategoryDragEnd = (event: DragEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove("dragging")
    setDraggedCategory(null)
    document.querySelectorAll(".category-tab").forEach((tab) => {
      ;(tab as HTMLElement).classList.remove("drag-over")
    })
  }

  const handleAddCategory = async () => {
    const newCategoryName = `新分类${categories.length}`
    const nextCategories: Category[] = [...categories, { name: newCategoryName, isArchived: false }]
    await persistCategories(nextCategories)
    // 在 visibleCategoryNames 中找到新分类的索引（含 ALL_CATEGORIE offset）
    setEditingCategoryIndex(visibleCategoryNames.length) // 新分类追加在末尾
    setEditingCategoryName(newCategoryName)
  }

  const handleStartEdit = (index: number, categoryName: string) => {
    if (categoryName === ALL_CATEGORIE) {
      return
    }

    setEditingCategoryIndex(index)
    setEditingCategoryName(categoryName)
  }

  const handleSaveEdit = async () => {
    if (editingCategoryIndex === null) {
      return
    }

    const nextName = editingCategoryName.trim()
    const currentName = visibleCategoryNames[editingCategoryIndex]
    if (!nextName || categories.some((c, _) => c.name !== currentName && c.name === nextName)) {
      setEditingCategoryIndex(null)
      return
    }

    const nextCategories = categories.map((c) =>
      c.name === currentName ? { ...c, name: nextName } : c,
    )
    const nextList = readingList.map((item) =>
      item.category === currentName ? { ...item, category: nextName } : item,
    )

    setSelectedCategory((current) => (current === currentName ? nextName : current))
    setEditingCategoryIndex(null)
    await Promise.all([persistCategories(nextCategories), persistReadingList(nextList), saveSelectedCategory(nextName)])
  }

  return (
    <div className="container">
      <div className="search-container">
        <div className="search-box">
          <i className="ri-search-line search-icon"></i>
          <input
            type="text"
            ref={searchInputRef}
            value={searchTerm}
            onChange={handleSearch}
            placeholder="搜索链接..."
          />
        </div>
        <button className="add-btn" title="添加当前页面" onClick={addCurrentPage}>
          <i className="ri-add-line"></i>
        </button>
        <button className="setting-btn" title="设置" onClick={() => chrome.tabs.create({ url: "options.html" })}>
          <i className="ri-settings-line"></i>
        </button>
      </div>

      {visibleCategoryNames.length > 1 && (
        <div className="categories-container">
          {visibleCategoryNames.map((categoryName, index) => (
            <div
              key={categoryName}
              className={`category-tab ${selectedCategory === categoryName ? "active" : ""} ${
                categoryName === ALL_CATEGORIE ? "no-drag" : ""
              }`}
              onClick={() => void handleCategorySelect(categoryName)}
              onDoubleClick={() => handleStartEdit(index, categoryName)}
              draggable={categoryName !== ALL_CATEGORIE && editingCategoryIndex === null}
              onDragStart={(event) => handleCategoryDragStart(event, index)}
              onDragOver={(event) => handleCategoryDragOver(event, index)}
              onDragLeave={handleCategoryDragLeave}
              onDrop={(event) => void handleCategoryDrop(event, index)}
              onDragEnd={handleCategoryDragEnd}
              title="双击编辑分类"
            >
              {editingCategoryIndex === index ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingCategoryName}
                  onChange={(event) => setEditingCategoryName(event.target.value)}
                  onBlur={() => void handleSaveEdit()}
                  className="category-edit-input"
                  draggable="false"
                />
              ) : (
                <span className="category-name">{categoryName}</span>
              )}
            </div>
          ))}
          <button className="category-add-btn" onClick={() => void handleAddCategory()} title="添加新分类">
            <i className="ri-add-line"></i>
          </button>
        </div>
      )}

      <div className="card-list">
        {filteredList.length === 0 ? (
          <div className="empty-state">
            <i className="ri-inbox-line"></i>
            <span>空空如也...</span>
          </div>
        ) : (
          filteredList.map((item, index) => (
            <ReadingCard
              key={item.url}
              item={item}
              index={index}
              onDelete={(url) => void handleDelete(url)}
              onEdit={(url, newTitle) => void handleEdit(url, newTitle)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(event, targetIndex) => void handleDrop(event, targetIndex)}
              onDragEnd={handleDragEnd}
              formatDate={formatDate}
              extractHostname={extractHostname}
              categories={allCategoryNames}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Popup
