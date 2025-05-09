// import { KEYS, storage } from "../../utils/storage";

// // 记录阅读进度的DOM路径和位置信息
// let lastReadingPosition = {
//   domPath: '',
//   textContent: '',
//   scrollTop: 0
// };

// console.log('content.ts loaded!!!!!!!!!!!!!!!!!!!!');

// // 监听页面滚动事件
// // 检查当前页面是否在稍后阅读列表中
// async function isPageInReadLater(): Promise<boolean> {
//   return new Promise((resolve) => {
//     storage.get([KEYS.readLaterLinks], (result) => {
//       const links = result.readLaterLinks || [];
//       const currentUrl = window.location.href;
//       resolve(links.some((link: any) => link.url === currentUrl));
//     });
//   });
// }

// /**
//  * 保存当前阅读位置
//  */
// async function saveCurrentReadingPosition() {
//   // 先检查页面是否在稍后阅读列表中
//   const shouldSave = await isPageInReadLater();
//   if (!shouldSave) {
//     return;
//   }

//   // 获取当前视窗中心点的元素
//   const centerY = window.innerHeight / 2;
//   const element = document.elementFromPoint(window.innerWidth / 2, centerY) as Element;

//   if (element) {
//     // 获取元素的DOM路径
//     const domPath = getDomPath(element);
//     // 获取周围文本内容作为上下文
//     const textContent = element.textContent?.trim().substring(0, 100) || '';

//     lastReadingPosition = {
//       domPath,
//       textContent,
//       scrollTop: window.scrollY
//     };

//     // 保存到storage
//     storage.set({
//       readingProgress: {
//         url: window.location.href,
//         position: lastReadingPosition
//       }
//     });

//     console.log('阅读位置已保存:', lastReadingPosition);
//   }
// }

// // 修改滚动事件监听器
// let scrollTimer: number | null = null;
// window.addEventListener('scroll', () => {
//   if (scrollTimer) {
//     clearTimeout(scrollTimer);
//   }
//   scrollTimer = window.setTimeout(() => {
//     saveCurrentReadingPosition();
//   }, 300);
// });

// // 修改DOM变化监听器
// const observer = new MutationObserver(() => {
//   if (lastReadingPosition.domPath) {
//     saveCurrentReadingPosition();
//   }
// });

// observer.observe(document.body, {
//   childList: true,
//   subtree: true
// });

// /**
//  * 获取元素的DOM路径
//  * @param element 目标元素
//  * @returns DOM路径字符串
//  */
// function getDomPath(element: Element): string {
//   const path: string[] = [];
//   let currentElement = element;

//   while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
//     let selector = currentElement.nodeName.toLowerCase();
//     if (currentElement.id) {
//       selector += '#' + currentElement.id;
//     } else {
//       let sibling = currentElement;
//       let siblingIndex = 1;

//       while (sibling.previousElementSibling) {
//         sibling = sibling.previousElementSibling;
//         if (sibling.nodeName === currentElement.nodeName) {
//           siblingIndex++;
//         }
//       }
//       selector += `:nth-of-type(${siblingIndex})`;
//     }
//     path.unshift(selector);
//     currentElement = currentElement.parentElement as Element;
//   }

//   return path.join(' > ');
// }

// /**
//  * 恢复阅读位置
//  */
// function restoreReadingPosition() {
//   storage.get([ KEYS.readingProgress ], (result) => {
//     const progress = result.readingProgress;
//     if (progress && progress.url === window.location.href) {
//       try {
//         // 尝试通过DOM路径找到元素
//         const element = document.querySelector(progress.position.domPath);
//         if (element) {
//           // 验证文本内容相似度
//           const currentText = element.textContent?.trim().substring(0, 100) || '';
//           if (currentText.includes(progress.position.textContent) ||
//               progress.position.textContent.includes(currentText)) {
//             element.scrollIntoView({
//               behavior: 'smooth',
//               block: 'center'
//             });
//             console.log('阅读位置已恢复:', progress.position);
//             return;
//           }
//         }
//         // 如果DOM路径失效，回退到使用scrollTop
//         window.scrollTo({
//           top: progress.position.scrollTop,
//           behavior: 'smooth'
//         });
//       } catch (error) {
//         console.error('恢复阅读位置失败:', error);
//       }
//     }
//   });
// }

// /**
//  * 高亮并滚动到指定文本
//  * @param text 要高亮的文本
//  */
// function highlightAndScrollToText(text: string) {
//   const bodyText = document.body.innerText;
//   const position = bodyText.indexOf(text);
  
//   if (position !== -1) {
//     // 创建范围
//     const range = document.createRange();
//     const treeWalker = document.createTreeWalker(
//       document.body,
//       NodeFilter.SHOW_TEXT,
//       null
//     );
    
//     let currentPos = 0;
//     let node: Node | null;
    
//     // 遍历文本节点找到目标位置
//     while ((node = treeWalker.nextNode())) {
//       // 确保节点是文本节点
//       if (node.nodeType === Node.TEXT_NODE) {
//         const nodeLength = (node as Text).length;
//         if (currentPos + nodeLength > position) {
//           const offset = position - currentPos;
//           range.setStart(node, offset);
//           range.setEnd(node, offset + text.length);
//           break;
//         }
//         currentPos += nodeLength;
//       }
//     }
    
//     // 创建高亮元素
//     const highlight = document.createElement('mark');
//     highlight.className = 'readit-highlight';
//     range.surroundContents(highlight);
    
//     // 滚动到高亮位置
//     highlight.scrollIntoView({
//       behavior: 'smooth',
//       block: 'center'
//     });
    
//     // 3秒后移除高亮
//     setTimeout(() => {
//       const parent = highlight.parentNode;
//       if (parent) {  // 添加空检查
//         const firstChild = highlight.firstChild;
//         if (firstChild) {  // 添加空检查
//           parent.replaceChild(firstChild, highlight);
//         }
//       }
//     }, 3000);
//   }
// }

// /**
//  * 清除当前页面的阅读进度
//  */
// async function clearReadingProgress() {
//   const currentUrl = window.location.href;
//   storage.get([KEYS.readingProgress], (result) => {
//     if (result.readingProgress?.url === currentUrl) {
//       storage.remove([KEYS.readingProgress]);
//     }
//   });
// }

// // 监听来自 background 的消息，增加移除进度的处理
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.type === 'scrollToText') {
//     const { selectedText } = request;
//     if (selectedText) {
//       highlightAndScrollToText(selectedText);
//     }
//     sendResponse({ success: true });
//   } else if (request.type === 'saveReadingProgress') {
//     saveCurrentReadingPosition();
//     sendResponse({ success: true });
//   } else if (request.type === 'restoreReadingProgress') {
//     restoreReadingPosition();
//     sendResponse({ success: true });
//   } else if (request.type === 'clearReadingProgress') {
//     clearReadingProgress();
//     sendResponse({ success: true });
//   }
//   return true;
// });