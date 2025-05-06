"use client"

import React from "react"
import { useState, useEffect } from "react"
import "./Options.css"
import "remixicon/fonts/remixicon.css"
import { ALL_CATEGORIE, defaultCategories, extractHostname, formatDate, getBrowserShortcutSettingUrl, MAX_CATEGORIE_LENGTH, TEST_LINKS_LENGTH } from "../../utils/common"
import { ReadingItem } from "../../utils/typing"
import { KEYS, storage } from "../../utils/storage"

const Options: React.FC = () => {
  // 链接列表状态
  const [readingList, setReadingList] = useState<ReadingItem[]>([])
  const [filteredList, setFilteredList] = useState<ReadingItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // 分类状态
  
  const [categories, setCategories] = useState<string[]>([])                      // 所有分类列表
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number>(0)
  const [editingCategoryName, setEditingCategoryName] = useState("")               // 分类输入框的值（统一用于新建和编辑）
  const [creatingCategoryName, setCreatingCategoryName] = useState("")
  // 移动状态
  const [isMoveDropdownOpen, setIsMoveDropdownOpen] = useState(false)

  // 加载数据
  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    storage.get([KEYS.readLaterLinks, KEYS.readLaterCategories], (result: any) => {
      // 获取阅读列表，如果为空则使用空数组
      const links = result.readLaterLinks || []
      const categories = result.readLaterCategories || defaultCategories
      const validSelectedIndex = categories[selectedCategoryIndex] ? selectedCategoryIndex : 0
      const selectedCategory = categories[validSelectedIndex] || defaultCategories[0]
  
      // 更新状态
      setReadingList(links)
      setCategories(categories)
      setSelectedCategoryIndex(validSelectedIndex)
      
      // 应用过滤器
      applyFilters(links, searchTerm, selectedCategory)
  
      // 重置分类输入框
      setEditingCategoryName("")
      setCreatingCategoryName("")
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
      applyFilters(readingList, term, categories[selectedCategoryIndex])
    }, 200)
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
    applyFilters(newList, searchTerm, categories[selectedCategoryIndex])
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
  const handleCategorySelect = (index: number) => {
    const category = categories[index] || ALL_CATEGORIE
    applyFilters(readingList, searchTerm, category)
    setSelectedCategoryIndex(index)
  }
  
  // 添加新分类
  const handleAddCategory = () => {
    if (creatingCategoryName.trim() === "") return
  
    // 检查分类名称长度
    if (creatingCategoryName.trim().length > MAX_CATEGORIE_LENGTH) {
      alert(`分类名称不能超过${MAX_CATEGORIE_LENGTH}个字符`);
      return;
    }
  
    const newCategory = creatingCategoryName.trim()
    // 检查是否已存在同名分类
    if (categories.includes(newCategory)) {
      alert("分类名称已存在")
      return
    }
  
    const updatedCategories = [...categories, newCategory]
    setCategories(updatedCategories)
    storage.set({ readLaterCategories: updatedCategories })
    setCreatingCategoryName("") // 重置输入框
  }

  // 开始编辑分类
  // 添加一个新的状态来跟踪正在编辑的分类索引
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  
  const handleEditCategoryStart = (categoryIndex: number) => {
    setEditingIndex(categoryIndex)
    setEditingCategoryName(categories[categoryIndex] || "")
  }
  
  // 修改保存编辑分类的函数
  const handleEditCategorySave = () => {
    if (editingIndex === null) return
    
    const originalCategoryName = categories[editingIndex].trim()
    const newCategoryName = editingCategoryName.trim()
    
    if (originalCategoryName === "" || newCategoryName === originalCategoryName) {
      console.log("分类名称未更改")
      setEditingCategoryName("") 
      setEditingIndex(null)
      return
    }
  
    // 检查分类名称长度
    if (newCategoryName.length > MAX_CATEGORIE_LENGTH) {
      alert(`分类名称不能超过${MAX_CATEGORIE_LENGTH}个字符`);
      setEditingCategoryName(originalCategoryName);
      setEditingIndex(null)
      return;
    }
  
    // 检查是否已存在同名分类
    if (categories.some((c) => c === newCategoryName)) {
      alert("分类名称已存在")
      setEditingIndex(null)
      return
    }
  
    const updatedCategories = categories.map((c) =>
      c === originalCategoryName ? newCategoryName : c
    )
    // 更新所有使用该分类的链接
    const updatedLinks = readingList.map((link) =>
      link.category === originalCategoryName ? { ...link, category: newCategoryName } : link,
    )
  
    setCategories(updatedCategories)
    setReadingList(updatedLinks)
    storage.set({
      readLaterCategories: updatedCategories,
      readLaterLinks: updatedLinks,
    })
    setEditingIndex(null)
    setEditingCategoryName("")
  }

  // 删除分类
  const handleDeleteCategory = (category: string) => {
    const categoryToDelete = categories.find((c) => c === category)
    if (!categoryToDelete) return

    if (window.confirm(`确定要删除「${ categoryToDelete }」吗？该分类下的链接将移至「${ ALL_CATEGORIE }」。`)) {
      // 将该分类下的链接移至"默认"分类
      const updatedLinks = readingList.map((link) =>
        link.category === categoryToDelete ? { ...link, category: ALL_CATEGORIE} : link,
      )
      const updatedCategories = categories.filter((c) => c !== category)
      storage.set({
        readLaterCategories: updatedCategories,
        readLaterLinks: updatedLinks,
      })
      setCategories(updatedCategories)
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

    // 编辑标题状态
    const [editingUrl, setEditingUrl] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')

  // 批量删除选中项
  const handleBatchDelete = () => {
    if (selectedItems.length === 0) return

    // 使用自定义对话框或状态管理来替代原生confirm
    if (window.confirm(`确定要删除选中的 ${selectedItems.length} 个链接吗？`)) {
      const updatedList = readingList.filter((item) => !selectedItems.includes(item.url))
      storage.set({ readLaterLinks: updatedList })
      setReadingList(updatedList)
      applyFilters(updatedList, searchTerm, categories[selectedCategoryIndex])
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

    storage.set({ readLaterLinks: updatedList })
    setIsMoveDropdownOpen(false) // 选择后关闭下拉菜单
  }

  // 删除单个链接
  const handleDeleteLink = (url: string) => {
    const updatedList = readingList.filter((item) => item.url !== url)
    storage.set({ readLaterLinks: updatedList })
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
    storage.set({ readLaterLinks: updatedList })
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
            {categories.map((category, index) => (
              <div
                key={category}
                className={`category-item ${selectedCategoryIndex === index ? "active" : ""}`}
                onClick={() => handleCategorySelect(index)}
              >
                { editingCategoryName.length > 0 && editingIndex === index ? (
                  <div className="category-edit">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyUp={(e) => e.key === "Enter" && handleEditCategorySave()}
                      onBlur={handleEditCategorySave}
                      autoFocus
                    />
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
                            handleEditCategoryStart(index)
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
                value={creatingCategoryName}
                onChange={(e) => setCreatingCategoryName(e.target.value)}
                onKeyUp={(e) => e.key === "Enter"  && handleAddCategory()}
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
                    {editingUrl === item.url ? (
                      <input
                        type="text"
                        className="edit-title-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => {
                          if (editTitle.trim()) {
                            handleEdit(item.url, editTitle.trim())
                          }
                          setEditingUrl(null)
                          setEditTitle('')
                        }}
                        onKeyUp={(e) => {
                          if (e.key === 'Enter' && editTitle.trim()) {
                            handleEdit(item.url, editTitle.trim())
                            setEditingUrl(null)
                            setEditTitle('')
                          } else if (e.key === 'Escape') {
                            setEditingUrl(null)
                            setEditTitle('')
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
                  <div className="date" title={item.addedAt}>{formatDate(item.addedAt)}</div>
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
