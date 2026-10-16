import http from 'node:http'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const envFile = fileURLToPath(new URL('../.env.local', import.meta.url))
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

// EdgeOne Pages Node Functions 格式：default 导出 onRequest({ request, env })，返回 Web Response。
// 本地用适配器把 Node req/res 转成 Web Request/Response，模拟线上运行时。
const routes = {}
for (const [route, file] of [
  ['/api/translate', '../node-functions/api/translate.js'],
  ['/api/asr', '../node-functions/api/asr.js'],
  ['/api/audio', '../node-functions/api/audio.js'],
  ['/api/tts', '../node-functions/api/tts.js']
]) {
  try {
    routes[route] = (await import(file)).default
  } catch (e) {
    console.warn(`[dev-server] 跳过路由 ${route}：${file} 未就绪（${e?.code || e?.message || e}），实现后重启即挂载`)
  }
}

function nodeReqToRequest(req) {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(',') : String(v))
  return new Request(`http://127.0.0.1:8787${req.url}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    duplex: 'half'
  })
}

async function writeResponse(res, resp) {
  const headers = {}
  resp.headers.forEach((v, k) => { headers[k] = v })
  res.writeHead(resp.status, headers)
  res.end(Buffer.from(await resp.arrayBuffer()))
}

http.createServer(async (req, res) => {
  const handler = routes[req.url.split('?')[0]]
  if (!handler) { res.statusCode = 404; return res.end('not found') }
  try {
    await writeResponse(res, await handler({ request: nodeReqToRequest(req), env: process.env }))
  } catch (e) {
    res.statusCode = 500
    res.end(String(e?.stack || e))
  }
}).listen(8787, '127.0.0.1', () => console.log('API dev server: http://localhost:8787'))
