
export const ALL_CATEGORIE = "全部"
export const defaultCategories = [
  ALL_CATEGORIE,
] as string[]
export const MAX_CATEGORIE_LENGTH = 16
export const TEST_LINKS_LENGTH = 1
export const EMPTY_STATE_TEXT = "空空如也..."


export const MESSAGE_TYPE = {
    UPDATE_CONTEXT_MENU: 'updateContextMenu',
    SAVE_READING_PROGRESS: 'saveReadingProgress',
    RESTORE_READING_PROGRESS: 'restoreReadingProgress'
}
export const CONTEXT_MENU_ACTION = {
    ADD: 'add',
    REMOVE: 'remove'
}


/**
 * 格式化日期
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const MS_PER_DAY = 86400000

    // 缓存日期组件
    const dateYear = date.getFullYear()
    const dateMonth = date.getMonth()
    const dateDay = date.getDate()
    const nowYear = now.getFullYear()

    // 如果是今天，显示时间
    if (diff < MS_PER_DAY && dateDay === now.getDate()) {
        return `今天 ${date.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })}`
    }

    // 如果是昨天
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (dateDay === yesterday.getDate() && dateMonth === yesterday.getMonth() && dateYear === yesterday.getFullYear()) {
        return "昨天"
    }

    // 日期格式化选项
    const options: Intl.DateTimeFormatOptions = {
        month: "2-digit",
        day: "2-digit",
    }

    // 如果不是今年，添加年份
    if (dateYear !== nowYear) {
        options.year = "numeric"
    }

    // 使用 Intl.DateTimeFormat 进行本地化格式化
    return new Intl.DateTimeFormat("zh-CN", options).format(date).replace(/\//g, "/")
}

// 生成过去30天内的随机时间
const getRandomDate = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const randomTime = thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime());
    return new Date(randomTime).toISOString();
};

/**
 * 提取域名或文件路径
 * @param {string} url - 完整URL或文件路径
 * @returns {string} 提取的域名或文件路径
 */
const extractHostname = (url: string): string => {
    try {
        // 处理file://协议
        if (url.startsWith('file:///')) {
            // 移除file:///前缀并保留路径部分
            return url.substring(8); // Windows路径会保留完整格式如C:/path/to/file
        }
        
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace("www.", "");
        return hostname.length > 0 ? hostname : url;
    } catch (e) {
        // 如果不是有效URL，返回原始输入
        return url;
    }
}



/**
 * 获取当前浏览器的快捷键设置页面URL
 * @returns {string} 浏览器对应的快捷键设置页面URL
 */
const getBrowserShortcutSettingUrl = (): string => {
    const ua = navigator.userAgent.toLowerCase();
    
    // 根据 UserAgent 判断浏览器类型（按市场占有率从高到低排序）
    if (ua.includes('edg')) {
        return 'edge://extensions/shortcuts';  // Microsoft Edge
    } 
    // 默认返回 Chrome 的设置页面（大多数 Chromium 浏览器会匹配这个）
    return 'chrome://extensions/shortcuts';
};

export { formatDate, getRandomDate, extractHostname, getBrowserShortcutSettingUrl }
