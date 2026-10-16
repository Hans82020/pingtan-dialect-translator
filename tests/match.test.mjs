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
