/**
 * 存储服务 - 统一管理 chrome.storage.local 操作
 * @author Trae
 * @created 2024-01-20
 */
class StorageService {
  /**
   * 获取存储数据
   * @param key 存储键名
   * @returns Promise<T> 存储的数据
   */
  static async get<T>(key: string): Promise<T> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  /**
   * 设置存储数据
   * @param key 存储键名
   * @param value 要存储的数据
   */
  static async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  /**
   * 监听存储变化
   * @param callback 回调函数
   */
  static addChangeListener(callback: (changes: any) => void): void {
    chrome.storage.onChanged.addListener(callback);
  }

  /**
   * 移除存储变化监听
   * @param callback 回调函数
   */
  static removeChangeListener(callback: (changes: any) => void): void {
    chrome.storage.onChanged.removeListener(callback);
  }
}

export default StorageService;