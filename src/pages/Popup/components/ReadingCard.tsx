"use client"

import React from "react"
import { useState, useEffect, useRef, type DragEvent } from "react"
import "./ReadingCard.css"
import { ReadingItem } from "../../../utils/typing"
import { ALL_CATEGORIE } from "../../../utils/common"

interface ReadingCardProps {
  item: ReadingItem
  index: number
  onDelete: (url: string) => void
  onEdit: (url: string, newTitle: string) => void
  onChangeCategory: (url: string, category: string) => void // 添加更改分类的处理函数
  onDragStart: (e: DragEvent<HTMLDivElement>, index: number) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDrop: (e: DragEvent<HTMLDivElement>, index: number) => void
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void
  formatDate: (dateString: string) => string
  extractHostname: (url: string) => string
  categories: string[] // 添加分类列表
}

export const ReadingCard: React.FC<ReadingCardProps> = ({
  item,
  index,
  onDelete,
  onEdit,
  onChangeCategory,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  formatDate,
  extractHostname,
  categories,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const categoryMenuRef = useRef<HTMLDivElement>(null)
  const [copyText, setCopyText] = useState<string>('')

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }

    // 点击外部关闭分类菜单
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setShowCategoryMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isEditing, showCategoryMenu])

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsEditing(true)
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.target.value)
  }

  const handleTitleUpdate = () => {
    const newTitle = editTitle.trim()
    if (newTitle) {
      onEdit(item.url, newTitle)
    } else {
      setEditTitle(item.title)
    }
    setIsEditing(false)
  }

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleUpdate()
    } else if (e.key === "Escape") {
      setEditTitle(item.title)
      setIsEditing(false)
    }
  }

  const handleCardClick = () => {
    if (!isEditing && !showCategoryMenu) {
      window.open(item.url, "_blank")
    }
  }

  /**
   * 处理复制链接
   * @param {React.MouseEvent} e - 点击事件对象
   * @description 复制链接到剪贴板并临时显示提示信息
   */
const handleCopyLink = (e: React.MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
  navigator.clipboard.writeText(item.url)
    .then(() => {
      setCopyText('复制成功！')
      setTimeout(() => setCopyText(''), 1500)
    })
    .catch(() => {
      setCopyText('复制失败！')
      setTimeout(() => setCopyText(''), 1500)
    })
}

  return (
    <div
      className="card"
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      <div className="card-content" onClick={handleCardClick}>
        <div className="card-title" title={item.title}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="edit-title-input"
              value={editTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleUpdate}
              onKeyUp={handleKeyUp}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            item.title
          )}
        </div>
        <div className="card-meta">
          <div className="card-url">
            <i className="ri-link" onClick={handleCopyLink} title={`点击复制链接`}></i>
            <span title={item.url}>{copyText || extractHostname(item.url)}</span>
          </div>
          <div className="card-date" title={item.addedAt}>
            <i className="ri-time-line"></i>
            {formatDate(item.addedAt)}
          </div>
          {item.category && item.category !== ALL_CATEGORIE && (
            <div className="card-category" title={`分类: ${categories.find(c => c === item.category)}`}>
              <i className="ri-price-tag-3-line"></i>
              {categories.find(c => c === item.category)}
            </div>
          )}
        </div>
      </div>
      <div className="card-actions">
        <button className="edit-btn" title="编辑" onClick={handleEditClick}>
          <i className="ri-edit-line"></i>
        </button>
        <button
          className="delete-btn"
          title="删除"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onDelete(item.url)
          }}
        >
          <i className="ri-delete-bin-line"></i>
        </button>
      </div>
    </div>
  )
}
