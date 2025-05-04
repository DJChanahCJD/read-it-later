// ... existing code ...

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'scrollToText') {
    const { selectedText } = request;
    if (selectedText) {
      highlightAndScrollToText(selectedText);
    }
  }
});

// 高亮并滚动到指定文本
function highlightAndScrollToText(text: string) {
  const bodyText = document.body.innerText;
  const position = bodyText.indexOf(text);
  
  if (position !== -1) {
    // 创建范围
    const range = document.createRange();
    const treeWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let currentPos = 0;
    let node: Node | null;
    
    // 遍历文本节点找到目标位置
    while ((node = treeWalker.nextNode())) {
      // 确保节点是文本节点
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = (node as Text).length;
        if (currentPos + nodeLength > position) {
          const offset = position - currentPos;
          range.setStart(node, offset);
          range.setEnd(node, offset + text.length);
          break;
        }
        currentPos += nodeLength;
      }
    }
    
    // 创建高亮元素
    const highlight = document.createElement('mark');
    highlight.className = 'readit-highlight';
    range.surroundContents(highlight);
    
    // 滚动到高亮位置
    highlight.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    // 3秒后移除高亮
    setTimeout(() => {
      const parent = highlight.parentNode;
      if (parent) {  // 添加空检查
        const firstChild = highlight.firstChild;
        if (firstChild) {  // 添加空检查
          parent.replaceChild(firstChild, highlight);
        }
      }
    }, 3000);
  }
}