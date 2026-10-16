import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeSsml } from '../node-functions/_lib/tts.mjs'

test('SSML 特殊字符全部转义', () => {
  assert.equal(escapeSsml('Tom & Jerry <爱吃> "鱼" 的故事'), 'Tom &amp; Jerry &lt;爱吃&gt; &quot;鱼&quot; 的故事')
})
test('普通文本原样返回', () => {
  assert.equal(escapeSsml('食罢未？'), '食罢未？')
})
