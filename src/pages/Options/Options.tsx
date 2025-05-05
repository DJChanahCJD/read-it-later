"use client"

import React from "react"
import { useState, useEffect } from "react"
import "./Options.css"
import "remixicon/fonts/remixicon.css"
import { ALL_CATEGORIE, defaultCategories, extractHostname, formatDate, getBrowserShortcutSettingUrl, MAX_CATEGORIE_LENGTH, TEST_LINKS_LENGTH } from "../../utils/common"
import { ReadingItem } from "../../utils/types"

// 声明 chrome 变量
declare const chrome: any

const Options: React.FC = () => {
  // 链接列表状态
  const [readingList, setReadingList] = useState<ReadingItem[]>([])
  const [filteredList, setFilteredList] = useState<ReadingItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // 分类状态
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIE)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState("")
  const [isMoveDropdownOpen, setIsMoveDropdownOpen] = useState(false)

  // 加载数据
  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    chrome.storage.local.get(["readLaterLinks", "readLaterCategories"], (result: any) => {
      const links = result.readLaterLinks || []


      setReadingList(links)
      applyFilters(links, searchTerm, selectedCategory)

      // 加载保存的分类
      if (result.readLaterCategories) {
        setCategories(result.readLaterCategories)
      } else {
        setCategories(defaultCategories)
        chrome.storage.local.set({ readLaterCategories: defaultCategories })
      }
    })
  }

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

    // 应用排序
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.addedAt).getTime();
      const dateB = new Date(b.addedAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    setFilteredList(filtered)

    // 重置选择状态
    setSelectedItems([])
    setSelectAll(false)
  }

  // 添加 storage 变化监听
  useEffect(() => {
    const handleStorageChange = (changes: any) => {
      // 当 readLaterLinks 发生变化时重新加载数据
      if (changes.readLaterLinks) {
        loadData();
      }
    };

    // 添加监听器
    chrome.storage.onChanged.addListener(handleStorageChange);

    // 组件卸载时移除监听器
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // 搜索功能
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value
    setSearchTerm(term)
    // 简单的防抖实现
    setTimeout(() => {
      applyFilters(readingList, term, selectedCategory)
    }, 200)
  }

    // 添加排序状态
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // 添加排序处理函数
    const handleSortByDate = () => {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      
      // 对当前过滤后的列表进行排序
      const sortedList = [...filteredList].sort((a, b) => {
        const dateA = new Date(a.addedAt).getTime();
        const dateB = new Date(b.addedAt).getTime();
        return newOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
      
      setFilteredList(sortedList);
    };

  // 处理分类选择
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
    applyFilters(readingList, searchTerm, category)
  }

  // 添加新分类
  const handleAddCategory = () => {
    if (newCategoryName.trim() === "") return
  
    // 检查分类名称长度
    if (newCategoryName.trim().length > MAX_CATEGORIE_LENGTH) {
      alert(`分类名称不能超过${MAX_CATEGORIE_LENGTH}个字符`);
      return;
    }

    const c = newCategoryName.trim()
    // 检查是否已存在同名分类
    if (categories.some((c) => c === newCategoryName.trim())) {
      alert("分类名称已存在")
      setSelectedCategory(c)
      return
    }

    const newCategory = newCategoryName.trim()

    const updatedCategories = [...categories, newCategory]
    setCategories(updatedCategories)
    chrome.storage.local.set({ readLaterCategories: updatedCategories })
    setNewCategoryName("")
  }

  // 开始编辑分类
  const handleEditCategoryStart = (category: string) => {
    setEditingCategory(category)
    setEditCategoryName(category)
  }

  // 保存编辑的分类
  const handleEditCategorySave = () => {
    const prevCategoryName = editingCategory?.trim()
    if (prevCategoryName === "" || editCategoryName.trim() === prevCategoryName) {
      setEditingCategory(null)
      setEditCategoryName("")
      return
    }
  
    // 检查分类名称长度
    if (editCategoryName.trim().length > MAX_CATEGORIE_LENGTH) {
      alert(`分类名称不能超过${MAX_CATEGORIE_LENGTH}个字符`);
      return;
    }
  
    // 检查是否已存在同名分类
    if (categories.some((c) => c === editCategoryName.trim())) {
      alert("分类名称已存在")
      setEditingCategory(null)
      setEditCategoryName("")
      return
    }

    const updatedCategories = categories.map((c) =>
      c === editingCategory ? editCategoryName.trim() : c
    )
    // 更新所有使用该分类的链接
    const oldCategoryName = categories.find((c) => c === editingCategory)
    const updatedLinks = readingList.map((link) =>
      link.category === oldCategoryName ? { ...link, category: editCategoryName.trim() } : link,
    )

    setCategories(updatedCategories)
    setReadingList(updatedLinks)
    applyFilters(updatedLinks, searchTerm, selectedCategory)

    chrome.storage.local.set({
      readLaterCategories: updatedCategories,
      readLaterLinks: updatedLinks,
    })

    setEditingCategory(null)
    setEditCategoryName("")
  }

  // 删除分类
  const handleDeleteCategory = (categoryId: string) => {
    const categoryToDelete = categories.find((c) => c === categoryId)
    if (!categoryToDelete) return

    if (window.confirm(`确定要删除「${ categoryToDelete }」吗？该分类下的链接将移至「全部」。`)) {
      // 将该分类下的链接移至"默认"分类
      const updatedLinks = readingList.map((link) =>
        link.category === categoryToDelete ? { ...link, category: "全部"} : link,
      )

      const updatedCategories = categories.filter((c) => c !== categoryId)

      setCategories(updatedCategories)
      setReadingList(updatedLinks)
      applyFilters(updatedLinks, searchTerm, selectedCategory)

      chrome.storage.local.set({
        readLaterCategories: updatedCategories,
        readLaterLinks: updatedLinks,
      })

      // 如果删除的是当前选中的分类，则切换到"全部"
      if (selectedCategory === categoryToDelete) {
        setSelectedCategory(ALL_CATEGORIE)
        applyFilters(updatedLinks, searchTerm, ALL_CATEGORIE)
      }
    }
  }

  // 选择/取消选择单个项目
  const toggleSelectItem = (url: string) => {
    if (selectedItems.includes(url)) {
      setSelectedItems(selectedItems.filter((item) => item !== url))
      setSelectAll(false)
    } else {
      setSelectedItems([...selectedItems, url])
      if (selectedItems.length + 1 === filteredList.length) {
        setSelectAll(true)
      }
    }
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([])
      setSelectAll(false)
    } else {
      setSelectedItems(filteredList.map((item) => item.url))
      setSelectAll(true)
    }
  }

  // 批量删除选中项
  const handleBatchDelete = () => {
    if (selectedItems.length === 0) return

    // 使用自定义对话框或状态管理来替代原生confirm
    if (window.confirm(`确定要删除选中的 ${selectedItems.length} 个链接吗？`)) {
      const updatedList = readingList.filter((item) => !selectedItems.includes(item.url))
      chrome.storage.local.set({ readLaterLinks: updatedList })
      setReadingList(updatedList)
      applyFilters(updatedList, searchTerm, selectedCategory)
    }
  }

  // 批量移动到分类
  // 添加处理下拉菜单显示的函数
  const toggleMoveDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMoveDropdownOpen(!isMoveDropdownOpen)
  }

  // 添加点击外部关闭下拉菜单的处理
  useEffect(() => {
    const handleClickOutside = () => {
      setIsMoveDropdownOpen(false)
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  // 修改批量移动函数
  const handleBatchMove = (targetCategory: string) => {
    if (selectedItems.length === 0) return

    const updatedList = readingList.map((item) =>
      selectedItems.includes(item.url) ? { ...item, category: targetCategory } : item,
    )

    chrome.storage.local.set({ readLaterLinks: updatedList })
    setReadingList(updatedList)
    applyFilters(updatedList, searchTerm, selectedCategory)
    setIsMoveDropdownOpen(false) // 选择后关闭下拉菜单
  }

  // 删除单个链接
  const handleDeleteLink = (url: string) => {
    const updatedList = readingList.filter((item) => item.url !== url)
    chrome.storage.local.set({ readLaterLinks: updatedList })
    setReadingList(updatedList)
    applyFilters(updatedList, searchTerm, selectedCategory)
  }

  /**
   * 添加测试数据
   * 生成测试链接并添加到列表中
   */
  const handleAddTestData = (e: React.MouseEvent<HTMLButtonElement>) => {
    const size = TEST_LINKS_LENGTH // 默认生成1个测试链接
    
    // 生成过去30天内的随机时间
    const getRandomDate = () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const randomTime = thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime());
      return new Date(randomTime).toISOString();
    };
  
    const testLinks = Array.from({ length: size }, (_, index) => {
      const randomDate = getRandomDate();
      return {
        url: `https://example.com/${randomDate}`,
        title: `测试链接 ${index + 1}`,
        addedAt: randomDate,
        category: ALL_CATEGORIE,
      };
    });
  
    const updatedList = [...testLinks, ...readingList]
    chrome.storage.local.set({ readLaterLinks: updatedList })
    setReadingList(updatedList)
    applyFilters(updatedList, searchTerm, selectedCategory)
  }

  return (
    <div className="options-container">
      <div className="options-header">
        <h1>稍后阅读 - 设置</h1>
        <div className="header-actions">
          <button 
            className="shortcut-btn" 
            onClick={() => {
              const shortcutUrl = getBrowserShortcutSettingUrl();
              chrome.tabs.create({ url: shortcutUrl });
            }}
          >
            <i className="ri-keyboard-line"></i>
            设置快捷键
          </button>
          <button 
            className="test-btn" 
            onClick={handleAddTestData}
            title="添加20个测试链接"
          >
            <i className="ri-test-tube-line"></i>
            添加测试数据
          </button>
        </div>
      </div>
      
      <div className="options-content">
        {/* 左侧分类管理 */}
        <div className="categories-sidebar">
          <div className="sidebar-header">
            <h2>分类管理</h2>
          </div>

          <div className="category-list">
            {categories.map((category) => (
              <div
                key={category}
                className={`category-item ${selectedCategory === category ? "active" : ""}`}
                onClick={() => handleCategorySelect(category)}
              >
                {editingCategory === category ? (
                  <div className="category-edit">
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      onKeyUp={(e) => e.key === "Enter" && handleEditCategorySave()}
                      autoFocus
                    />
                    <button onClick={handleEditCategorySave}>
                      <i className="ri-check-line"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="category-name">{category}</div>
                    <div className="category-count">
                      {category === ALL_CATEGORIE 
                        ? readingList.length  // 如果是"全部"分类，显示所有链接数量
                        : readingList.filter((item) => item.category === category).length  // 其他分类显示该分类下的链接数量
                      }
                    </div>
                    {/* 「全部」分类不允许更改 */}
                    {category !== ALL_CATEGORIE && (
                      <div className="category-actions">
                        <button
                          className="edit-btn"
                          title="编辑分类"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditCategoryStart(category)
                          }}
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        
                        <button
                          className="delete-btn"
                          title="删除分类"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCategory(category)
                          }}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>)}
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
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyUp={(e) => e.key === "Enter" && handleAddCategory()}
              />
            </div>
            <button onClick={handleAddCategory} title="添加分类">
              <i className="ri-add-line"></i>
            </button>
          </div>
        </div>

        {/* 右侧链接列表 */}
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
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBatchMove(category)
                            }}
                          >
                            {category}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="delete-btn" onClick={handleBatchDelete}>
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
              <div className="date" onClick={handleSortByDate} style={{ cursor: 'pointer' }}>
                日期 {sortOrder === 'asc' ? <i className="ri-sort-asc"></i> : <i className="ri-sort-desc"></i>}
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
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </div>
                  <div className="url" title={item.url}>
                    {extractHostname(item.url)}
                  </div>
                  <div className="category">{item.category}</div>
                  <div className="date" title={item.addedAt}>{formatDate(item.addedAt)}</div>
                  <div className="actions">
                    <button className="delete-btn" onClick={() => handleDeleteLink(item.url)}>
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
