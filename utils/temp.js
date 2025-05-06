chrome.storage.local.get(['readLaterLinks', 'readLaterCategories'], function(result) {
    // 修改分类列表，确保第一个是"全部"
    const categories = result.readLaterCategories || [];
    categories[0] = '全部';
    
    // 修改链接列表，将错误分类改回"全部"
    const links = result.readLaterLinks || [];
    const updatedLinks = links.map(link => {
      if (link.category === categories[0] && link.category !== '全部') {
        return { ...link, category: '全部' };
      }
      return link;
    });
    
    // 保存更新后的数据
    chrome.storage.local.set({
      readLaterCategories: categories,
      readLaterLinks: updatedLinks
    }, function() {
      console.log('分类已恢复');
    });
  });