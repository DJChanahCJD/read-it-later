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
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);

  // 分类拖拽开始
  const handleCategoryDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    if (categories[index] === ALL_CATEGORIE) {
      e.preventDefault();
      return;
    }
    setDraggedCategoryIndex(index);
    e.currentTarget.classList.add("dragging"); // 添加拖拽样式
    e.dataTransfer.effectAllowed = "move";
  };

  // 分类拖拽经过
  const handleCategoryDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    // 如果是分类排序拖拽，且目标是"全部"分类，则不允许
    if (draggedCategoryIndex !== null && categories[index] === ALL_CATEGORIE) {
      return;
    }
    e.currentTarget.classList.add("drag-over");
    e.dataTransfer.dropEffect = "move";
  };

  // 分类拖拽放置
  const handleCategoryDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
  
    // 如果是分类排序的拖拽
    if (draggedCategoryIndex !== null) {
      // 不允许移动"全部"分类或将其他分类移动到"全部"分类的位置
      if (draggedCategoryIndex === 0 || dropIndex === 0) {
        return;
      }
  
      const newCategories = [...categories];
      const [movedCategory] = newCategories.splice(draggedCategoryIndex, 1);
      newCategories.splice(dropIndex, 0, movedCategory);
  
      setCategories(newCategories);
      chrome.storage.local.set({ readLaterCategories: newCategories });
    } 
    // 如果是 ReadingCard 拖拽到分类
    else if (draggedIndex !== null) {
      const draggedItem = filteredList[draggedIndex];
      const targetCategory = categories[dropIndex];
      
      // 更新阅读项的分类
      handleChangeCategory(draggedItem.url, targetCategory);
    }
    
    setDraggedCategoryIndex(null);
  };

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
        // 不管是否存在，将当前页面的分类更改为选中的分类
        if (readingList.some((link) => link.url === url && link.category !== selectedCategory)) {
          const newList = readingList.map((item) => (item.url === url? {...item, category: selectedCategory } : item))
          chrome.storage.local.set({ readLaterLinks: newList })
          setReadingList(newList)
          applyFilters(newList, searchTerm, selectedCategory)
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

  // 分类拖拽结束
  const handleCategoryDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("dragging");
    setDraggedCategoryIndex(null);
    
    // 清除所有分类选项卡的拖拽状态
    document.querySelectorAll(".category-tab").forEach((tab) => {
      (tab as HTMLElement).classList.remove("drag-over");
    });
  };

  // 分类拖拽离开
  const handleCategoryDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("drag-over");
  };

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

      {/* 分类选项卡 */}
      {categories.length > 1 && (
        <div className="categories-container">
          {categories.map((category, index) => (
            <div
              key={category}
              className={`category-tab ${selectedCategory === category ? "active" : ""} ${
                category === ALL_CATEGORIE ? "no-drag" : ""
              }`}
              onClick={() => handleCategorySelect(category)}
              draggable={category !== ALL_CATEGORIE}
              onDragStart={(e) => handleCategoryDragStart(e, index)}
              onDragOver={(e) => handleCategoryDragOver(e, index)}
              onDragLeave={handleCategoryDragLeave}
              onDrop={(e) => handleCategoryDrop(e, index)}
              onDragEnd={handleCategoryDragEnd}
            >
              {category}
            </div>
          ))}
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
