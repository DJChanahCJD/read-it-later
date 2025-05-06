"use client"

import React from "react"
import { useState, useEffect, useRef, type DragEvent } from "react"
import "./Popup.css"
import "remixicon/fonts/remixicon.css"
import { ReadingCard } from "./components/ReadingCard"
import { ALL_CATEGORIE, defaultCategories, extractHostname, formatDate } from "../../utils/common"
import { ReadingItem } from "../../utils/typing"
import { KEYS, storage } from "../../utils/storage"

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
      storage.set({ readLaterCategories: newCategories });
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
    storage.get([KEYS.readLaterLinks, KEYS.readLaterCategories, KEYS.lastSelectedCategory], (result: any) => {
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

      // 加载上次选择的分类
      const lastCategory = result.lastSelectedCategory || ALL_CATEGORIE
      setSelectedCategory(lastCategory)
      applyFilters(updatedLinks, searchTerm, lastCategory)
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
    if (category !== ALL_CATEGORIE) {
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
    // 保存选择的分类
    storage.set({ lastSelectedCategory: category })
  }

  /**
   * 处理删除阅读项
   * @param {string} url - 要删除的阅读项的URL
   */
  const handleDelete = (url: string) => {
    const newList = readingList.filter((item) => item.url !== url)
    storage.set({ readLaterLinks: newList })
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
    storage.set({ readLaterLinks: newList })
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
    storage.set({ readLaterLinks: newList })
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
        storage.set({ readLaterLinks: newList })
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
          storage.set({ readLaterLinks: newList })
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
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
  
    if (draggedIndex === null || draggedIndex === dropIndex) return;
  
    // 1. 先找到过滤列表中拖拽项对应的原列表项
    const draggedItem = filteredList[draggedIndex];
    const originalIndex = readingList.findIndex(item => item.url === draggedItem.url);
    
    // 2. 找到放置位置对应的原列表索引
    let targetOriginalIndex = 0;
    if (dropIndex < filteredList.length) {
      const targetItem = filteredList[dropIndex];
      targetOriginalIndex = readingList.findIndex(item => item.url === targetItem.url);
    } else {
      targetOriginalIndex = readingList.length;
    }
  
    // 3. 在原列表上执行移动操作
    const newList = [...readingList];
    const [movedItem] = newList.splice(originalIndex, 1);
    newList.splice(targetOriginalIndex, 0, movedItem);
  
    // 4. 更新状态和存储
    storage.set({ readLaterLinks: newList });
    setReadingList(newList);
    applyFilters(newList, searchTerm, selectedCategory);
  };

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

  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理添加新分类
   */
  const handleAddCategory = () => {
    const newCategory = `新分类${categories.length}`;
    const newCategories = [...categories, newCategory];
    setCategories(newCategories);
    storage.set({ readLaterCategories: newCategories });
    // 设置为编辑模式
    setEditingCategoryIndex(newCategories.length - 1);
    setEditingCategoryName(newCategory);
  };

  /**
   * 处理开始编辑分类
   * @param {number} index - 要编辑的分类索引
   * @param {string} category - 分类名称
   */
  const handleStartEdit = (index: number, category: string) => {
    if (category === ALL_CATEGORIE) return;
    setEditingCategoryIndex(index);
    setEditingCategoryName(category);
  };

  /**
   * 处理保存分类编辑
   */
  const handleSaveEdit = () => {
    if (editingCategoryIndex === null) return;
    // 检查名称是否为空或重复
    if (!editingCategoryName.trim() || 
        categories.some((cat, idx) => idx !== editingCategoryIndex && cat === editingCategoryName.trim())) {
      setEditingCategoryIndex(null);
      return;
    }

    const newCategories = [...categories];
    const oldCategory = newCategories[editingCategoryIndex];
    newCategories[editingCategoryIndex] = editingCategoryName.trim();
    setCategories(newCategories);
    storage.set({ readLaterCategories: newCategories });

    // 更新使用旧分类名称的阅读项
    const newList = readingList.map(item => 
      item.category === oldCategory ? { ...item, category: editingCategoryName.trim() } : item
    );
    storage.set({ readLaterLinks: newList });
    setReadingList(newList);
    applyFilters(newList, searchTerm, editingCategoryName.trim());


    setEditingCategoryIndex(null);
  };

  /**
   * 处理取消编辑
   */
  const handleCancelEdit = () => {
    setEditingCategoryIndex(null);
  };

  // 监听编辑模式下的键盘事件
  useEffect(() => {
    if (editingCategoryIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleSaveEdit();
        } else if (e.key === 'Escape') {
          handleCancelEdit();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    } 
  }, [editingCategoryIndex, editingCategoryName]);

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
              onDoubleClick={() => handleStartEdit(index, category)}
              draggable={category !== ALL_CATEGORIE && editingCategoryIndex == null}
              onDragStart={(e) => handleCategoryDragStart(e, index)}
              onDragOver={(e) => handleCategoryDragOver(e, index)}
              onDragLeave={handleCategoryDragLeave}
              onDrop={(e) => handleCategoryDrop(e, index)}
              onDragEnd={handleCategoryDragEnd}
              title={"双击编辑分类"}
            >
              {editingCategoryIndex === index ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                  onBlur={handleSaveEdit}
                  className="category-edit-input"
                  draggable="false"
                />
              ) : (<span className="category-name">{category}</span>)}
            </div>
          ))}
          <button 
            className="category-add-btn" 
            onClick={handleAddCategory}
            title="添加新分类"
          >
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
