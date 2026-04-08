"use client"

import React from "react"
import { useEffect, useState } from "react"
import "./Options.css"
import "remixicon/fonts/remixicon.css"
import {
  ALL_CATEGORIE,
  MAX_CATEGORIE_LENGTH,
  TEST_LINKS_LENGTH,
  extractHostname,
  formatDate,
  getBrowserShortcutSettingUrl,
  getRandomDate,
} from "@/utils/common"
import {
  filterReadingList,
  loadReadLaterState,
  replaceReadingItem,
  saveCategories,
  saveReadingList,
  sortReadingListByDate,
} from "@/utils/readLater"
import { KEYS } from "@/utils/storage"
import type { ReadingItem } from "@/utils/typing"

const Options: React.FC = () => {
  const [readingList, setReadingList] = useState<ReadingItem[]>([])
  const [categories, setCategories] = useState<string[]>([ALL_CATEGORIE])
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIE)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [creatingCategoryName, setCreatingCategoryName] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const [isMoveDropdownOpen, setIsMoveDropdownOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

  useEffect(() => {
    const syncState = async () => {
      const nextState = await loadReadLaterState()
      setReadingList(nextState.readingList)
      setCategories(nextState.categories)
      setSelectedCategory((current) =>
        nextState.categories.includes(current) ? current : nextState.selectedCategory,
      )
    }

    syncState()

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local") {
        return
      }

      if (changes[KEYS.readLaterLinks] || changes[KEYS.readLaterCategories]) {
        syncState().catch((error) => console.error("Failed to sync options state:", error))
      }
    }

    const handleClickOutside = () => {
      setIsMoveDropdownOpen(false)
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    document.addEventListener("click", handleClickOutside)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
      document.removeEventListener("click", handleClickOutside)
    }
  }, [])

  const filteredList = sortReadingListByDate(
    filterReadingList(readingList, searchTerm, selectedCategory),
    sortOrder,
  )

  const selectedCategoryIndex = Math.max(
    categories.findIndex((category) => category === selectedCategory),
    0,
  )

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
    setSelectedItems([])
  }

  const handleEdit = async (url: string, newTitle: string) => {
    await persistReadingList(replaceReadingItem(readingList, url, (item) => ({ ...item, title: newTitle })))
  }

  const handleSortByDate = () => {
    setSortOrder((current) => (current === "asc" ? "desc" : "asc"))
  }

  const handleCategorySelect = (index: number) => {
    setSelectedCategory(categories[index] || ALL_CATEGORIE)
    setSelectedItems([])
  }

  const handleAddCategory = async () => {
    const nextName = creatingCategoryName.trim()
    if (!nextName) {
      return
    }

    if (nextName.length > MAX_CATEGORIE_LENGTH) {
      alert(`分类名称不能超过${MAX_CATEGORIE_LENGTH}个字符`)
      return
    }

    if (categories.includes(nextName)) {
      alert("分类名称已存在")
      return
    }

    const nextCategories = [...categories, nextName]
    await persistCategories(nextCategories)
    setCreatingCategoryName("")
  }

  const handleEditCategoryStart = (categoryIndex: number) => {
    setEditingIndex(categoryIndex)
    setEditingCategoryName(categories[categoryIndex] || "")
  }

  const handleEditCategorySave = async () => {
    if (editingIndex === null) {
      return
    }

    const originalName = categories[editingIndex]
    const nextName = editingCategoryName.trim()

    if (!nextName || nextName === originalName) {
      setEditingIndex(null)
      setEditingCategoryName("")
      return
    }

    if (nextName.length > MAX_CATEGORIE_LENGTH) {
      alert(`分类名称不能超过${MAX_CATEGORIE_LENGTH}个字符`)
      setEditingIndex(null)
      setEditingCategoryName("")
      return
    }

    if (categories.some((category, index) => index !== editingIndex && category === nextName)) {
      alert("分类名称已存在")
      setEditingIndex(null)
      return
    }

    const nextCategories = [...categories]
    nextCategories[editingIndex] = nextName
    const nextList = readingList.map((item) =>
      item.category === originalName ? { ...item, category: nextName } : item,
    )

    setSelectedCategory((current) => (current === originalName ? nextName : current))
    await Promise.all([persistCategories(nextCategories), persistReadingList(nextList)])
    setEditingIndex(null)
    setEditingCategoryName("")
  }

  const handleDeleteCategory = async (category: string) => {
    if (
      !window.confirm(`确定要删除「${category}」吗？该分类下的链接将移至「${ALL_CATEGORIE}」。`)
    ) {
      return
    }

    const nextList = readingList.map((item) =>
      item.category === category ? { ...item, category: ALL_CATEGORIE } : item,
    )
    const nextCategories = categories.filter((item) => item !== category)

    if (selectedCategory === category) {
      setSelectedCategory(ALL_CATEGORIE)
    }

    await Promise.all([persistCategories(nextCategories), persistReadingList(nextList)])
  }

  const toggleSelectItem = (url: string) => {
    setSelectedItems((current) =>
      current.includes(url) ? current.filter((item) => item !== url) : [...current, url],
    )
  }

  const selectAll = filteredList.length > 0 && selectedItems.length === filteredList.length

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([])
      return
    }

    setSelectedItems(filteredList.map((item) => item.url))
  }

  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {
      return
    }

    if (!window.confirm(`确定要删除选中的 ${selectedItems.length} 个链接吗？`)) {
      return
    }

    const nextList = readingList.filter((item) => !selectedItems.includes(item.url))
    await persistReadingList(nextList)
    setSelectedItems([])
  }

  const toggleMoveDropdown = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIsMoveDropdownOpen((current) => !current)
  }

  const handleBatchMove = async (targetCategory: string) => {
    const nextList = readingList.map((item) =>
      selectedItems.includes(item.url) ? { ...item, category: targetCategory } : item,
    )
    await persistReadingList(nextList)
    setSelectedItems([])
    setIsMoveDropdownOpen(false)
  }

  const handleDeleteLink = async (url: string) => {
    const nextList = readingList.filter((item) => item.url !== url)
    await persistReadingList(nextList)
  }

  const handleAddTestData = async () => {
    const testLinks = Array.from({ length: TEST_LINKS_LENGTH }, (_, index) => {
      const randomDate = getRandomDate()
      return {
        url: `https://example.com/${randomDate}`,
        title: `测试链接 ${index + 1}`,
        addedAt: randomDate,
        category: ALL_CATEGORIE,
      }
    })

    await persistReadingList([...testLinks, ...readingList])
  }

  return (
    <div className="options-container">
      <div className="options-header">
        <h1>稍后阅读 - 设置</h1>
        <div className="header-actions">
          <button
            className="shortcut-btn"
            onClick={() => chrome.tabs.create({ url: getBrowserShortcutSettingUrl() })}
          >
            <i className="ri-keyboard-line"></i>
            设置快捷键
          </button>
          <button className="test-btn" onClick={() => void handleAddTestData()} title="添加测试数据">
            <i className="ri-test-tube-line"></i>
            添加测试数据
          </button>
        </div>
      </div>

      <div className="options-content">
        <div className="categories-sidebar">
          <div className="sidebar-header">
            <h2>分类管理</h2>
          </div>

          <div className="category-list">
            {categories.map((category, index) => (
              <div
                key={category}
                className={`category-item ${selectedCategoryIndex === index ? "active" : ""}`}
                onClick={() => handleCategorySelect(index)}
              >
                {editingIndex === index ? (
                  <div className="category-edit">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(event) => setEditingCategoryName(event.target.value)}
                      onKeyUp={(event) => event.key === "Enter" && void handleEditCategorySave()}
                      onBlur={() => void handleEditCategorySave()}
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <div className="category-name">{category}</div>
                    <div className="category-count">
                      {category === ALL_CATEGORIE
                        ? readingList.length
                        : readingList.filter((item) => item.category === category).length}
                    </div>
                    {category !== ALL_CATEGORIE && (
                      <div className="category-actions">
                        <button
                          className="edit-btn"
                          title="编辑分类"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleEditCategoryStart(index)
                          }}
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          className="delete-btn"
                          title="删除分类"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDeleteCategory(category)
                          }}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="add-category">
            <div className="add-category-input-wrapper">
              <i className="ri-price-tag-3-line"></i>
              <input
                type="text"
                placeholder="新分类名称"
                value={creatingCategoryName}
                onChange={(event) => setCreatingCategoryName(event.target.value)}
                onKeyUp={(event) => event.key === "Enter" && void handleAddCategory()}
              />
            </div>
            <button onClick={() => void handleAddCategory()} title="添加分类">
              <i className="ri-add-line"></i>
            </button>
          </div>
        </div>

        <div className="links-container">
          <div className="links-header">
            <div className="search-box">
              <i className="ri-search-line"></i>
              <input type="text" placeholder="搜索链接..." value={searchTerm} onChange={handleSearch} />
            </div>

            <div className="links-actions">
              {selectedItems.length > 0 && (
                <>
                  <div className="batch-move">
                    <button className="move-btn" onClick={toggleMoveDropdown}>
                      移动到 <i className="ri-arrow-down-s-line"></i>
                    </button>
                    {isMoveDropdownOpen && (
                      <div className="move-dropdown">
                        {categories.map((category) => (
                          <div
                            key={category}
                            className="move-item"
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleBatchMove(category)
                            }}
                          >
                            {category}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="delete-btn" onClick={() => void handleBatchDelete()}>
                    删除
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="links-list">
            <div className="links-list-header">
              <div className="checkbox">
                <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
              </div>
              <div className="title">标题</div>
              <div className="url">链接</div>
              <div className="category">分类</div>
              <div className="date" onClick={handleSortByDate} style={{ cursor: "pointer" }}>
                日期 {sortOrder === "asc" ? <i className="ri-sort-asc"></i> : <i className="ri-sort-desc"></i>}
              </div>
              <div className="actions">操作</div>
            </div>

            {filteredList.length === 0 ? (
              <div className="empty-list">
                <i className="ri-inbox-line"></i>
                <p>暂无链接</p>
              </div>
            ) : (
              filteredList.map((item) => (
                <div key={item.url} className="link-item">
                  <div className="checkbox">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.url)}
                      onChange={() => toggleSelectItem(item.url)}
                    />
                  </div>
                  <div className="title" title={item.title}>
                    {editingUrl === item.url ? (
                      <input
                        type="text"
                        className="edit-title-input"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        onBlur={() => {
                          if (editTitle.trim()) {
                            void handleEdit(item.url, editTitle.trim())
                          }
                          setEditingUrl(null)
                          setEditTitle("")
                        }}
                        onKeyUp={(event) => {
                          if (event.key === "Enter" && editTitle.trim()) {
                            void handleEdit(item.url, editTitle.trim())
                            setEditingUrl(null)
                            setEditTitle("")
                          } else if (event.key === "Escape") {
                            setEditingUrl(null)
                            setEditTitle("")
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    )}
                  </div>
                  <div className="url" title={item.url}>
                    {extractHostname(item.url)}
                  </div>
                  <div className="category">{item.category}</div>
                  <div className="date" title={item.addedAt}>
                    {formatDate(item.addedAt)}
                  </div>
                  <div className="actions">
                    <button
                      className="edit-btn"
                      title="编辑"
                      onClick={() => {
                        setEditingUrl(item.url)
                        setEditTitle(item.title)
                      }}
                    >
                      <i className="ri-edit-line"></i>
                    </button>
                    <button className="delete-btn" onClick={() => void handleDeleteLink(item.url)}>
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Options
