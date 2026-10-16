# 平潭话翻译器 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建零成本 H5 双向语音翻译器：普通话⇄平潭话（闽东语），词库优先 + LLM 兜底 + 真人录音播放，可部署到 Vercel 手机使用。

**Architecture:** Vue3+Vite+Vant PWA 前端；`api/` 目录 Vercel Serverless Functions 后端（纯 fetch 调智谱 GLM-4-Flash 翻译、DashScope Qwen2-Audio 语音转写、msedge-tts 朗读）；词库 JSON 打包进前端并支持远程合并；本地开发用 `scripts/dev-server.mjs` 复用同一批 api 处理函数。

**Tech Stack:** Vue 3 / Vite / Vant 4 / vue-router(hash) / vite-plugin-pwa / recorder-core(WAV 录音) / msedge-tts / Node 18+ 内置 `node:test`。

**设计文档:** `docs/specs/2026-10-16-pingtan-dialect-translator-design.md`

---

## 环境与执行约定（必读）

- **OS**: Windows 11，PowerShell 5。**命令分隔用 `;`，不支持 `&&` 与 heredoc**。
- **git** 可能不在 PATH：若 `git` 报"无法识别"，用完整路径 `& "C:\Program Files\Git\bin\git.exe" ...`（下文简写 `git`）。
- **Node ≥ 18.17 必需**（Task 0 检查；未装则请用户安装 LTS 或授权 winget 安装）。
- 每个任务结束必须 commit（PowerShell 下多行提交信息用多个 `-m` 参数）。
- 涉及密钥的值永不写入代码/文档；本地放 `.env.local`（已 gitignore），线上配 Vercel 环境变量。

## 文件结构（职责总览）

```
api/                       # Vercel Functions（Node 18，ESM）
  _lib/http.mjs            # 响应/错误码/读请求体（供所有函数与 dev-server 复用）
  _lib/zhipu.mjs           # GLM-4-Flash 客户端 + SYSTEM_PROMPT + 结果解析
  _lib/dashscope.mjs       # Qwen2-Audio 转写客户端（普通话/平潭话两套 prompt）
  _lib/tts.mjs             # Edge TTS → mp3 Buffer
  translate.js             # POST /api/translate  {text}
  asr.js                   # POST /api/asr        {audioBase64, mime} 普通话转写
  audio.js                 # POST /api/audio      {audioBase64, mime} 方言→普通话
  tts.js                   # POST /api/tts        {text} → audio/mpeg
scripts/
  dev-server.mjs           # 本地 :8787 挂载 api/*.js（Vite 代理目标）
  validate-phrases.mjs     # 词库校验（npm run validate）
  gen-icons.mjs            # SVG → PWA PNG 图标
  audio-report.mjs         # Phase 3：待录音清单
src/
  main.js / router.js / App.vue
  lib/match.js             # 词库匹配（前端，编辑距离）
  lib/phrases.js           # 词库加载 + 远程 JSON 合并
  lib/recorder.mjs         # recorder-core WAV 录音封装（时长限制）
  lib/api.mjs              # 前端 API 封装（超时/重试/错误码/音频base64/TTS）
  store/settings.js        # 方向、实验开关、远程词库 URL、收藏（localStorage）
  views/HomeView.vue       # 双向翻译主界面
  views/PhrasebookView.vue # 词库分类浏览+搜索
  views/FavoritesView.vue  # 收藏
  views/SettingsView.vue   # 设置/免责声明
  components/ResultCard.vue / RecordButton.vue / MicBanner.vue
data/phrases.json          # 词库主数据（构建时打包）
public/icon.svg, public/icons/, public/audio/   # 静态资源
tests/                     # node:test 单测（match/validate/translate/dashscope）
index.html / vite.config.js / vercel.json / .env.local.example / .gitignore
```

---

## Phase 1 · MVP

### Task 0: 环境自检

- [ ] **Step 1: 检查工具链**

运行：`node -v; npm -v; git --version`
预期：node ≥ 18.17、npm ≥ 9、git 2.x。任何一项缺失：**停下告知用户**（Node 缺失 → 请用户安装 LTS 或授权 `winget install OpenJS.NodeJS.LTS`；git 已装）。

### Task 1: 项目脚手架

**Files:** Create: `package.json`, `vite.config.js`, `index.html`, `vercel.json`, `.gitignore`, `.env.local.example`, `public/icon.svg`

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "pingtan-dialect-translator",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev:api": "node scripts/dev-server.mjs",
    "dev:web": "vite",
    "dev": "concurrently \"npm:dev:api\" \"npm:dev:web\"",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test tests/",
    "validate": "node scripts/validate-phrases.mjs",
    "icons": "node scripts/gen-icons.mjs"
  },
  "dependencies": {
    "msedge-tts": "^1.3.4",
    "recorder-core": "^1.2.24060100",
    "vant": "^4.9.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "concurrently": "^9.0.0",
    "sharp": "^0.33.0",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.21.0"
  }
}
```

- [ ] **Step 2: 写 vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '平潭话翻译器',
        short_name: '平潭话',
        description: '平潭话与普通话双向语音翻译',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d3557',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: { proxy: { '/api': 'http://localhost:8787' } }
})
```

- [ ] **Step 3: 写 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/pwa-192.png" />
    <title>平潭话翻译器</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: 写 vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": { "api/**/*.js": { "maxDuration": 30 } },
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

- [ ] **Step 5: 写 .gitignore 与 .env.local.example**

`.gitignore`:

```
node_modules/
dist/
.env.local
.vercel/
```

`.env.local.example`:

```
ZHIPU_API_KEY=在此粘贴智谱开放平台APIKey
DASHSCOPE_API_KEY=在此粘贴阿里云百炼APIKey
```

- [ ] **Step 6: 写 public/icon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="256" fill="#1d3557"/>
  <circle cx="256" cy="256" r="200" fill="#e63946"/>
  <text x="256" y="310" font-size="220" font-family="serif" font-weight="bold" fill="#ffffff" text-anchor="middle">平</text>
  <path d="M80 430 Q156 392 232 430 T384 430 T504 430" stroke="#ffffff" stroke-width="16" fill="none" opacity="0.85"/>
</svg>
```

- [ ] **Step 7: 安装依赖**

运行：`npm install`
预期：无 error 退出。

- [ ] **Step 8: Commit**

```powershell
git add package.json vite.config.js index.html vercel.json .gitignore .env.local.example public/icon.svg
git commit -m "chore: 项目脚手架（Vite+Vue3+Vant+PWA+Vercel Functions）"
```

### Task 2: 词库数据与校验脚本（TDD）

**Files:** Create: `scripts/validate-phrases.mjs`, `tests/validate.test.mjs`, `data/phrases.json`

- [ ] **Step 1: 写校验的失败测试 tests/validate.test.mjs**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePhrases } from '../scripts/validate-phrases.mjs'

const good = { id: 'greeting_001', category: 'greeting', zh: '你好', pt_hanzi: '汝好',
  pt_buc: 'Nṳ̄ hō', pt_rom: 'ny3 ho2', tones: '阳上-阴平', audio: null, note: 'x' }

test('合法词条通过', () => {
  const r = validatePhrases([good])
  assert.equal(r.errors.length, 0)
})
test('id 格式错误被抓出', () => {
  const r = validatePhrases([{ ...good, id: 'G001' }])
  assert.ok(r.errors.some(e => e.includes('id')))
})
test('非法声调被抓出', () => {
  const r = validatePhrases([{ ...good, tones: '上声' }])
  assert.ok(r.errors.some(e => e.includes('声调')))
})
test('id 重复被抓出', () => {
  const r = validatePhrases([good, { ...good }])
  assert.ok(r.errors.some(e => e.includes('重复')))
})
test('未录音记为 warning', () => {
  const r = validatePhrases([good])
  assert.ok(r.warnings.length >= 1)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`npm test`
预期：FAIL（找不到 validate-phrases.mjs 导出）。

- [ ] **Step 3: 实现 scripts/validate-phrases.mjs**

```js
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const CATEGORIES = ['greeting', 'daily', 'food', 'shopping', 'transport',
  'emergency', 'weather', 'family', 'numbers', 'other']
export const TONES = ['阴平', '阳平', '阴上', '阳上', '阴去', '阳去', '阴入', '阳入']

export function validatePhrases(list, { audioDir = 'public' } = {}) {
  const errors = [], warnings = [], seen = new Set()
  list.forEach((p, i) => {
    const at = `#${i}(${p?.id || '?'})`
    if (!p || typeof p !== 'object') return errors.push(`${at}: 非对象`)
    if (!/^[a-z]+_\d{3}$/.test(p.id || '')) errors.push(`${at}: id 格式应为 xxx_001`)
    if (seen.has(p.id)) errors.push(`${at}: id 重复`)
    seen.add(p.id)
    if (!CATEGORIES.includes(p.category)) errors.push(`${at}: category 非法 ${p.category}`)
    for (const k of ['zh', 'pt_hanzi']) if (!p[k]) errors.push(`${at}: 缺少 ${k}`)
    for (const k of ['pt_buc', 'pt_rom', 'note'])
      if (p[k] != null && typeof p[k] !== 'string') errors.push(`${at}: ${k} 应为字符串或 null`)
    if (p.tones) for (const t of String(p.tones).split('-'))
      if (!TONES.includes(t)) errors.push(`${at}: 声调非法 ${t}`)
    if (p.audio) {
      if (!fs.existsSync(path.join(audioDir, p.audio))) errors.push(`${at}: 音频文件不存在 ${p.audio}`)
    } else warnings.push(`${at}: 未录音`)
  })
  return { errors, warnings }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(fs.readFileSync('data/phrases.json', 'utf8'))
  const { errors, warnings } = validatePhrases(data)
  warnings.forEach(w => console.log('WARN ', w))
  errors.forEach(e => console.error('ERROR', e))
  console.log(`共 ${data.length} 条，错误 ${errors.length}，警告 ${warnings.length}`)
  process.exit(errors.length ? 1 : 0)
}
```

- [ ] **Step 4: 运行测试确认通过**

运行：`npm test`
预期：全部 PASS。

- [ ] **Step 5: 写种子词库 data/phrases.json（12 条起步，全部标注待校对）**

```json
[
  {"id":"greeting_001","category":"greeting","zh":"你好","pt_hanzi":"汝好","pt_buc":"Nṳ̄ hō","pt_rom":"ny3 ho2","tones":"阳上-阴平","audio":null,"note":"通用问候，待本地人校对"},
  {"id":"greeting_002","category":"greeting","zh":"吃了吗？","pt_hanzi":"食罢未？","pt_buc":"Siăh-bà-muôi?","pt_rom":"siah4 ba3 muoi5","tones":"阴入-阴去-阳去","audio":null,"note":"日常问候，待校对"},
  {"id":"greeting_003","category":"greeting","zh":"谢谢","pt_hanzi":"起动","pt_buc":"Kī-dṳ̆ng","pt_rom":"ki3 dyng3","tones":"阴去-阳去","audio":null,"note":"福州话以'起动'表感谢，待校对"},
  {"id":"greeting_004","category":"greeting","zh":"再见","pt_hanzi":"再会","pt_buc":"Cái-huôi","pt_rom":"zai5 huoi5","tones":"阴去-阳去","audio":null,"note":"待校对"},
  {"id":"numbers_001","category":"numbers","zh":"一","pt_hanzi":"蜀","pt_buc":"Sióh","pt_rom":"sioh5","tones":"阴入","audio":null,"note":"闽东语'一'作蜀，待校对"},
  {"id":"numbers_002","category":"numbers","zh":"二","pt_hanzi":"两","pt_buc":"Lâng","pt_rom":"lang2","tones":"阳平","audio":null,"note":"待校对"},
  {"id":"numbers_003","category":"numbers","zh":"三","pt_hanzi":"三","pt_buc":"Săng","pt_rom":"sang1","tones":"阴平","audio":null,"note":"待校对"},
  {"id":"food_001","category":"food","zh":"吃饭","pt_hanzi":"食饭","pt_buc":"Siăh bâng","pt_rom":"siah4 bang2","tones":"阴入-阳平","audio":null,"note":"待校对"},
  {"id":"daily_001","category":"daily","zh":"我","pt_hanzi":"我","pt_buc":"Nguāi","pt_rom":"nguai3","tones":"阳上","audio":null,"note":"第一人称，源自 LinguaCommons 词表"},
  {"id":"daily_002","category":"daily","zh":"你","pt_hanzi":"汝","pt_buc":"Nṳ̄","pt_rom":"ny3","tones":"阳上","audio":null,"note":"第二人称，源自 LinguaCommons 词表"},
  {"id":"daily_003","category":"daily","zh":"他 / 她","pt_hanzi":"伊","pt_buc":"Ĭ","pt_rom":"i1","tones":"阴平","audio":null,"note":"第三人称，源自 LinguaCommons 词表"},
  {"id":"other_001","category":"other","zh":"今天","pt_hanzi":"今旦","pt_buc":"Gĭng-dáng","pt_rom":"ging1 dang1","tones":"阴平-阴平","audio":null,"note":"待校对"}
]
```

- [ ] **Step 6: 运行校验**

运行：`npm run validate`
预期：`共 12 条，错误 0，警告 12`（警告=未录音，正常），退出码 0。

- [ ] **Step 7: 扩充词库至 120+ 条**

向 `data/phrases.json` 追加词条（**内容生成规则**）：
- 分类配额：greeting 12 / daily 20 / food 15 / shopping 12 / transport 10 / emergency 10 / weather 8 / family 12 / numbers 12 / other 9（含已有 12 条）。
- 场景以平潭实际生活为准：海鲜买卖、赶海、渔船、台风、旅游问路、走亲戚。
- 拼写参考：米时典 SeeDict（seedict.com）词条写法与榕拼；平话字参考 GitHub only3km/ciklinbekin；基础代词/称谓参考 LinguaCommons 福州话词表。
- 拿不准的注音照常填写最接近值，`note` 写"待校对"；`audio` 一律 `null`。
- id 规则：`<category>_###` 顺延，不得与现有重复。

- [ ] **Step 8: 再跑校验与测试**

运行：`npm run validate; npm test`
预期：错误 0；测试全 PASS。

- [ ] **Step 9: Commit**

```powershell
git add data/phrases.json scripts/validate-phrases.mjs tests/validate.test.mjs
git commit -m "feat: 词库数据（120+句）与校验脚本"
```

### Task 3: 前端词库匹配与加载模块（TDD）

**Files:** Create: `src/lib/match.js`, `src/lib/phrases.js`, `tests/match.test.mjs`

- [ ] **Step 1: 写失败测试 tests/match.test.mjs**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalize, editDistance, matchPhrase } from '../src/lib/match.js'

test('normalize 去标点与空白', () => {
  assert.equal(normalize('吃了吗？'), '吃了吗')
  assert.equal(normalize(' 你好 ，'), '你好')
})
test('editDistance', () => {
  assert.equal(editDistance('你好', '你好'), 0)
  assert.equal(editDistance('吃了吗', '吃了吗啦'), 1)
  assert.equal(editDistance('abc', 'abd'), 1)
})
test('精确命中', () => {
  const r = matchPhrase([{ id: 'a', zh: '吃了吗？' }], '吃了吗？')
  assert.equal(r.entry.id, 'a'); assert.equal(r.fuzzy, false)
})
test('标点差异也算精确', () => {
  const r = matchPhrase([{ id: 'a', zh: '吃了吗？' }], '吃了吗')
  assert.equal(r.fuzzy, false)
})
test('模糊命中', () => {
  const r = matchPhrase([{ id: 'a', zh: '今天天气很好' }], '今天天气很好啊')
  assert.ok(r && r.fuzzy)
})
test('未命中返回 null', () => {
  assert.equal(matchPhrase([{ id: 'a', zh: '你好' }], '再见'), null)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`npm test`
预期：新测试 FAIL（模块不存在）。

- [ ] **Step 3: 实现 src/lib/match.js**

```js
export function normalize(s) {
  return (s || '').replace(/[\s，。？！?!,.:：;；、~～"'‘’“”·…]/g, '')
}

export function editDistance(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

export function matchPhrase(phrases, text) {
  const q = normalize(text)
  if (!q) return null
  let best = null
  for (const p of phrases) {
    const t = normalize(p.zh)
    if (t === q) return { entry: p, fuzzy: false }
    const d = editDistance(t, q)
    const max = Math.max(1, Math.floor(Math.max(t.length, q.length) / 4))
    if (d <= max && (!best || d < best.d)) best = { entry: p, fuzzy: true, d }
  }
  return best ? { entry: best.entry, fuzzy: true } : null
}
```

- [ ] **Step 4: 实现 src/lib/phrases.js**

```js
import localData from '../../data/phrases.json'

let cache = null

function merge(local, remote) {
  const map = new Map(local.map(p => [p.id, p]))
  for (const p of remote) if (p && p.id) map.set(p.id, { ...map.get(p.id), ...p })
  return [...map.values()]
}

export async function loadPhrases({ refresh = false, remoteUrl = '' } = {}) {
  if (cache && !refresh) return cache
  let list = [...localData]
  if (remoteUrl) {
    try {
      const r = await fetch(remoteUrl, { cache: 'no-store' })
      if (r.ok) {
        const remote = await r.json()
        if (Array.isArray(remote)) list = merge(list, remote)
      }
    } catch { /* 远程失败静默用本地 */ }
  }
  cache = list
  return list
}
```

- [ ] **Step 5: 运行测试**

运行：`npm test`
预期：全部 PASS。

- [ ] **Step 6: Commit**

```powershell
git add src/lib/match.js src/lib/phrases.js tests/match.test.mjs
git commit -m "feat: 词库加载与模糊匹配模块"
```

### Task 4: 翻译云函数（TDD，mock fetch）

**Files:** Create: `api/_lib/http.mjs`, `api/_lib/zhipu.mjs`, `api/_lib/translate.mjs`, `api/translate.js`, `tests/translate.test.mjs`

- [ ] **Step 1: 写失败测试 tests/translate.test.mjs**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { chatJson } from '../api/_lib/zhipu.mjs'

const okFetch = content => async () => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content } }] })
})
const GOOD = '前缀杂文{"pt_hanzi":"食罢未？","pt_buc":"Siăh-bà-muôi?","pt_rom":"siah4 ba3 muoi5","tones":"阴入-阴去-阳去","confidence":"high"}后缀'

test('正常解析并容忍模型输出前后杂文', async () => {
  const r = await chatJson('吃了吗', { apiKey: 'k', fetchImpl: okFetch(GOOD) })
  assert.equal(r.pt_hanzi, '食罢未？')
  assert.equal(r.confidence, 'high')
})
test('429 映射 QUOTA', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 429 }) }), /QUOTA/)
})
test('401 映射 UNAUTHORIZED', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 401 }) }), /UNAUTHORIZED/)
})
test('非 JSON 输出报 BAD_MODEL_OUTPUT', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: okFetch('纯文本回复') }), /BAD_MODEL_OUTPUT/)
})
test('缺字段报 BAD_MODEL_OUTPUT', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: okFetch('{"pt_hanzi":"你好"}') }), /BAD_MODEL_OUTPUT/)
})
test('缺 API Key 报 NO_API_KEY', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: '', fetchImpl: okFetch(GOOD) }), /NO_API_KEY/)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`npm test`
预期：translate 测试 FAIL（模块不存在）。

- [ ] **Step 3: 实现 api/_lib/http.mjs**

```js
export class ApiError extends Error {
  constructor(key, status = 500, message) { super(message || key); this.key = key; this.status = status }
}

export function json(res, code, obj) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

export function fail(res, e) {
  const key = e.key || 'INTERNAL'
  const code = e.status || (key === 'QUOTA' ? 503 : key === 'NO_SPEECH' ? 422 : 500)
  json(res, code, { error: key, message: e.message })
}

export function readJson(req, maxKB = 16) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', c => {
      size += c.length
      if (size > maxKB * 1024) { reject(new ApiError('BAD_INPUT', 400, '请求体过大')); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch { reject(new ApiError('BAD_INPUT', 400, 'JSON 解析失败')) }
    })
    req.on('error', reject)
  })
}
```

- [ ] **Step 4: 实现 api/_lib/zhipu.mjs（含 SYSTEM_PROMPT 与解析）**

```js
import { ApiError } from './http.mjs'

export const SYSTEM_PROMPT = `你是平潭话（闽东语侯官片，近福清话）专家。把用户给的普通话句子翻译成平潭话口语。
要求：
1. pt_hanzi 用平潭话口语汉字写法（如：吃了吗→食罢未；你→汝；他→伊；人→侬；说→讲）。
2. pt_buc 用平话字（Bàng-uâ-cê）拼写；pt_rom 用榕拼式声调数字（1阴平 2阳平 3阴上 4阳上 5阴去 6阳去 7阴入 8阳入，如 siah4 ba3 muoi5）。
3. tones 按每字声调用 - 连接，调名只能取：阴平/阳平/阴上/阳上/阴去/阳去/阴入/阳入。
4. 只输出 JSON：{"pt_hanzi":"","pt_buc":"","pt_rom":"","tones":"","confidence":"high或low"}。拼写拿不准时给 confidence:"low"。
示例：输入"吃了吗" → {"pt_hanzi":"食罢未？","pt_buc":"Siăh-bà-muôi?","pt_rom":"siah4 ba3 muoi5","tones":"阴入-阴去-阳去","confidence":"high"}
示例：输入"你好" → {"pt_hanzi":"汝好","pt_buc":"Nṳ̄ hō","pt_rom":"ny3 ho2","tones":"阳上-阴平","confidence":"high"}`

function extractJson(s) {
  const m = String(s).match(/\{[\s\S]*\}/)
  if (!m) throw new ApiError('BAD_MODEL_OUTPUT', 502, '模型未返回 JSON')
  return JSON.parse(m[0])
}

export function parseResult(raw) {
  for (const k of ['pt_hanzi', 'pt_buc', 'pt_rom', 'tones', 'confidence'])
    if (typeof raw[k] !== 'string' || !raw[k]) throw new ApiError('BAD_MODEL_OUTPUT', 502, '缺少字段 ' + k)
  if (!['high', 'low'].includes(raw.confidence)) raw.confidence = 'low'
  return raw
}

export async function chatJson(text, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new ApiError('NO_API_KEY', 500, '未配置 ZHIPU_API_KEY')
  let r
  try {
    r = await fetchImpl('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'glm-4-flash', temperature: 0.3,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }]
      })
    })
  } catch (e) { throw new ApiError('UPSTREAM_UNREACHABLE', 502, String(e)) }
  if (r.status === 401 || r.status === 403) throw new ApiError('UNAUTHORIZED', 500, '智谱 API Key 无效')
  if (r.status === 429) throw new ApiError('QUOTA', 503, '免费额度用尽或限流')
  if (!r.ok) throw new ApiError('UPSTREAM', 502, '智谱返回 ' + r.status)
  const data = await r.json().catch(() => { throw new ApiError('BAD_RESPONSE', 502, '智谱响应解析失败') })
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new ApiError('BAD_RESPONSE', 502, '智谱响应缺少内容')
  return parseResult(extractJson(content))
}
```

- [ ] **Step 5: 实现 api/_lib/translate.mjs 与 api/translate.js**

`api/_lib/translate.mjs`:

```js
import { chatJson } from './zhipu.mjs'

export async function translateZhToPt(text, env = process.env) {
  const r = await chatJson(text, { apiKey: env.ZHIPU_API_KEY })
  return { ...r, source: 'llm' }
}
```

`api/translate.js`:

```js
import { readJson, json, fail } from './_lib/http.mjs'
import { translateZhToPt } from './_lib/translate.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, Object.assign(new Error('Method Not Allowed'), { status: 405 }))
  try {
    const { text } = await readJson(req, 16)
    if (!text || typeof text !== 'string' || text.length > 200)
      throw Object.assign(new Error('需要 1~200 字的 text'), { status: 400, key: 'BAD_INPUT' })
    return json(res, 200, await translateZhToPt(text))
  } catch (e) { return fail(res, e) }
}
```

- [ ] **Step 6: 运行测试**

运行：`npm test`
预期：全部 PASS。

- [ ] **Step 7: Commit**

```powershell
git add api/_lib/http.mjs api/_lib/zhipu.mjs api/_lib/translate.mjs api/translate.js tests/translate.test.mjs
git commit -m "feat: /api/translate 智谱 GLM-4-Flash 翻译云函数"
```

### Task 5: 本地开发服务器

**Files:** Create: `scripts/dev-server.mjs`

- [ ] **Step 1: 实现 dev-server（手动读取 .env.local，复用 api 处理函数）**

```js
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const envFile = path.resolve('.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const routes = {
  '/api/translate': (await import('../api/translate.js')).default,
  '/api/asr': (await import('../api/asr.js')).default,
  '/api/audio': (await import('../api/audio.js')).default,
  '/api/tts': (await import('../api/tts.js')).default
}

http.createServer(async (req, res) => {
  const h = routes[req.url.split('?')[0]]
  if (!h) { res.statusCode = 404; return res.end('not found') }
  try { await h(req, res) } catch (e) { res.statusCode = 500; res.end(String(e)) }
}).listen(8787, () => console.log('API dev server: http://localhost:8787'))
```

- [ ] **Step 2: 复制环境变量样例并填入真实 Key（若用户已注册）**

运行：`copy .env.local.example .env.local`
（若用户还没有 Key：跳过填写，后面联调时提醒注册智谱开放平台与阿里云百炼。）

- [ ] **Step 3: 冒烟验证无 Key 时的错误路径**

运行：`npm run dev:api`（后台）；另开终端：
`curl.exe -s -X POST http://localhost:8787/api/translate -H "Content-Type: application/json" -d "{\"text\":\"你好\"}"`
预期：`{"error":"NO_API_KEY",...}` → 证明路由与错误通道正常。验证后停掉进程。

- [ ] **Step 4: Commit**

```powershell
git add scripts/dev-server.mjs
git commit -m "feat: 本地 API 开发服务器（复用云函数代码）"
```

### Task 6: 语音转写云函数（TDD，mock fetch）

**Files:** Create: `api/_lib/dashscope.mjs`, `api/asr.js`, `api/audio.js`, `tests/dashscope.test.mjs`

- [ ] **Step 1: 写失败测试 tests/dashscope.test.mjs**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { transcribe, parseText, PROMPTS } from '../api/_lib/dashscope.mjs'

test('parseText 空结果 → NO_SPEECH', () => {
  assert.throws(() => parseText(''), /NO_SPEECH/)
  assert.throws(() => parseText('[无法识别]'), /NO_SPEECH/)
})
test('parseText 正常去空白', () => {
  assert.equal(parseText('  你好呀 \n'), '你好呀')
})
test('转写调用携带 wav 格式与对应 prompt', async () => {
  let captured = null
  const r = await transcribe({ audioBase64: 'AAAA', mime: 'audio/wav' }, 'pingtan', {
    apiKey: 'k',
    fetchImpl: async (url, opts) => {
      captured = { url, body: JSON.parse(opts.body) }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: ' 你在吃什么 ' } }] }) }
    }
  })
  assert.equal(r, '你在吃什么')
  assert.ok(captured.url.includes('dashscope.aliyuncs.com'))
  assert.equal(captured.body.messages[0].content, PROMPTS.pingtan)
  assert.equal(captured.body.messages[1].content[0].input_audio.format, 'wav')
})
test('429 映射 QUOTA', async () => {
  await assert.rejects(() => transcribe({ audioBase64: 'A', mime: 'audio/wav' }, 'mandarin',
    { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 429 }) }), /QUOTA/)
})
test('mp3 以外的 mime 报 BAD_INPUT', async () => {
  await assert.rejects(() => transcribe({ audioBase64: 'A', mime: 'audio/webm' }, 'mandarin',
    { apiKey: 'k', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) }), /BAD_INPUT/)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`npm test`
预期：dashscope 测试 FAIL。

- [ ] **Step 3: 实现 api/_lib/dashscope.mjs**

```js
import { ApiError } from './http.mjs'

const URL_ = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

export const PROMPTS = {
  mandarin: '请把这段普通话录音逐字转写为简体中文文本，只输出转写文本本身，不要任何解释。',
  pingtan: '这是一段中国福建省平潭县一带的闽东语（福州话-福清话口音）口语录音。请把它翻译成通顺的普通话简体中文文本，只输出译文本身，不要任何解释。如果完全无法理解，只输出：[无法识别]'
}

function fmtOf(mime) {
  if (/wav/i.test(mime)) return 'wav'
  if (/mp3|mpeg/i.test(mime)) return 'mp3'
  throw new ApiError('BAD_INPUT', 400, '仅支持 wav/mp3 音频')
}

export function parseText(content) {
  const t = String(content || '').trim()
  if (!t || t === '[无法识别]') throw new ApiError('NO_SPEECH', 422, '没听清，请重说或改用打字')
  return t
}

export async function transcribe({ audioBase64, mime }, mode, { apiKey, fetchImpl = fetch } = {}) {
  const key = apiKey || process.env.DASHSCOPE_API_KEY
  if (!key) throw new ApiError('NO_API_KEY', 500, '未配置 DASHSCOPE_API_KEY')
  const format = fmtOf(mime)
  let r
  try {
    r = await fetchImpl(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'qwen2-audio-instruct',
        messages: [
          { role: 'system', content: PROMPTS[mode] },
          { role: 'user', content: [{ type: 'input_audio', input_audio: { data: audioBase64, format } }] }
        ]
      })
    })
  } catch (e) { throw new ApiError('UPSTREAM_UNREACHABLE', 502, String(e)) }
  if (r.status === 401 || r.status === 403) throw new ApiError('UNAUTHORIZED', 500, '百炼 API Key 无效')
  if (r.status === 429) throw new ApiError('QUOTA', 503, '免费额度用尽或限流')
  if (!r.ok) throw new ApiError('UPSTREAM', 502, '百炼返回 ' + r.status)
  const data = await r.json().catch(() => { throw new ApiError('BAD_RESPONSE', 502, '百炼响应解析失败') })
  return parseText(data?.choices?.[0]?.message?.content)
}
```

- [ ] **Step 4: 实现 api/asr.js 与 api/audio.js**

`api/asr.js`:

```js
import { readJson, json, fail, ApiError } from './_lib/http.mjs'
import { transcribe } from './_lib/dashscope.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, Object.assign(new Error('Method Not Allowed'), { status: 405 }))
  try {
    const { audioBase64, mime = 'audio/wav' } = await readJson(req, 5120)
    if (!audioBase64 || audioBase64.length > 4_500_000)
      throw new ApiError('BAD_INPUT', 400, '缺少音频或音频过大（上限约 30 秒）')
    return json(res, 200, { text: await transcribe({ audioBase64, mime }, 'mandarin') })
  } catch (e) { return fail(res, e) }
}
```

`api/audio.js`:

```js
import { readJson, json, fail, ApiError } from './_lib/http.mjs'
import { transcribe } from './_lib/dashscope.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, Object.assign(new Error('Method Not Allowed'), { status: 405 }))
  try {
    const { audioBase64, mime = 'audio/wav' } = await readJson(req, 5120)
    if (!audioBase64 || audioBase64.length > 4_500_000)
      throw new ApiError('BAD_INPUT', 400, '缺少音频或音频过大（上限约 30 秒）')
    return json(res, 200, { text: await transcribe({ audioBase64, mime }, 'pingtan') })
  } catch (e) { return fail(res, e) }
}
```

- [ ] **Step 5: 运行测试**

运行：`npm test`
预期：全部 PASS。

- [ ] **Step 6: Commit**

```powershell
git add api/_lib/dashscope.mjs api/asr.js api/audio.js tests/dashscope.test.mjs
git commit -m "feat: /api/asr 与 /api/audio 语音转写云函数（Qwen2-Audio）"
```

### Task 7: TTS 云函数

**Files:** Create: `api/_lib/tts.mjs`, `api/tts.js`

- [ ] **Step 1: 实现 api/_lib/tts.mjs**

```js
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

export async function ttsMp3(text) {
  const tts = new MsEdgeTTS()
  await tts.setMetadata('zh-CN-XiaoxiaoNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
  const r = tts.toStream(text)
  const stream = r.audioStream || r
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return Buffer.concat(chunks)
}
```

- [ ] **Step 2: 实现 api/tts.js**

```js
import { readJson, fail, ApiError } from './_lib/http.mjs'
import { ttsMp3 } from './_lib/tts.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, Object.assign(new Error('Method Not Allowed'), { status: 405 }))
  try {
    const { text } = await readJson(req, 16)
    if (!text || typeof text !== 'string' || text.length > 200)
      throw new ApiError('BAD_INPUT', 400, '需要 1~200 字的 text')
    const buf = await ttsMp3(text)
    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/mpeg')
    res.end(buf)
  } catch (e) { return fail(res, e) }
}
```

- [ ] **Step 3: 本地冒烟（有 DASHSCOPE/网络时）**

运行：`npm run dev:api`；另终端：
`curl.exe -s -X POST http://localhost:8787/api/tts -H "Content-Type: application/json" -d "{\"text\":\"你好\"}" -o test.mp3`
预期：生成非空 `test.mp3`。验证后删除 `test.mp3` 并停进程。

- [ ] **Step 4: Commit**

```powershell
git add api/_lib/tts.mjs api/tts.js
git commit -m "feat: /api/tts Edge TTS 朗读云函数"
```

### Task 8: 前端骨架（路由/布局/设置存储）

**Files:** Create: `src/main.js`, `src/router.js`, `src/App.vue`, `src/store/settings.js`, `src/views/HomeView.vue`(占位), `src/views/PhrasebookView.vue`(占位), `src/views/FavoritesView.vue`(占位), `src/views/SettingsView.vue`(占位)

- [ ] **Step 1: 写 main.js / router.js / App.vue**

`src/main.js`:

```js
import { createApp } from 'vue'
import Vant from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import { router } from './router.js'

createApp(App).use(router).use(Vant).mount('#app')
```

`src/router.js`:

```js
import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/phrases', component: () => import('./views/PhrasebookView.vue') },
    { path: '/favorites', component: () => import('./views/FavoritesView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') }
  ]
})
```

`src/App.vue`:

```vue
<script setup>
import { NavBar, Tabbar, TabbarItem } from 'vant'
</script>

<template>
  <van-nav-bar title="平潭话翻译器" fixed placeholder />
  <router-view />
  <van-tabbar route fixed>
    <van-tabbar-item to="/" icon="chat-o">翻译</van-tabbar-item>
    <van-tabbar-item to="/phrases" icon="bookmark-o">词库</van-tabbar-item>
    <van-tabbar-item to="/favorites" icon="star-o">收藏</van-tabbar-item>
    <van-tabbar-item to="/settings" icon="setting-o">设置</van-tabbar-item>
  </van-tabbar>
</template>

<style>
body { padding-bottom: 70px; }
#app { max-width: 640px; margin: 0 auto; }
</style>
```

- [ ] **Step 2: 写 src/store/settings.js（设置 + 收藏，localStorage 持久化）**

```js
import { reactive, watch } from 'vue'

const KEY = 'pt-settings'
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }

export const settings = reactive(Object.assign(
  { direction: 'zh2pt', experimentDialect: false, remotePhraseUrl: '' }, load()))

watch(settings, v => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true })

const FKEY = 'pt-favorites'
export function getFavorites() { try { return JSON.parse(localStorage.getItem(FKEY)) || [] } catch { return [] } }
export function isFav(id) { return getFavorites().includes(id) }
export function toggleFav(id) {
  const f = getFavorites(); const i = f.indexOf(id)
  i < 0 ? f.push(id) : f.splice(i, 1)
  localStorage.setItem(FKEY, JSON.stringify(f))
  return i < 0
}
```

- [ ] **Step 3: 写四个占位视图（后续任务填充）**

每个文件内容形如：

```vue
<template><div class="page"><van-empty description="建设中" /></div></template>
```

文件：`HomeView.vue`、`PhrasebookView.vue`、`FavoritesView.vue`、`SettingsView.vue`。

- [ ] **Step 4: 启动验证**

运行：`npm run dev:web`
浏览器打开 `http://localhost:5173`：导航栏+四个页签可切换。验证后停进程。

- [ ] **Step 5: Commit**

```powershell
git add src/main.js src/router.js src/App.vue src/store/settings.js src/views
git commit -m "feat: 前端骨架（路由/布局/设置存储）"
```

### Task 9: 录音封装与 API 封装

**Files:** Create: `src/lib/recorder.mjs`, `src/lib/api.mjs`

- [ ] **Step 1: 实现 src/lib/recorder.mjs（recorder-core 输出 16k 单声道 WAV）**

```js
import Recorder from 'recorder-core'
import 'recorder-core/src/engine/wav'

export const MIN_MS = 1000
export const MAX_MS = 30000

export function micUnsupported() { return !navigator.mediaDevices?.getUserMedia }

function err(key, message) { return Object.assign(new Error(message), { key }) }

export function openRecorder(onTick) {
  return new Promise((resolve, reject) => {
    if (micUnsupported()) return reject(err('UNSUPPORTED', '当前浏览器不支持录音'))
    const rec = Recorder({ type: 'wav', sampleRate: 16000, bitRate: 16 })
    rec.open(() => {
      rec.start()
      const t0 = Date.now()
      const timer = setInterval(() => onTick?.(Date.now() - t0), 200)
      resolve({
        stop: () => new Promise((res, rej) => {
          const dur = Date.now() - t0
          clearInterval(timer)
          rec.stop((blob) => {
            rec.close()
            if (dur < MIN_MS) rej(err('TOO_SHORT', '说话太短，请长按说话'))
            else if (dur > MAX_MS) rej(err('TOO_LONG', '录音超过 30 秒，请重录'))
            else res(blob)
          }, (msg) => { clearInterval(timer); rec.close(); rej(err('RECORD_FAIL', msg)) })
        }),
        cancel: () => { clearInterval(timer); try { rec.stop(() => {}, () => {}) } catch {} rec.close() }
      })
    }, (msg, isUserNotAllow) =>
      reject(err(isUserNotAllow ? 'PERMISSION_DENIED' : 'OPEN_FAIL', isUserNotAllow ? '麦克风权限被拒绝，请在浏览器设置中允许后重试，或改用打字' : msg)))
  })
}
```

- [ ] **Step 2: 实现 src/lib/api.mjs（超时 15s、重试 1 次、错误码透传）**

```js
const TIMEOUT_MS = 15000

export class ApiError extends Error {
  constructor(key, status, message) { super(message || key); this.key = key; this.status = status }
}

async function withTimeout(url, opts) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), TIMEOUT_MS)
  try { return await fetch(url, { ...opts, signal: c.signal }) } finally { clearTimeout(t) }
}

export async function postJSON(url, data, retries = 1) {
  let last
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await withTimeout(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
      if ((r.headers.get('content-type') || '').includes('application/json')) {
        const j = await r.json()
        if (!r.ok) throw new ApiError(j.error || 'UNKNOWN', r.status, j.message)
        return j
      }
      throw new ApiError('BAD_RESPONSE', r.status, (await r.text()).slice(0, 120))
    } catch (e) {
      last = e.name === 'AbortError' ? new ApiError('TIMEOUT', 0, '请求超时，请重试或改用打字') : e
    }
  }
  throw last
}

export function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

export async function postAudio(url, blob) {
  return postJSON(url, { audioBase64: await blobToBase64(blob), mime: blob.type || 'audio/wav' })
}

export async function fetchTTS(text) {
  const r = await withTimeout('/api/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
  })
  if (!r.ok) throw new ApiError('TTS_FAILED', r.status, '朗读失败')
  return URL.createObjectURL(await r.blob())
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/lib/recorder.mjs src/lib/api.mjs
git commit -m "feat: 前端录音与 API 封装"
```

### Task 10: 翻译主界面（HomeView + 组件）

**Files:** Create: `src/components/ResultCard.vue`, `src/components/RecordButton.vue`, `src/components/MicBanner.vue`; Modify: `src/views/HomeView.vue`(替换占位)

- [ ] **Step 1: 实现 MicBanner.vue（微信/QQ 内引导用系统浏览器）**

```vue
<script setup>
const inWechat = /MicroMessenger/i.test(navigator.userAgent)
const inQQ = /QQ\//i.test(navigator.userAgent)
</script>

<template>
  <van-notice-bar v-if="inWechat || inQQ" wrapable :scrollable="false"
    left-icon="info-o"
    text="微信内无法使用语音：请点右上角「···」→「在浏览器打开」，即可语音输入。当前可先用打字翻译。" />
</template>
```

- [ ] **Step 2: 实现 RecordButton.vue（按住说话，触屏+鼠标）**

```vue
<script setup>
import { ref, onBeforeUnmount } from 'vue'

const emit = defineEmits(['start', 'end', 'cancel'])
const pressing = ref(false)
const elapsed = ref(0)
let timer = null

function down(e) {
  e.preventDefault()
  if (pressing.value) return
  pressing.value = true
  elapsed.value = 0
  timer = setInterval(() => { elapsed.value += 0.2 }, 200)
  emit('start')
}
function up() {
  if (!pressing.value) return
  clearInterval(timer)
  pressing.value = false
  emit('end', elapsed.value)
}
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="rec-wrap">
    <van-button round type="danger" size="large" class="rec-btn" :class="{ active: pressing }"
      @touchstart.prevent="down" @touchend.prevent="up" @touchcancel="up"
      @mousedown="down" @mouseup="up" @mouseleave="pressing && up()">
      {{ pressing ? `松开结束 ${elapsed.toFixed(1)}s` : '按住 说话' }}
    </van-button>
  </div>
</template>

<style scoped>
.rec-wrap { padding: 16px 24px; text-align: center; }
.rec-btn { height: 64px; font-size: 20px; width: 100%; }
.rec-btn.active { transform: scale(0.97); }
</style>
```

- [ ] **Step 3: 实现 ResultCard.vue（写法/注音/声调/播放/复制/收藏/置信角标）**

```vue
<script setup>
import { ref, computed } from 'vue'
import { showToast } from 'vant'
import { isFav, toggleFav } from '../store/settings.js'
import { fetchTTS } from '../lib/api.mjs'

const props = defineProps({
  /* 词库词条对象；LLM 结果；方言识别的普通话文本 */
  entry: { type: Object, default: null },
  llm: { type: Object, default: null },
  mandarin: { type: String, default: '' },
  fuzzy: { type: Boolean, default: false }
})

const hanzi = computed(() => props.entry?.pt_hanzi || props.llm?.pt_hanzi || '')
const buc = computed(() => props.entry?.pt_buc || props.llm?.pt_buc || '')
const rom = computed(() => props.entry?.pt_rom || props.llm?.pt_rom || '')
const tones = computed(() => props.entry?.tones || props.llm?.tones || '')
const audio = computed(() => (props.entry?.audio ? '/' + props.entry.audio : ''))
const lowConf = computed(() => props.llm?.confidence === 'low' || props.fuzzy)

const playing = ref(false)
async function play() {
  try {
    playing.value = true
    if (audio.value) {
      await new Audio(audio.value).play()
    } else if (props.mandarin) {
      const url = await fetchTTS(props.mandarin)
      await new Audio(url).play()
    }
  } catch { showToast('播放失败，请重试') } finally { playing.value = false }
}

const favId = computed(() => props.entry?.id || null)
function onFav() {
  showToast(toggleFav(favId.value) ? '已收藏' : '已取消收藏')
}
async function copy() {
  const t = [hanzi.value, buc.value, rom.value].filter(Boolean).join('\n') || props.mandarin
  try { await navigator.clipboard.writeText(t); showToast('已复制') }
  catch { showToast('复制失败') }
}
</script>

<template>
  <div class="card">
    <van-tag v-if="lowConf" type="warning" style="float:right">仅供参考</van-tag>
    <template v-if="mandarin">
      <div class="label">普通话</div>
      <div class="hanzi">{{ mandarin }}</div>
      <van-button size="small" icon="volume-o" :loading="playing" @click="play">朗读</van-button>
    </template>
    <template v-else>
      <div class="label">平潭话</div>
      <div class="hanzi">{{ hanzi }}</div>
      <div v-if="buc" class="sub">平话字：{{ buc }}</div>
      <div v-if="rom" class="sub">拼音：{{ rom }}</div>
      <div v-if="tones" class="sub">声调：{{ tones }}</div>
      <van-button size="small" icon="volume-o" :disabled="!audio" @click="play">
        {{ audio ? '播放录音' : '暂无录音' }}
      </van-button>
    </template>
    <van-button size="small" icon="records" @click="copy">复制</van-button>
    <van-button v-if="favId" size="small" :icon="isFav(favId) ? 'star' : 'star-o'" @click="onFav">收藏</van-button>
  </div>
</template>

<style scoped>
.card { background: #fff; border-radius: 12px; padding: 16px; margin: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.label { color: #888; font-size: 12px; }
.hanzi { font-size: 24px; font-weight: bold; margin: 6px 0; }
.sub { color: #555; font-size: 14px; margin: 2px 0; }
</style>
```

- [ ] **Step 4: 实现 HomeView.vue（方向切换/语音/文字/词库优先流程）**

```vue
<script setup>
import { ref, computed } from 'vue'
import { showToast, showLoadingToast, closeToast } from 'vant'
import MicBanner from '../components/MicBanner.vue'
import RecordButton from '../components/RecordButton.vue'
import ResultCard from '../components/ResultCard.vue'
import { settings } from '../store/settings.js'
import { loadPhrases } from '../lib/phrases.js'
import { matchPhrase } from '../lib/match.js'
import { openRecorder, micUnsupported } from '../lib/recorder.mjs'
import { postJSON, postAudio, ApiError } from '../lib/api.mjs'

const mode = computed({ get: () => settings.direction, set: v => (settings.direction = v) })
const text = ref('')
const busy = ref(false)
const result = ref(null)   // {entry?, fuzzy?, llm?, mandarin?}
const errMsg = ref('')

const micOK = !micUnsupported()
const dialectOn = computed(() => settings.experimentDialect)

async function handleText(raw) {
  const input = (raw ?? text.value).trim()
  if (!input || busy.value) return
  busy.value = true; errMsg.value = ''; result.value = null
  showLoadingToast({ message: '翻译中…', forbidClick: true, duration: 0 })
  try {
    const phrases = await loadPhrases({ remoteUrl: settings.remotePhraseUrl })
    if (mode.value === 'zh2pt') {
      const hit = matchPhrase(phrases, input)
      if (hit) { result.value = { entry: hit.entry, fuzzy: hit.fuzzy } }
      else { result.value = { llm: await postJSON('/api/translate', { text: input }) } }
    } else {
      result.value = { mandarin: input }   // 方言文字兜底：直接当作普通话展示
    }
  } catch (e) { errMsg.value = msgOf(e) }
  finally { busy.value = false; closeToast() }
}

let rec = null
async function onRecStart() {
  errMsg.value = ''; result.value = null
  try { rec = await openRecorder(ms => { if (ms > 30000) onRecEnd() }) }
  catch (e) { errMsg.value = e.message }
}
async function onRecEnd() {
  if (!rec) return
  const r = rec; rec = null
  try {
    const blob = await r.stop()
    busy.value = true
    showLoadingToast({ message: '识别中…', forbidClick: true, duration: 0 })
    const api = mode.value === 'zh2pt' ? '/api/asr' : '/api/audio'
    const { text: heard } = await postAudio(api, blob)
    text.value = heard
    await handleText(heard)
  } catch (e) { errMsg.value = msgOf(e) }
  finally { busy.value = false; closeToast() }
}
function msgOf(e) {
  if (e instanceof ApiError && e.key === 'QUOTA') return 'AI 免费额度已用尽，请联系维护者充值或稍后再试'
  if (e.key === 'NO_SPEECH') return e.message
  return e.message || '出错了，请重试'
}
</script>

<template>
  <div class="page">
    <MicBanner />
    <van-radio-group v-model="mode" direction="horizontal" style="justify-content:center;padding:8px">
      <van-radio name="zh2pt">普通话 → 平潭话</van-radio>
      <van-radio name="pt2zh">平潭话 → 普通话</van-radio>
    </van-radio-group>

    <template v-if="micOK && (mode === 'zh2pt' || dialectOn)">
      <RecordButton @start="onRecStart" @end="onRecEnd" />
    </template>
    <van-notice-bar v-else-if="mode === 'pt2zh' && !dialectOn" wrapable :scrollable="false"
      text="「平潭话语音识别」为实验功能，请在设置页开启后使用；可先在下方输入方言文字。" />

    <van-field v-model="text" type="textarea" rows="2" autosize clearable
      :placeholder="mode === 'zh2pt' ? '输入普通话，如：今天天气真好' : '输入平潭话文字（可选）'" />

    <div style="padding:0 16px">
      <van-button type="primary" block :loading="busy" @click="handleText()">翻 译</van-button>
    </div>

    <van-notice-bar v-if="errMsg" wrapable :scrollable="false" left-icon="warning-o" :text="errMsg" />
    <ResultCard v-if="result" v-bind="result" />
  </div>
</template>
```

- [ ] **Step 5: 手动验证（无 Key 也能验词库路径）**

运行：`npm run dev`；浏览器 `http://localhost:5173`：
1. 输入"吃了吗"→ 翻译 → 词库命中"食罢未？"（无网络请求也能出）。
2. 输入"今天股价多少"→ 未命中 → 请求 /api/translate：无 Key 时应显示 NO_API_KEY 相关提示（预期错误通道）。
3. 微信模拟（UA 带 MicroMessenger）→ 顶部出现引导横幅。
4. 录音按钮按下/松开流程无 JS 报错（识别失败提示可接受）。

- [ ] **Step 6: Commit**

```powershell
git add src/components src/views/HomeView.vue
git commit -m "feat: 双向翻译主界面（词库优先+LLM兜底+录音）"
```

### Task 11: 词库页与收藏页

**Files:** Modify: `src/views/PhrasebookView.vue`, `src/views/FavoritesView.vue`(替换占位)

- [ ] **Step 1: 实现 PhrasebookView.vue**

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadPhrases } from '../lib/phrases.js'
import ResultCard from '../components/ResultCard.vue'

const CATEGORY_NAMES = {
  greeting: '问候', daily: '日常', food: '吃喝', shopping: '买卖',
  transport: '出行', emergency: '应急', weather: '天气', family: '家庭',
  numbers: '数字', other: '其他'
}

const list = ref([])
const keyword = ref('')
const activeCat = ref('all')
const active = ref(null)

onMounted(async () => { list.value = await loadPhrases({ remoteUrl: '' }) })

const cats = computed(() => ['all', ...new Set(list.value.map(p => p.category))])
const filtered = computed(() => list.value.filter(p =>
  (activeCat.value === 'all' || p.category === activeCat.value) &&
  (!keyword.value || (p.zh + p.pt_hanzi).includes(keyword.value))))
</script>

<template>
  <div class="page">
    <van-search v-model="keyword" placeholder="搜索普通话或平潭话" />
    <van-tabs v-model:active="activeCat" swipeable>
      <van-tab v-for="c in cats" :key="c" :title="c === 'all' ? '全部' : (CATEGORY_NAMES[c] || c)" />
    </van-tabs>
    <van-cell v-for="p in filtered" :key="p.id" is-link @click="active = p">
      <template #title>{{ p.zh }}</template>
      <template #value>{{ p.pt_hanzi }}<van-tag v-if="!p.audio" plain type="default" style="margin-left:6px">无录音</van-tag></template>
    </van-cell>
    <van-empty v-if="!filtered.length" description="没有匹配的词条" />
    <van-popup v-model:show="active" position="bottom" round style="padding-bottom:12px">
      <ResultCard v-if="active" :entry="active" />
    </van-popup>
  </div>
</template>
```

- [ ] **Step 2: 实现 FavoritesView.vue**

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { loadPhrases } from '../lib/phrases.js'
import { getFavorites } from '../store/settings.js'
import ResultCard from '../components/ResultCard.vue'

const favs = ref([])
onMounted(async () => {
  const all = await loadPhrases({ remoteUrl: '' })
  const ids = getFavorites()
  favs.value = all.filter(p => ids.includes(p.id))
})
</script>

<template>
  <div class="page">
    <van-cell v-for="p in favs" :key="p.id" is-link :title="p.zh" :value="p.pt_hanzi"
      @click="$router.push('/phrases')" />
    <van-empty v-if="!favs.length" description="还没有收藏，去翻译或词库页收藏吧" />
  </div>
</template>
```

- [ ] **Step 3: 手动验证**

`npm run dev:web`：词库页搜索"吃"出结果、分类切换、点击弹出结果卡；收藏"食罢未"后收藏页出现。验证后停进程。

- [ ] **Step 4: Commit**

```powershell
git add src/views/PhrasebookView.vue src/views/FavoritesView.vue
git commit -m "feat: 词库浏览/搜索页与收藏页"
```

### Task 12: 设置页（实验开关/远程词库/免责声明）

**Files:** Modify: `src/views/SettingsView.vue`(替换占位)

- [ ] **Step 1: 实现 SettingsView.vue**

```vue
<script setup>
import { ref } from 'vue'
import { showToast } from 'vant'
import { settings } from '../store/settings.js'
import { loadPhrases } from '../lib/phrases.js'

const remoteUrl = ref(settings.remotePhraseUrl)
const loading = ref(false)

async function reloadPhrases() {
  loading.value = true
  try {
    settings.remotePhraseUrl = remoteUrl.value.trim()
    const n = (await loadPhrases({ refresh: true, remoteUrl: settings.remotePhraseUrl })).length
    showToast(`词库已加载 ${n} 条`)
  } catch { showToast('加载失败，将使用内置词库') }
  finally { loading.value = false }
}
</script>

<template>
  <div class="page">
    <van-cell-group inset title="功能开关">
      <van-cell center title="方言语音识别（实验）" label="说平潭话→普通话。识别结果可能不准确">
        <template #right-icon><van-switch v-model="settings.experimentDialect" /></template>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset title="词库更新">
      <van-field v-model="remoteUrl" label="远程词库 URL" placeholder="https://…/phrases.json（可留空）" />
      <div style="padding:8px 16px">
        <van-button size="small" :loading="loading" @click="reloadPhrases">重新加载词库</van-button>
      </div>
    </van-cell-group>

    <van-cell-group inset title="关于">
      <van-cell title="版本" value="0.1.0 MVP" />
      <van-cell title="语料致谢" label="米时典 SeeDict（seedict.com）、开源平话字表（only3km/ciklinbekin）、LinguaCommons 福州话词表。AI 翻译结果仅供参考，方言写法与注音有待本地人校对。" />
      <van-cell title="免责声明" label="本工具为公益性方言学习辅助。方言语音识别为实验功能，准确率不作保证；正式场合请以真人沟通为准。" />
    </van-cell-group>
  </div>
</template>
```

- [ ] **Step 2: 手动验证**

设置页开关持久化（刷新后保留）；方言开关关闭时首页切到"平潭话→普通话"显示提示条；填远程 URL（可用任意返回数组 JSON 的 URL 测试）后 toast 显示条数。

- [ ] **Step 3: Commit**

```powershell
git add src/views/SettingsView.vue
git commit -m "feat: 设置页（实验开关/远程词库/免责声明）"
```

### Task 13: PWA 图标与构建验证

**Files:** Create: `scripts/gen-icons.mjs`; Generate: `public/icons/pwa-192.png`, `public/icons/pwa-512.png`

- [ ] **Step 1: 实现 scripts/gen-icons.mjs**

```js
import sharp from 'sharp'
import fs from 'node:fs'

fs.mkdirSync('public/icons', { recursive: true })
const svg = fs.readFileSync('public/icon.svg')
for (const s of [192, 512]) {
  await sharp(svg).resize(s, s).png().toFile(`public/icons/pwa-${s}.png`)
}
console.log('icons generated: pwa-192.png, pwa-512.png')
```

- [ ] **Step 2: 生成图标**

运行：`npm run icons`
预期：打印 `icons generated`，两个 PNG 存在。

- [ ] **Step 3: 构建验证**

运行：`npm run build`
预期：`dist/` 生成，无报错；`dist/manifest.webmanifest` 存在。

- [ ] **Step 4: Commit**

```powershell
git add scripts/gen-icons.mjs public/icons
git commit -m "feat: PWA 图标生成与构建验证"
```

### Task 14: 真机测试清单（手动，需可访问的部署或局域网）

> 前置：`npm run build` 后用 `npm run preview` + 局域网 IP，或先完成 Task 15 部署后用线上地址。手机与电脑同一 Wi-Fi。

- [ ] **Step 1: 按清单逐项验证并记录结果**

| # | 项目 | 设备/浏览器 | 预期 | 结果 |
|---|---|---|---|---|
| 1 | 页面打开与四页签 | iOS Safari / Android Chrome | 正常渲染 | |
| 2 | 添加到主屏幕 | 两者 | 图标正确、独立窗口启动 | |
| 3 | 文字翻译-词库命中 | 两者 | 食罢未+注音 | |
| 4 | 文字翻译-LLM | 两者 | 返回结果；低置信有角标 | |
| 5 | 普通话语音输入 | Android Chrome / iOS 14.3+ | 权限弹窗→识别→翻译 | |
| 6 | 录音权限拒绝 | 两者 | 提示并可改打字 | |
| 7 | 平潭话语音（实验） | 两者 | 开关开启后可用；结果带普通话+朗读 | |
| 8 | 微信内打开 | 微信扫二维码 | 引导横幅；打字翻译可用 | |
| 9 | 录音边界 | 两者 | <1s 提示太短；>30s 拦截 | |
| 10 | 词库搜索/收藏 | 两者 | 功能正常、刷新保留 | |

- [ ] **Step 2: 修复清单中发现的问题并回归测试**

- [ ] **Step 3: Commit（如有修复）**

```powershell
git add -A
git commit -m "fix: 真机测试问题修复"
```

### Task 15: 部署到 Vercel

> **部署前注意（Task 7 评审结论）**：msedge-tts 2.1.0 的 `preinstall: npx only-allow pnpm` 脚本在 npm <11.6（Vercel 构建镜像常用 npm 10.x）下执行 `npm install` 会失败。若 Vercel 构建报该错误：在 Vercel 项目设置的 Install Command 改为 `npm install --ignore-scripts`（sharp/esbuild 二进制走 optionalDependencies 不受影响），或改用 pnpm 安装。

- [ ] **Step 1: 本地构建已通过（Task 13）后安装 CLI**

运行：`npm install -g vercel`
（需要用户配合：`vercel login` 需浏览器登录 Vercel 账号，免费注册。）

- [ ] **Step 2: 关联项目并配置环境变量**

```powershell
vercel link
vercel env add ZHIPU_API_KEY production
vercel env add DASHSCOPE_API_KEY production
```
（每次按提示粘贴对应 Key。）

- [ ] **Step 3: 部署生产**

运行：`vercel --prod`
预期：输出 `https://<project>.vercel.app`。

- [ ] **Step 4: 线上验收**

浏览器打开线上地址，重复 Task 14 清单 1/3/4/5/7/8。若 `vercel.app` 直连不稳：备选方案为 Cloudflare Pages（免费，前端 + Pages Functions 迁移 `api/`，接口路径不变）。

- [ ] **Step 5: Commit（部署配置如有调整）并写部署记录**

```powershell
git add -A
git commit -m "chore: Vercel 部署"
```

---

## Phase 2 · 方言识别实验（Task 16）

### Task 16: 实验功能收尾与观察记录

- [ ] **Step 1: 验证开关门控**：设置关闭时首页无方言录音入口；开启后可用（Task 10/12 已实现，本步回归确认）。
- [ ] **Step 2: 方言结果卡增加实验提示**（Modify `src/components/ResultCard.vue`）：在 `mandarin` 分支的朗读按钮上方加一行：

```html
<div class="sub" style="color:#e6a23c">实验功能：识别结果可能不准确</div>
```

- [ ] **Step 3: 建立观察记录模板 docs/dialect-asr-observations.md**

```markdown
# 方言语音识别观察记录
> 每次请 1-2 位平潭本地人朗读 10 句常用语，记录识别结果，用于评估与 prompt 调优。
| 日期 | 说话人 | 普通话原句 | 识别输出 | 是否可用 | 备注 |
|---|---|---|---|---|---|
| | | | | | |
```

- [ ] **Step 4: Commit**

```powershell
git add src/components/ResultCard.vue docs/dialect-asr-observations.md
git commit -m "feat(phase2): 方言识别实验提示与观察记录模板"
```

---

## Phase 3 · 录音补录与词库远程更新（Task 17）

### Task 17: 录音清单工具 + 远程词库验证

- [ ] **Step 1: 实现 scripts/audio-report.mjs**

```js
import fs from 'node:fs'
import { validatePhrases } from './validate-phrases.mjs'

const data = JSON.parse(fs.readFileSync('data/phrases.json', 'utf8'))
const missing = data.filter(p => !p.audio)
console.log(`待录音 ${missing.length} 条：`)
missing.forEach(p => console.log(`${p.id}\t${p.zh}\t${p.pt_hanzi}`))
console.log(`
录制说明：
1. 每句录成 mp3（建议 44.1kHz 或 16kHz 单声道），命名为 public/audio/<id>.mp3
2. 把 data/phrases.json 中对应条目的 audio 改为 "audio/<id>.mp3"
3. 运行 npm run validate 校验通过后提交`)
```

- [ ] **Step 2: 运行并交付补录说明**

运行：`node scripts/audio-report.mjs`
预期：输出待录音清单与录制说明（交给用户安排本地人录音）。

- [ ] **Step 3: 远程词库更新流程验证**

1. 把最新 `data/phrases.json`（含录音 URL 或新词条）上传到任意静态托管（如 GitHub raw / jsDelivr）。
2. 线上站点设置页粘贴该 URL → 重新加载词库 → toast 条数正确。
3. 故意填错 URL → toast 失败但内置词库仍可用。

- [ ] **Step 4: Commit**

```powershell
git add scripts/audio-report.mjs
git commit -m "feat(phase3): 待录音清单工具与远程词库验证"
```

---

## 验收对照（spec §8）

| spec 要求 | 对应任务 |
|---|---|
| 词库 100+ 句可浏览搜索 | Task 2 / Task 11 |
| 普通话语音→平潭话注音全流程 | Task 4/6/9/10 |
| 方言语音识别实验功能（开关） | Task 6/10/12/16 |
| 数据校验脚本 | Task 2 |
| API 冒烟测试 | Task 4/6/7 + tests/ |
| 真机测试清单 | Task 14 |
| 错误处理（权限/超时/额度/降级） | Task 9/10/12 |
