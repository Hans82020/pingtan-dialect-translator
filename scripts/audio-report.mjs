import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validatePhrases } from './validate-phrases.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const data = JSON.parse(fs.readFileSync(`${root}data/phrases.json`, 'utf8'))

const { errors } = validatePhrases(data, { audioDir: `${root}public` })
if (errors.length) {
  errors.forEach(e => console.error('ERROR', e))
  console.error('词库校验未通过，请先运行 npm run validate')
  process.exit(1)
}

const missing = data.filter(p => !p.audio)
console.log(`待录音 ${missing.length} 条：`)
missing.forEach(p => console.log(`${p.id}\t${p.zh}\t${p.pt_hanzi}`))
console.log(`
录制说明：
1. 每句录成 mp3（建议 44.1kHz 或 16kHz 单声道），命名为 public/audio/<id>.mp3
2. 把 data/phrases.json 中对应条目的 audio 改为 "audio/<id>.mp3"
3. 运行 npm run validate 校验通过后提交`)
