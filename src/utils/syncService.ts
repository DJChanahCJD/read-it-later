/**
 * 云同步服务 - 基于 @djchan/kv-sync SDK
 *
 * 提供：
 *   - pushToCloud：mergeAndSync，本地 updatedAt 较新则覆盖远端，否则跳过
 *   - pullFromCloud：从 KV 拉取快照并写入本地存储
 *   - getSyncConfig / saveSyncConfig：读写同步配置
 */

import { createKvSyncClient } from "@djchan/kv-sync"
import { KEYS, storageGet, storageSet } from "@/utils/storage"
import { APP_ID } from "@/utils/typing"
import type { Category, ReadingItem, SyncConfig, SyncPayload, SyncResult } from "@/utils/typing"

const SYNC_CONFIG_KEY = "readLaterSyncConfig"

// ──────────────────────────────────────────────
// 配置读写
// ──────────────────────────────────────────────

/** 读取同步配置 */
export async function getSyncConfig(): Promise<SyncConfig | null> {
  const result = await chrome.storage.local.get(SYNC_CONFIG_KEY)
  return (result[SYNC_CONFIG_KEY] as SyncConfig) ?? null
}

/** 保存同步配置 */
export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await chrome.storage.local.set({ [SYNC_CONFIG_KEY]: config })
}

// ──────────────────────────────────────────────
// 核心同步逻辑
// ──────────────────────────────────────────────

/**
 * 将本地数据推送到 Cloudflare KV
 * 使用 mergeAndSync：先拉远端，本地 updatedAt 较新则覆盖，否则跳过
 */
export async function pushToCloud(): Promise<SyncResult> {
  const config = await getSyncConfig()
  if (!config?.baseUrl || !config?.apiKey) {
    return { ok: false, error: "未配置同步地址或密钥" }
  }

  const [linksRes, categoriesRes, trashRes] = await Promise.all([
    storageGet<{ [KEYS.readLaterLinks]: ReadingItem[] }>([KEYS.readLaterLinks]),
    storageGet<{ [KEYS.readLaterCategories]: Category[] }>([KEYS.readLaterCategories]),
    storageGet<{ [KEYS.readLaterTrash]: ReadingItem[] }>([KEYS.readLaterTrash]),
  ])

  const localPayload: SyncPayload = {
    updatedAt: Date.now(),
    links: linksRes[KEYS.readLaterLinks] ?? [],
    categories: categoriesRes[KEYS.readLaterCategories] ?? [],
    trash: trashRes[KEYS.readLaterTrash] ?? [],
  }

  const client = createKvSyncClient({
    baseUrl: config.baseUrl,
    appId: APP_ID,
    apiKey: config.apiKey,
  })

  try {
    let skipped = false

    await client.mergeAndSync({
      merge(remote) {
        const remotePayload = remote as SyncPayload | null
        // 远端存在且 updatedAt 更新，则保留远端（跳过本地写回）
        if (remotePayload && remotePayload.updatedAt >= localPayload.updatedAt) {
          skipped = true
          return remotePayload
        }
        return localPayload
      },
    })

    return { ok: true, skipped }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * 从 Cloudflare KV 拉取快照并覆盖本地存储
 */
export async function pullFromCloud(): Promise<SyncResult> {
  const config = await getSyncConfig()
  if (!config?.baseUrl || !config?.apiKey) {
    return { ok: false, error: "未配置同步地址或密钥" }
  }

  const client = createKvSyncClient({
    baseUrl: config.baseUrl,
    appId: APP_ID,
    apiKey: config.apiKey,
  })

  try {
    const result = await client.get<SyncPayload>()
    if (!result) {
      return { ok: false, error: "云端暂无数据" }
    }

    const { links, categories, trash } = result.value
    await storageSet({
      [KEYS.readLaterLinks]: links,
      [KEYS.readLaterCategories]: categories,
      [KEYS.readLaterTrash]: trash,
    })

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
