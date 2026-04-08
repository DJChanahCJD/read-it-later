/**
 * 云同步服务 - 负责与 Cloudflare Pages Function API 通信
 *
 * 提供：
 *   - pushToCloud：将本地数据全量上传到 KV
 *   - pullFromCloud：从 KV 拉取数据并写入本地存储
 *   - getSyncConfig / saveSyncConfig：读写同步配置
 */

import { KEYS, storageGet, storageSet } from "@/utils/storage"
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
 * 将本地数据全量推送到 Cloudflare KV（last-write-wins）
 */
export async function pushToCloud(): Promise<SyncResult> {
  const config = await getSyncConfig()
  if (!config?.apiUrl || !config?.apiSecret) {
    return { ok: false, error: "未配置同步地址或密钥" }
  }

  const [links, categories, trash] = await Promise.all([
    storageGet<{ [KEYS.readLaterLinks]: ReadingItem[] }>([KEYS.readLaterLinks]),
    storageGet<{ [KEYS.readLaterCategories]: Category[] }>([KEYS.readLaterCategories]),
    storageGet<{ [KEYS.readLaterTrash]: ReadingItem[] }>([KEYS.readLaterTrash]),
  ])

  const payload: SyncPayload = {
    updatedAt: Date.now(),
    links: links[KEYS.readLaterLinks] ?? [],
    categories: categories[KEYS.readLaterCategories] ?? [],
    trash: trash[KEYS.readLaterTrash] ?? [],
  }

  try {
    const res = await fetch(`${config.apiUrl.replace(/\/$/, "")}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Secret": config.apiSecret,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` }
    }

    const json = (await res.json()) as { ok?: boolean; skipped?: boolean; error?: string }
    if (json.error) return { ok: false, error: json.error }
    return { ok: true, skipped: json.skipped }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * 从 Cloudflare KV 拉取数据并覆盖本地存储
 */
export async function pullFromCloud(): Promise<SyncResult> {
  const config = await getSyncConfig()
  if (!config?.apiUrl || !config?.apiSecret) {
    return { ok: false, error: "未配置同步地址或密钥" }
  }

  try {
    const res = await fetch(`${config.apiUrl.replace(/\/$/, "")}/api/sync`, {
      method: "GET",
      headers: { "X-API-Secret": config.apiSecret },
    })

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` }
    }

    const json = (await res.json()) as { data: SyncPayload | null }
    if (!json.data) {
      return { ok: false, error: "云端暂无数据" }
    }

    const { links, categories, trash } = json.data
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
