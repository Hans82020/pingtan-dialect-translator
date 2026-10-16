import test from 'node:test'
import assert from 'node:assert/strict'
import { transcribe, parseText, PROMPTS } from '../node-functions/_lib/dashscope.mjs'

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
  assert.equal(captured.body.model, 'qwen3.8-omni-flash')
  assert.ok(captured.body.messages[1].content[0].input_audio.data.startsWith('data:audio/wav;base64,'))
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
