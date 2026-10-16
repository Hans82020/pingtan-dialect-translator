import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { ApiError } from './http.mjs'

export function escapeSsml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
}

export async function ttsMp3(text) {
  const tts = new MsEdgeTTS()
  try {
    await tts.setMetadata('zh-CN-XiaoxiaoNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const r = tts.toStream(escapeSsml(text))
    const stream = r.audioStream || r
    const chunks = []
    for await (const c of stream) chunks.push(c)
    const buf = Buffer.concat(chunks)
    if (!buf.length) throw new ApiError('TTS_UPSTREAM', 503, '语音合成暂不可用，请稍后再试')
    return buf
  } catch (e) {
    throw new ApiError('TTS_UPSTREAM', 503, '语音合成暂不可用，请稍后再试')
  } finally {
    tts.close()
  }
}
