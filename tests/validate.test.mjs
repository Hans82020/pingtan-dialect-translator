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
