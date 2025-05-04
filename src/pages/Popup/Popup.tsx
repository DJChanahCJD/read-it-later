"use client"

import React from "react"
import { useState, useEffect, useRef, type DragEvent } from "react"
import "./Popup.css"
import "remixicon/fonts/remixicon.css"
import { ReadingCard } from "./components/ReadingCard"
import { ALL_CATEGORIE, defaultCategories, extractHostname, formatDate } from "../../utils/common"
import { ReadingItem } from "../../utils/types"
// 默认分类列表

/**
 * Popup 组件 - 展示稍后阅读列表
 * @returns {JSX.Element} 渲染的 Popup 组件
 */
const Popup: React.FC = () => {
  const [readingList, setReadingList] = useState<ReadingItem[]>([])
  const [filteredList, setFilteredList] = useState<ReadingItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categories, setCategories] = useState<string[]>(defaultCategories)
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIE)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 拖拽相关状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    // 加载保存的链接和分类
    chrome.storage.local.get(["readLaterLinks", "readLaterCategories"], (result: any) => {
      const links = result.readLaterLinks || []

      // 确保所有链接都有分类字段
      const updatedLinks = links.map((link: ReadingItem) => ({
        ...link,
        category: link.category || ALL_CATEGORIE,
      }))

      setReadingList(updatedLinks)
      applyFilters(updatedLinks, searchTerm, selectedCategory)

      // 加载保存的分类
      if (result.readLaterCategories) {
        setCategories(result.readLaterCategories)
      }
    })

    // 自动聚焦搜索框
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchTerm, selectedCategory])

  // 应用过滤器（搜索词和分类）
  const applyFilters = (links: ReadingItem[], term: string, category: string) => {
    let filtered = links

    // 应用搜索过滤
    if (term) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(term.toLowerCase()) || item.url.toLowerCase().includes(term.toLowerCase()),
      )
    }

    // 应用分类过滤
    if (category !== "全部") {
      filtered = filtered.filter((item) => item.category === category)
    }

    setFilteredList(filtered)
  }

  // 搜索功能
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)

    // 简单的防抖实现
    setTimeout(() => {
      applyFilters(readingList, term, selectedCategory)
    }, 200)
  }

  // 处理分类选择
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
    applyFilters(readingList, searchTerm, category)
  }

  /**
   * 处理删除阅读项
   * @param {string} url - 要删除的阅读项的URL
   */
  const handleDelete = (url: string) => {
    const newList = readingList.filter((item) => item.url !== url)
    chrome.storage.local.set({ readLaterLinks: newList })
    setReadingList(newList)
    applyFilters(newList, searchTerm, selectedCategory)

    // 更新右键菜单
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
      const currentTab = tabs[0]
      if (currentTab.url === url) {
        chrome.runtime.sendMessage({
          type: "updateContextMenu",
          url: url,
          action: "remove",
        })
      }
    })
  }

  /**
   * 处理编辑阅读项标题
   * @param {string} url - 要编辑的阅读项的URL
   * @param {string} newTitle - 新标题
   */
  const handleEdit = (url: string, newTitle: string) => {
    const newList = readingList.map((item) => (item.url === url ? { ...item, title: newTitle } : item))
    chrome.storage.local.set({ readLaterLinks: newList })
    setReadingList(newList)
    applyFilters(newList, searchTerm, selectedCategory)
  }

  /**
   * 处理更改阅读项分类
   * @param {string} url - 要更改分类的阅读项的URL
   * @param {string} category - 新分类
   */
  const handleChangeCategory = (url: string, category: string) => {
    const newList = readingList.map((item) => (item.url === url ? { ...item, category } : item))
    chrome.storage.local.set({ readLaterLinks: newList })
    setReadingList(newList)
    applyFilters(newList, searchTerm, selectedCategory)
  }

  /**
   * 添加当前页面到稍后阅读
   */
  const addCurrentPage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
      const currentTab = tabs[0]
      const url = currentTab.url || ""
      const title = currentTab.title || ""

      // 检查链接是否已存在
      if (!readingList.some((link) => link.url === url)) {
        // 添加新链接到列表开头，使用当前选择的分类
        const newItem = {
          url: url,
          title: title,
          addedAt: new Date().toISOString(),
          category: selectedCategory === ALL_CATEGORIE ? ALL_CATEGORIE : selectedCategory,
        }

        const newList = [newItem, ...readingList]
        chrome.storage.local.set({ readLaterLinks: newList })
        setReadingList(newList)
        applyFilters(newList, searchTerm, selectedCategory)

        // 更新右键菜单
        chrome.runtime.sendMessage({
          type: "updateContextMenu",
          url: url,
          action: "add",
        })
      } else {
        // 1. 如果分类不同，提示用户选择是否移至新分类
        if (readingList.some((link) => link.url === url && link.category !== selectedCategory)) {
          const existingItem = readingList.find(link => link.url === url)
          const moveToNewCategory = window.confirm(`该链接已存在于「${existingItem?.category}」，是否移至「${selectedCategory}」？`)
          if (moveToNewCategory) {
            const newList = readingList.map((item) => (item.url === url? {...item, category: selectedCategory } : item))
            chrome.storage.local.set({ readLaterLinks: newList })
            setReadingList(newList)
            applyFilters(newList, searchTerm, selectedCategory)
          }
        }
      }
    })
  }

  // 拖拽处理函数
  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index)
    e.currentTarget.classList.add("dragging")
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    e.currentTarget.classList.add("drag-over")
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("drag-over")
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault()
    e.currentTarget.classList.remove("drag-over")

    if (draggedIndex === null || draggedIndex === dropIndex) return

    // 更新数组顺序
    const newList = [...readingList]
    const [movedItem] = newList.splice(draggedIndex, 1)
    newList.splice(dropIndex, 0, movedItem)

    // 保存新顺序到存储
    chrome.storage.local.set({ readLaterLinks: newList })
    setReadingList(newList)
    applyFilters(newList, searchTerm, selectedCategory)
  }

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("dragging")
    setDraggedIndex(null)

    // 清除所有拖拽状态
    document.querySelectorAll(".card").forEach((card) => {
      ;(card as HTMLElement).classList.remove("drag-over")
    })
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

      {/* 分类选项卡，只有设置了其他分类后显示 */}
      {categories.length > 1 ? <div className="categories-container">
        {categories.map((category) => (
          <div
            key={category}
            className={`category-tab ${selectedCategory === category ? "active" : ""}`}
            onClick={() => handleCategorySelect(category)}
          >
            {category}
          </div>
        ))}
      </div> : null}

      <div className="card-list">
        {filteredList.length === 0 ? (
          <div className="empty-state">
            <i className="ri-inbox-line"></i>
            <span>{selectedCategory === "全部" ? "暂无保存的链接" : `${selectedCategory}分类中暂无链接`}</span>
          </div>
        ) : (
          filteredList.map((item, index) => (
            <ReadingCard
              key={item.url}
              item={item}
              index={index}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onChangeCategory={handleChangeCategory}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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
