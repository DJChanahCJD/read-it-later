"use client"

import React from "react"
import { useEffect, useRef, useState, type DragEvent } from "react"
import "./Popup.css"
import "remixicon/fonts/remixicon.css"
import { ReadingCard } from "./components/ReadingCard"
import { ALL_CATEGORIE, CONTEXT_MENU_ACTION, MESSAGE_TYPE, extractHostname, formatDate } from "@/utils/common"
import {
  createReadingItem,
  filterReadingList,
  loadReadLaterState,
  moveReadingItem,
  replaceReadingItem,
  saveCategories,
  saveReadingList,
  saveSelectedCategory,
} from "@/utils/readLater"
import { KEYS } from "@/utils/storage"
import type { ReadingItem } from "@/utils/typing"

const Popup: React.FC = () => {
  const [readingList, setReadingList] = useState<ReadingItem[]>([])
  const [categories, setCategories] = useState<string[]>([ALL_CATEGORIE])
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIE)
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
    }

    syncState()

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local") {
        return
      }

      if (changes[KEYS.readLaterLinks] || changes[KEYS.readLaterCategories] || changes[KEYS.lastSelectedCategory]) {
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

  const filteredList = filterReadingList(readingList, searchTerm, selectedCategory)

  const persistReadingList = async (nextList: ReadingItem[]) => {
    setReadingList(nextList)
    await saveReadingList(nextList)
  }

  const persistCategories = async (nextCategories: string[]) => {
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

  const handleDelete = async (url: string) => {
    const nextList = readingList.filter((item) => item.url !== url)
    await persistReadingList(nextList)

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
    const category = categories[index]
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
    if (categories[index] === ALL_CATEGORIE) {
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

      const nextCategories = [...categories]
      const sourceIndex = nextCategories.findIndex((category) => category === draggedCategory)
      if (sourceIndex === -1 || sourceIndex === dropIndex) {
        setDraggedCategory(null)
        return
      }

      const [movedCategory] = nextCategories.splice(sourceIndex, 1)
      nextCategories.splice(dropIndex, 0, movedCategory)
      await persistCategories(nextCategories)
      setDraggedCategory(null)
      return
    }

    if (draggedItemUrl) {
      await handleChangeCategory(draggedItemUrl, categories[dropIndex])
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
    const newCategory = `新分类${categories.length}`
    const nextCategories = [...categories, newCategory]
    await persistCategories(nextCategories)
    setEditingCategoryIndex(nextCategories.length - 1)
    setEditingCategoryName(newCategory)
  }

  const handleStartEdit = (index: number, category: string) => {
    if (category === ALL_CATEGORIE) {
      return
    }

    setEditingCategoryIndex(index)
    setEditingCategoryName(category)
  }

  const handleSaveEdit = async () => {
    if (editingCategoryIndex === null) {
      return
    }

    const nextName = editingCategoryName.trim()
    if (!nextName || categories.some((category, index) => index !== editingCategoryIndex && category === nextName)) {
      setEditingCategoryIndex(null)
      return
    }

    const previousName = categories[editingCategoryIndex]
    const nextCategories = [...categories]
    nextCategories[editingCategoryIndex] = nextName

    const nextList = readingList.map((item) =>
      item.category === previousName ? { ...item, category: nextName } : item,
    )

    setSelectedCategory((current) => (current === previousName ? nextName : current))
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

      {categories.length > 1 && (
        <div className="categories-container">
          {categories.map((category, index) => (
            <div
              key={category}
              className={`category-tab ${selectedCategory === category ? "active" : ""} ${
                category === ALL_CATEGORIE ? "no-drag" : ""
              }`}
              onClick={() => void handleCategorySelect(category)}
              onDoubleClick={() => handleStartEdit(index, category)}
              draggable={category !== ALL_CATEGORIE && editingCategoryIndex === null}
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
                <span className="category-name">{category}</span>
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
              categories={categories}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Popup
