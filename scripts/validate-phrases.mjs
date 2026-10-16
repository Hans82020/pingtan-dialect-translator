import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const CATEGORIES = ['greeting', 'daily', 'food', 'shopping', 'transport',
  'emergency', 'weather', 'family', 'numbers', 'other']
export const TONES = ['阴平', '阳平', '阴上', '阳上', '阴去', '阳去', '阴入', '阳入']
export const AUDIO_EXTS = ['.mp3', '.wav', '.m4a']

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
    if (p.tones && p.pt_rom) {
      const toneCount = String(p.tones).split('-').filter(Boolean).length
      const syllableCount = String(p.pt_rom).trim().split(/\s+/).filter(Boolean).length
      if (toneCount !== syllableCount)
        errors.push(`${at}: 声调数(${toneCount})与注音音节数(${syllableCount})不一致`)
    }
    if (p.audio) {
      const audioPath = path.join(audioDir, p.audio)
      let stat = null
      try { stat = fs.statSync(audioPath) } catch { /* 不存在 */ }
      const ext = path.extname(audioPath).toLowerCase()
      if (!stat || !stat.isFile()) errors.push(`${at}: 音频文件不存在或不是文件 ${p.audio}`)
      else if (!AUDIO_EXTS.includes(ext))
        errors.push(`${at}: 音频扩展名不支持 ${p.audio}（仅限 ${AUDIO_EXTS.join('/')}）`)
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
