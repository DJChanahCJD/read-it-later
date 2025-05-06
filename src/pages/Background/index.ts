import { ALL_CATEGORIE, CONTEXT_MENU_ACTION, MESSAGE_TYPE } from "../../utils/common"
import { KEYS, redisStorage } from "../../utils/storage"
import { ReadingItem, Tab } from "../../utils/typing"


const ADD_TO_READLATER_MENU_ID = "add-to-readlater"
let ADD_TO_TEXT = "添加到稍后阅读"
let REMOVE_FROM_TEXT = "取消添加"


// 声明全局变量类型
declare global {
  interface Window {
    myExtensionLoaded?: boolean;
  }
}

// 获取当前快捷键设置
chrome.commands.getAll((commands) => {
  const addCommand = commands.find(cmd => cmd.name === ADD_TO_READLATER_MENU_ID)
  if (addCommand?.shortcut) {
    ADD_TO_TEXT += ` (${addCommand.shortcut})`
    REMOVE_FROM_TEXT += ` (${addCommand.shortcut})`
    // 更新现有菜单
    chrome.contextMenus.update(ADD_TO_READLATER_MENU_ID, { title: ADD_TO_TEXT })
  }
})

/**
 * 创建右键菜单
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: ADD_TO_READLATER_MENU_ID,
    title: ADD_TO_TEXT,
    contexts: ["link", "page"],
  })
})

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === ADD_TO_READLATER_MENU_ID) {
    const url = info.linkUrl || info.pageUrl
    const title = info.linkUrl ? info.selectionText || url : tab?.title
    handleAddOrRemoveLink(url, title, tab)
  }
  await redisStorage.set('user:123', JSON.stringify({name: '张三'}));
  console.log('redisStorage:', redisStorage);
})

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === ADD_TO_READLATER_MENU_ID) {
    console.log("Shortcut command triggered")
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0] as chrome.tabs.Tab
      if (currentTab.url) {
        handleAddOrRemoveLink(currentTab.url || '', currentTab.title || '', currentTab)
      }
    })
  }
})

// 添加消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request)
  if (request.type === MESSAGE_TYPE.UPDATE_CONTEXT_MENU) {
    if (request.action === CONTEXT_MENU_ACTION.ADD) {
      updateContextMenuTitle(ADD_TO_READLATER_MENU_ID, REMOVE_FROM_TEXT)
      updateExtensionIcon(true)
    } else if (request.action === CONTEXT_MENU_ACTION.REMOVE) {
      updateContextMenuTitle(ADD_TO_READLATER_MENU_ID, ADD_TO_TEXT)
      updateExtensionIcon(false)
    }
  }
})

/**
 * 更新扩展图标状态
 * @param {boolean} exists - 当前页面是否已在稍后阅读列表中
 * @param {number} tabId - 目标标签页ID
 * @description 根据页面状态动态切换图标
 */
function updateExtensionIcon(exists : boolean, tabId? : number) {
  try {
    // const iconPaths = {
    //   active: {
    //     "128": "icon-128-active.png"
    //   },
    //   default: {
    //     "128": "icon-128.png"
    //   }
    // };
    // // const iconPath = exists? iconPaths.active : iconPaths.default;
    // chrome.action.setIcon({ path: iconPath, tabId }, () => {
    //   if (chrome.runtime.lastError) {
    //     console.error("设置图标失败:", chrome.runtime.lastError);
    //   }
    // });
    chrome.action.setBadgeText({ text: exists ? '1' : '' });
    console.log("3. Updated extension icon:", exists);
    
  } catch (error) {
    console.error('图标更新失败:', error);
  }
}

// 修改添加/移除链接的处理函数
const handleAddOrRemoveLink = (url :Tab['url'], title: Tab['title'] , tab: Tab | undefined) => {
  chrome.storage.local.get([KEYS.readLaterLinks], (result) => {
    const links = result.readLaterLinks || [];
    const exists = links.some((link: ReadingItem) => link.url === url);

    if (!exists) {
      links.unshift({
        url: url,
        title: title,
        addedAt: new Date().toISOString(),
        category: ALL_CATEGORIE,
      });

      chrome.storage.local.set({ readLaterLinks: links });
      updateContextMenuTitle(ADD_TO_READLATER_MENU_ID, REMOVE_FROM_TEXT);
      // 更新图标状态为已添加
      if (tab) updateExtensionIcon(true, tab.id);
    } else {
      const updatedLinks = links.filter((link : ReadingItem) => link.url !== url);
      chrome.storage.local.set({ readLaterLinks: updatedLinks });
      updateContextMenuTitle(ADD_TO_READLATER_MENU_ID, ADD_TO_TEXT);
      // 更新图标状态为未添加
      if (tab) updateExtensionIcon(false, tab.id);
    }
  });
};

// 更新右键菜单
function updateContextMenuTitle(id: string, title: string) {
  chrome.contextMenus.update(id, { title: title })
  console.log("2. Updated context menu title:\n" + title)
}

/**
 * 处理标签页状态更新
 * @param {number} tabId - 标签页ID
 * @description 检查标签页URL是否已保存并更新扩展状态
 */
async function handleTabUpdate(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url) return;

    console.log("1. Processing tab:", tab.url);
    
    const result = await chrome.storage.local.get([KEYS.readLaterLinks]);
    const links = result.readLaterLinks || [];
    const exists = links.some((link: ReadingItem) => link.url === tab.url);
    
    // 更新右键菜单 - 修复此处传参方式
    const title = exists ? REMOVE_FROM_TEXT : ADD_TO_TEXT;
    updateContextMenuTitle(ADD_TO_READLATER_MENU_ID, title); // 直接传入title字符串
    
    // 更新扩展图标状态
    updateExtensionIcon(exists, tab.id);
  } catch (error) {
    console.error("Error handling tab update:", error);
  }
}

// 监听标签页切换事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // 获取前一个标签页ID
  const tabs = await chrome.tabs.query({});
  const previousTab = tabs.find(tab => tab.id !== activeInfo.tabId && tab.active);
  
  // 如果存在前一个标签页，保存其阅读进度
  if (previousTab?.id) {
    try {
      await chrome.tabs.sendMessage(previousTab.id, { type: MESSAGE_TYPE.SAVE_READING_PROGRESS });
      console.log('保存阅读进度:', previousTab.id);
    } catch (error) {
      console.log('保存阅读进度失败:', error);
    }
  }
  
  handleTabUpdate(activeInfo.tabId);
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    handleTabUpdate(tabId);

    // 在 background.js 中检查
    if (tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return !!window.myExtensionLoaded;
        },
      }, (results) => {
        if (results && results[0]) {
          console.log("注入状态:", results[0].result);
        }
      });
    }
    // 等待页面加载完成后再尝试恢复阅读进度
    setTimeout(() => {
      try {
        chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPE.RESTORE_READING_PROGRESS });
        console.log('恢复阅读进度:', tabId);
      } catch (error) {
        console.log('恢复阅读进度失败:', error);
      }
    }, 500);
  }
});

// chrome.runtime.onMessageExternal.addListener( (request, sender, sendResponse) => {
//   console.log("Received message from " + sender + ": ", request);
//   sendResponse({ received: true }); //respond however you like
// });