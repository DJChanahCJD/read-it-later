"use client"

import React from "react"
import { useEffect, useState } from "react"
import "./Options.css"
import "@/assets/fonts/remixicon.css"
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
  addToTrash,
  createReadingItem,
  filterReadingList,
  loadReadLaterState,
  replaceReadingItem,
  restoreFromTrash,
  saveCategories,
  saveReadingList,
  saveTrash,
  softDeleteItem,
  sortReadingListByDate,
} from "@/utils/readLater"
import { KEYS } from "@/utils/storage"
import { getSyncConfig, pullFromCloud, pushToCloud, saveSyncConfig } from "@/utils/syncService"
import type { Category, ReadingItem, SyncConfig } from "@/utils/typing"

/** 右侧主区视图模式 */
type ViewMode = "list" | "trash"

const EXTENSION_GITHUB_URL = "https://github.com/DJChanahCJD/read-it-later"
const SYNC_SERVICE_GITHUB_URL = "https://github.com/DJChanahCJD/kv-sync"

const Options: React.FC = () => {
  const [readingList, setReadingList] = useState<ReadingItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIE)
  const [trash, setTrash] = useState<ReadingItem[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [creatingCategoryName, setCreatingCategoryName] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const [isMoveDropdownOpen, setIsMoveDropdownOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false)
  const [addUrl, setAddUrl] = useState("")
  const [addTitle, setAddTitle] = useState("")
  const [addCategory, setAddCategory] = useState(ALL_CATEGORIE)

  // 同步配置状态
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({ baseUrl: "", apiKey: "" })
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const syncState = async () => {
      const nextState = await loadReadLaterState()
      setReadingList(nextState.readingList)
      setCategories(nextState.categories)
      setTrash(nextState.trash)
      setSelectedCategory((current) => {
        const allNames = [ALL_CATEGORIE, ...nextState.categories.map((c) => c.name)]
        return allNames.includes(current) ? current : nextState.selectedCategory
      })
    }

    syncState()

    // 加载同步配置
    getSyncConfig().then((cfg) => {
      if (cfg) setSyncConfig(cfg)
    }).catch((err) => console.error("加载同步配置失败:", err))

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local") {
        return
      }

      if (
        changes[KEYS.readLaterLinks] ||
        changes[KEYS.readLaterCategories] ||
        changes[KEYS.readLaterTrash]
      ) {
        syncState().catch((error) => console.error("Failed to sync options state:", error))
      }
    }

    const handleClickOutside = () => {
      setIsMoveDropdownOpen(false)
      setIsAddPanelOpen(false)
      setIsSyncPanelOpen(false)
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    document.addEventListener("click", handleClickOutside)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
      document.removeEventListener("click", handleClickOutside)
    }
  }, [])

  /** 未归档的正常分类（用于主分类列表） */
  const activeCategories = categories.filter((c) => !c.isArchived)
  /** 已归档的分类 */
  const archivedCategories = categories.filter((c) => c.isArchived)
  /** 所有分类的 name 列表（含归档，用于 select 等） */
  const allCategoryNames = [ALL_CATEGORIE, ...categories.map((c) => c.name)]
  /** 未归档的分类 name 列表（用于 sidebar 选中判断） */
  const activeCategoryNames = [ALL_CATEGORIE, ...activeCategories.map((c) => c.name)]
  const totalLinks = readingList.length
  const selectedCount = selectedItems.length
  const totalCategories = activeCategories.length
  const archivedCount = archivedCategories.length
  const trashCount = trash.length

  const filteredList = sortReadingListByDate(
    filterReadingList(readingList, searchTerm, selectedCategory),
    sortOrder,
  )

  const persistReadingList = async (nextList: ReadingItem[]) => {
    setReadingList(nextList)
    await saveReadingList(nextList)
  }

  const persistCategories = async (nextCategories: Category[]) => {
    setCategories(nextCategories)
    await saveCategories(nextCategories)
  }

  const persistTrash = async (nextTrash: ReadingItem[]) => {
    setTrash(nextTrash)
    await saveTrash(nextTrash)
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

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName)
    setViewMode("list")
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

    if (categories.some((c) => c.name === nextName)) {
      alert("分类名称已存在")
      return
    }

    const nextCategories: Category[] = [...categories, { name: nextName, isArchived: false }]
    await persistCategories(nextCategories)
    setCreatingCategoryName("")
  }

  const handleEditCategoryStart = (index: number) => {
    setEditingIndex(index)
    setEditingCategoryName(activeCategories[index]?.name || "")
  }

  const handleEditCategorySave = async () => {
    if (editingIndex === null) {
      return
    }

    const originalName = activeCategories[editingIndex]?.name
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

    if (categories.some((c) => c.name !== originalName && c.name === nextName)) {
      alert("分类名称已存在")
      setEditingIndex(null)
      return
    }

    const nextCategories = categories.map((c) =>
      c.name === originalName ? { ...c, name: nextName } : c,
    )
    const nextList = readingList.map((item) =>
      item.category === originalName ? { ...item, category: nextName } : item,
    )

    setSelectedCategory((current) => (current === originalName ? nextName : current))
    await Promise.all([persistCategories(nextCategories), persistReadingList(nextList)])
    setEditingIndex(null)
    setEditingCategoryName("")
  }

  const handleDeleteCategory = async (categoryName: string) => {
    const itemsInCategory = readingList.filter((item) => item.category === categoryName)
    const confirmMsg =
      itemsInCategory.length > 0
        ? `确定要删除「${categoryName}」吗？该分类下的 ${itemsInCategory.length} 个链接将移入回收站。`
        : `确定要删除「${categoryName}」吗？`

    if (!window.confirm(confirmMsg)) {
      return
    }

    // 将分类下的所有链接软删除进回收站
    let currentTrash = [...trash]
    for (const item of itemsInCategory) {
      currentTrash = addToTrash(currentTrash, item)
    }
    const nextList = readingList.filter((item) => item.category !== categoryName)
    const nextCategories = categories.filter((c) => c.name !== categoryName)

    if (selectedCategory === categoryName) {
      setSelectedCategory(ALL_CATEGORIE)
    }

    await Promise.all([persistCategories(nextCategories), persistReadingList(nextList), persistTrash(currentTrash)])
  }

  /** 归档分类 */
  const handleArchiveCategory = async (categoryName: string) => {
    const nextCategories = categories.map((c) =>
      c.name === categoryName ? { ...c, isArchived: true } : c,
    )
    if (selectedCategory === categoryName) {
      setSelectedCategory(ALL_CATEGORIE)
    }
    await persistCategories(nextCategories)
  }

  /** 恢复已归档分类 */
  const handleRestoreCategory = async (categoryName: string) => {
    const nextCategories = categories.map((c) =>
      c.name === categoryName ? { ...c, isArchived: false } : c,
    )
    await persistCategories(nextCategories)
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

  /** 批量软删除 */
  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {
      return
    }

    if (!window.confirm(`确定要删除选中的 ${selectedItems.length} 个链接吗？`)) {
      return
    }

    let currentTrash = [...trash]
    let currentList = [...readingList]
    for (const url of selectedItems) {
      const item = currentList.find((i) => i.url === url)
      if (item) {
        currentTrash = addToTrash(currentTrash, item)
        currentList = softDeleteItem(currentList, url)
      }
    }

    await Promise.all([persistReadingList(currentList), persistTrash(currentTrash)])
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

  /** 软删除单条链接 */
  const handleDeleteLink = async (url: string) => {
    const item = readingList.find((i) => i.url === url)
    if (!item) return

    const newTrash = addToTrash(trash, item)
    const newList = softDeleteItem(readingList, url)
    await Promise.all([persistReadingList(newList), persistTrash(newTrash)])
  }

  /** 从回收站还原 */
  const handleRestoreFromTrash = async (url: string) => {
    const result = restoreFromTrash(trash, readingList, url)
    await Promise.all([persistReadingList(result.list), persistTrash(result.trash)])
  }

  /** 永久删除回收站中单条 */
  const handlePermanentDelete = async (url: string) => {
    await persistTrash(trash.filter((t) => t.url !== url))
  }

  /** 清空回收站 */
  const handleEmptyTrash = async () => {
    if (!window.confirm("确定要清空回收站吗？此操作不可撤销。")) {
      return
    }
    await persistTrash([])
  }

  /** 打开手动添加面板，重置表单并默认当前选中分类 */
  const toggleAddPanel = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!isAddPanelOpen) {
      setAddUrl("")
      setAddTitle("")
      setAddCategory(selectedCategory === ALL_CATEGORIE ? ALL_CATEGORIE : selectedCategory)
    }
    setIsAddPanelOpen((prev) => !prev)
  }

  /** 手动添加链接：URL 校验 → 去重 → 写入 → 关闭面板 */
  const handleAddLink = async () => {
    const url = addUrl.trim()
    if (!url) {
      alert("请输入链接地址")
      return
    }
    try {
      new URL(url)
    } catch {
      alert("请输入合法的链接地址（需包含 http:// 或 https://）")
      return
    }
    if (readingList.some((item) => item.url === url)) {
      alert("该链接已存在于阅读列表中")
      return
    }
    const title = addTitle.trim() || url
    const category = addCategory === ALL_CATEGORIE ? ALL_CATEGORIE : addCategory
    const newItem = createReadingItem(url, title, category)
    await persistReadingList([newItem, ...readingList])
    setIsAddPanelOpen(false)
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

  /** 保存同步配置 */
  const handleSaveSyncConfig = async () => {
    await saveSyncConfig(syncConfig)
    setSyncStatus({ msg: "配置已保存", ok: true })
    setTimeout(() => setSyncStatus(null), 2000)
  }

  /** 手动推送到云端 */
  const handlePushToCloud = async () => {
    setIsSyncing(true)
    setSyncStatus(null)
    const result = await pushToCloud()
    setIsSyncing(false)
    if (result.ok) {
      setSyncStatus({ msg: result.skipped ? "云端数据较新，已跳过推送" : "推送成功", ok: true })
    } else {
      setSyncStatus({ msg: `推送失败: ${result.error}`, ok: false })
    }
  }

  /** 从云端拉取并覆盖本地 */
  const handlePullFromCloud = async () => {
    if (!window.confirm("从云端拉取数据将覆盖本地所有数据，确定继续吗？")) return
    setIsSyncing(true)
    setSyncStatus(null)
    const result = await pullFromCloud()
    setIsSyncing(false)
    if (result.ok) {
      setSyncStatus({ msg: "拉取成功，本地数据已更新", ok: true })
    } else {
      setSyncStatus({ msg: `拉取失败: ${result.error}`, ok: false })
    }
  }

  return (
    <div className="options-container">
      <a
        href={EXTENSION_GITHUB_URL}
        className="github-corner"
        aria-label="View source on GitHub"
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 250 250"
          style={{ fill: "#64CEAA", color: "#fff", position: "absolute", top: 0, border: 0, right: 0 }}
          aria-hidden="true"
        >
          <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
          <path
            d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
            fill="currentColor"
            style={{ transformOrigin: "130px 106px" }}
            className="octo-arm"
          />
          <path
            d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
            fill="currentColor"
            className="octo-body"
          />
        </svg>
      </a>
      <style>{`
        .github-corner:hover .octo-arm{animation:octocat-wave 560ms ease-in-out}
        @keyframes octocat-wave{
          0%,100%{transform:rotate(0)}
          20%,60%{transform:rotate(-25deg)}
          40%,80%{transform:rotate(10deg)}
        }
        @media (max-width:500px){
          .github-corner:hover .octo-arm{animation:none}
          .github-corner .octo-arm{animation:octocat-wave 560ms ease-in-out}
        }
      `}</style>
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
            {/* <button className="test-btn" onClick={() => void handleAddTestData()} title="添加测试数据">
              <i className="ri-test-tube-line"></i>
              添加测试数据
            </button> */}
            <div className="sync-btn-wrapper" onClick={(e) => e.stopPropagation()}>
              <button
                className={`sync-btn ${isSyncPanelOpen ? "active" : ""}`}
                title="云同步设置"
                onClick={() => setIsSyncPanelOpen((v) => !v)}
              >
                <i className="ri-cloud-line"></i>
                云同步
              </button>
              {isSyncPanelOpen && (
                <div className="sync-panel">
                  <div className="sync-panel-title">
                    <div>
                      <div className="sync-panel-heading">
                        <i className="ri-cloud-line"></i> 云同步设置
                      </div>
                      <p className="sync-panel-description">
                        连接你的  <a
                      href={SYNC_SERVICE_GITHUB_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="sync-repo-link"
                    >
                      <i className="ri-github-line"></i>
                      kv-sync
                    </a> 服务。
                      </p>
                    </div>

                  </div>
                  <div className="panel-field">
                    <label>API 地址</label>
                    <input
                      type="url"
                      placeholder="https://your-api.example.com"
                      value={syncConfig.baseUrl}
                      onChange={(e) => setSyncConfig((c) => ({ ...c, baseUrl: e.target.value }))}
                    />
                  </div>
                  <div className="panel-field">
                    <label>API 密钥</label>
                    <input
                      type="password"
                      placeholder="ksk_xxx"
                      value={syncConfig.apiKey}
                      onChange={(e) => setSyncConfig((c) => ({ ...c, apiKey: e.target.value }))}
                    />
                  </div>
                  {syncStatus && (
                    <div className={`sync-status ${syncStatus.ok ? "sync-status-ok" : "sync-status-err"}`}>
                      {syncStatus.msg}
                    </div>
                  )}
                  <div className="panel-actions">
                    <button className="panel-cancel-btn" onClick={() => void handleSaveSyncConfig()}>
                      保存配置
                    </button>
                    <button
                      className="panel-submit-btn"
                      onClick={() => void handlePullFromCloud()}
                      disabled={isSyncing}
                    >
                      <i className="ri-download-cloud-line"></i>拉取
                    </button>
                    <button
                      className="panel-submit-btn"
                      onClick={() => void handlePushToCloud()}
                      disabled={isSyncing}
                    >
                      <i className={isSyncing ? "ri-loader-4-line" : "ri-upload-cloud-line"}></i>
                      {isSyncing ? "同步中…" : "推送"}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="options-content">
        {/* 左侧侧边栏 */}
        <div className="categories-sidebar">
          <div className="sidebar-header">
            <h2>分类管理</h2>
          </div>

          {/* 回收站入口 */}
          <div
            className={`category-item trash-item ${viewMode === "trash" ? "active" : ""}`}
            onClick={() => setViewMode("trash")}
          >
            <i className="ri-delete-bin-line trash-icon"></i>
            <div className="category-name">回收站</div>
            {trash.length > 0 && <div className="category-count">{trash.length}</div>}
          </div>

          <div className="category-list">
            {/* 全部分类 */}
            <div
              className={`category-item ${viewMode === "list" && selectedCategory === ALL_CATEGORIE ? "active" : ""}`}
              onClick={() => handleCategorySelect(ALL_CATEGORIE)}
            >
              <div className="category-name">{ALL_CATEGORIE}</div>
              <div className="category-count">{readingList.length}</div>
            </div>

            {/* 未归档分类 */}
            {activeCategories.map((category, index) => (
              <div
                key={category.name}
                className={`category-item ${viewMode === "list" && selectedCategory === category.name ? "active" : ""}`}
                onClick={() => handleCategorySelect(category.name)}
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
                    <div className="category-name">{category.name}</div>
                    <div className="category-count">
                      {readingList.filter((item) => item.category === category.name).length}
                    </div>
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
                        className="archive-btn"
                        title="归档分类"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleArchiveCategory(category.name)
                        }}
                      >
                        <i className="ri-archive-line"></i>
                      </button>
                      <button
                        className="delete-btn"
                        title="删除分类"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDeleteCategory(category.name)
                        }}
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* 已归档分类区域 */}
          {archivedCategories.length > 0 && (
            <div className="archived-section">
              <div className="archived-section-title">
                <i className="ri-archive-line"></i>
                已归档
              </div>
              {archivedCategories.map((category) => (
                <div key={category.name} className="category-item archived-item">
                  <div className="category-name">{category.name}</div>
                  <div className="category-count">
                    {readingList.filter((item) => item.category === category.name).length}
                  </div>
                  <div className="category-actions">
                    <button
                      className="restore-btn"
                      title="恢复分类"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleRestoreCategory(category.name)
                      }}
                    >
                      <i className="ri-arrow-go-back-line"></i>
                    </button>
                    <button
                      className="delete-btn"
                      title="删除分类"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDeleteCategory(category.name)
                      }}
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

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

        {/* 右侧主区 */}
        <div className="links-container">
          {viewMode === "trash" ? (
            /* 回收站视图 */
            <>
              <div className="links-header">
                <div className="trash-header-title">
                  <i className="ri-delete-bin-line"></i>
                  回收站
                  <span className="trash-count-label">（{trash.length} / 100）</span>
                </div>
                <div className="links-actions">
                  {trash.length > 0 && (
                    <button className="delete-btn empty-trash-btn" onClick={() => void handleEmptyTrash()}>
                      <i className="ri-delete-bin-fill"></i>
                      清空回收站
                    </button>
                  )}
                </div>
              </div>

              <div className="links-list">
                {trash.length === 0 ? (
                  <div className="empty-list">
                    <i className="ri-delete-bin-line"></i>
                    <p>回收站为空</p>
                  </div>
                ) : (
                  <>
                    <div className="links-list-header">
                      <div className="title">标题</div>
                      <div className="url">链接</div>
                      <div className="category">分类</div>
                      <div className="date">删除时间</div>
                      <div className="actions">操作</div>
                    </div>
                    {[...trash].reverse().map((item) => (
                      <div key={item.url} className="link-item">
                        <div className="title" title={item.title}>
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            {item.title}
                          </a>
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
                            className="restore-item-btn"
                            title="还原"
                            onClick={() => void handleRestoreFromTrash(item.url)}
                          >
                            <i className="ri-arrow-go-back-line"></i>
                          </button>
                          <button
                            className="delete-btn"
                            title="永久删除"
                            onClick={() => void handlePermanentDelete(item.url)}
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          ) : (
            /* 正常列表视图 */
            <>
              <div className="links-header">
                <div className="search-box">
                    <i className="ri-search-line"></i>
                    <input type="text" placeholder="搜索链接..." value={searchTerm} onChange={handleSearch} />
                </div>

                  <div className="add-link-wrapper" onClick={(e) => e.stopPropagation()}>
                    <button className="add-link-btn" onClick={toggleAddPanel} title="手动添加链接">
                      <i className="ri-add-circle-line"></i>
                    </button>
                    {isAddPanelOpen && (
                      <div className="add-link-panel">
                        <div className="panel-field">
                          <label>链接地址 <span className="required">*</span></label>
                          <input
                            type="url"
                            placeholder="https://example.com"
                            value={addUrl}
                            onChange={(e) => setAddUrl(e.target.value)}
                            onKeyUp={(e) => e.key === "Enter" && void handleAddLink()}
                            autoFocus
                          />
                        </div>
                        <div className="panel-field">
                          <label>标题（选填）</label>
                          <input
                            type="text"
                            placeholder="留空则使用链接地址"
                            value={addTitle}
                            onChange={(e) => setAddTitle(e.target.value)}
                            onKeyUp={(e) => e.key === "Enter" && void handleAddLink()}
                          />
                        </div>
                        <div className="panel-field">
                          <label>分类</label>
                          <select value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                            {allCategoryNames.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="panel-actions">
                          <button className="panel-cancel-btn" onClick={() => setIsAddPanelOpen(false)}>取消</button>
                          <button className="panel-submit-btn" onClick={() => void handleAddLink()}>
                            <i className="ri-add-line"></i>添加
                          </button>
                        </div>
                      </div>
                    )}
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
                            {activeCategoryNames.map((categoryName) => (
                              <div
                                key={categoryName}
                                className="move-item"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleBatchMove(categoryName)
                                }}
                              >
                                {categoryName}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Options
