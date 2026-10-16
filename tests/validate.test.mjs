import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
test('声调数与注音音节数不一致被抓出', () => {
  const r = validatePhrases([{ ...good, pt_rom: 'a1 b2', tones: '阴平' }])
  assert.ok(r.errors.some(e => e.includes('音节')))
})
test('声调数与注音音节数一致不报错', () => {
  const r = validatePhrases([{ ...good, audio: null }])
  assert.ok(!r.errors.some(e => e.includes('音节')))
})

function withTmpAudioDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-audio-'))
  try { fn(dir) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

test('audio 指向已存在目录报错', () => {
  withTmpAudioDir(dir => {
    fs.mkdirSync(path.join(dir, 'a_dir'))
    const r = validatePhrases([{ ...good, audio: 'a_dir' }], { audioDir: dir })
    assert.ok(r.errors.some(e => e.includes('音频')))
  })
})
test('audio 扩展名不在白名单报错', () => {
  withTmpAudioDir(dir => {
    fs.writeFileSync(path.join(dir, 'bad.txt'), 'x')
    const r = validatePhrases([{ ...good, audio: 'bad.txt' }], { audioDir: dir })
    assert.ok(r.errors.some(e => e.includes('音频')))
  })
})
test('audio 为白名单内真实文件不报错不警告', () => {
  withTmpAudioDir(dir => {
    fs.writeFileSync(path.join(dir, 'ok.mp3'), 'x')
    const r = validatePhrases([{ ...good, audio: 'ok.mp3' }], { audioDir: dir })
    assert.equal(r.errors.length, 0)
    assert.equal(r.warnings.length, 0)
  })
})
test('audio 为白名单内 .wav 文件通过', () => {
  withTmpAudioDir(dir => {
    fs.writeFileSync(path.join(dir, 'ok.WAV'), 'x')
    const r = validatePhrases([{ ...good, audio: 'ok.WAV' }], { audioDir: dir })
    assert.equal(r.errors.length, 0)
    assert.equal(r.warnings.length, 0)
  })
})
