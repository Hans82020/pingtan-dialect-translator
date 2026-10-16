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

const routes = {}
for (const [route, file] of [
  ['/api/translate', '../api/translate.js'],
  ['/api/asr', '../api/asr.js'],
  ['/api/audio', '../api/audio.js'],
  ['/api/tts', '../api/tts.js']
]) {
  try {
    routes[route] = (await import(file)).default
  } catch (e) {
    console.warn(`[dev-server] 跳过路由 ${route}：${file} 未就绪（${e?.code || e?.message || e}），实现后重启即挂载`)
  }
}

http.createServer(async (req, res) => {
  const h = routes[req.url.split('?')[0]]
  if (!h) { res.statusCode = 404; return res.end('not found') }
  try { await h(req, res) } catch (e) { res.statusCode = 500; res.end(String(e)) }
}).listen(8787, () => console.log('API dev server: http://localhost:8787'))
