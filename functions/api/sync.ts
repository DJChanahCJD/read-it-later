/**
 * Cloudflare Pages Function - 数据同步 API
 *
 * GET  /api/sync  → 从 KV 读取全量数据
 * POST /api/sync  → 写入全量数据（last-write-wins，带 updatedAt 时间戳）
 *
 * 认证方式：请求头 X-API-Secret 与环境变量 API_SECRET 比对
 *
 * 所需环境变量（Cloudflare Pages 项目设置中配置）：
 *   API_SECRET   - 自定义密钥字符串
 *   READ_LATER_KV - KV Namespace binding（在 Pages 项目绑定）
 */

// Cloudflare Workers KV 类型声明（避免依赖 @cloudflare/workers-types）
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PagesFunction<E = Record<string, unknown>> = (context: { request: Request; env: E; [key: string]: any }) => Response | Promise<Response>

interface Env {
  READ_LATER_KV: KVNamespace
  API_SECRET: string
}

interface SyncPayload {
  updatedAt: number
  links: unknown[]
  categories: unknown[]
  trash: unknown[]
}

const KV_KEY = "read-later-data"
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Secret",
}

/**
 * 校验 API Secret
 */
function isAuthorized(request: Request, env: Env): boolean {
  const secret = request.headers.get("X-API-Secret")
  return !!env.API_SECRET && secret === env.API_SECRET
}

/**
 * 构造 JSON 响应
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // 处理 CORS 预检请求
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }

  // 认证校验
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  // GET：读取数据
  if (request.method === "GET") {
    const raw = await env.READ_LATER_KV.get(KV_KEY)
    if (!raw) {
      return jsonResponse({ data: null })
    }
    return jsonResponse({ data: JSON.parse(raw) })
  }

  // POST：写入数据（last-write-wins）
  if (request.method === "POST") {
    let body: SyncPayload
    try {
      body = (await request.json()) as SyncPayload
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400)
    }

    if (!body.updatedAt || !Array.isArray(body.links) || !Array.isArray(body.categories)) {
      return jsonResponse({ error: "Missing required fields" }, 400)
    }

    // 读取现有数据，比较时间戳，仅在更新时间更新时才写入
    const existing = await env.READ_LATER_KV.get(KV_KEY)
    if (existing) {
      const current = JSON.parse(existing) as SyncPayload
      if (current.updatedAt > body.updatedAt) {
        return jsonResponse({ skipped: true, serverUpdatedAt: current.updatedAt })
      }
    }

    await env.READ_LATER_KV.put(KV_KEY, JSON.stringify(body))
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ error: "Method not allowed" }, 405)
}
