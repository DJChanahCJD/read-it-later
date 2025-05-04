import { useState, useEffect } from 'react';
import StorageService from '../utils/StorageService';
import { ReadingItem } from '../utils/types';
import { ALL_CATEGORIE } from '../utils/common';

/**
 * 阅读列表状态管理 Hook
 * @returns 阅读列表相关状态和方法
 */
export const useReadingList = () => {
  const [readingList, setReadingList] = useState<ReadingItem[]>([]);
  const [filteredList, setFilteredList] = useState<ReadingItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIE);

  // 加载数据
  useEffect(() => {
    loadData();
    
    // 监听存储变化
    const handleStorageChange = (changes: any) => {
      if (changes.readLaterLinks) {
        loadData();
      }
    };
    
    StorageService.addChangeListener(handleStorageChange);
    return () => StorageService.removeChangeListener(handleStorageChange);
  }, []);

  // 加载数据
  const loadData = async () => {
    const links = await StorageService.get<ReadingItem[]>('readLaterLinks') || [];
    setReadingList(links);
    applyFilters(links, searchTerm, selectedCategory);
  };

  // 应用过滤器
  const applyFilters = (links: ReadingItem[], term: string, category: string) => {
    let filtered = links;
    
    if (term) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(term.toLowerCase()) || 
        item.url.toLowerCase().includes(term.toLowerCase())
      );
    }
    
    if (category !== ALL_CATEGORIE) {
      filtered = filtered.filter(item => item.category === category);
    }
    
    setFilteredList(filtered);
  };

  // 搜索处理
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setTimeout(() => {
      applyFilters(readingList, term, selectedCategory);
    }, 200);
  };

  // 分类选择处理
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    applyFilters(readingList, searchTerm, category);
  };

  return {
    readingList,
    filteredList,
    searchTerm,
    selectedCategory,
    handleSearch,
    handleCategorySelect,
    applyFilters,
    setReadingList
  };
};