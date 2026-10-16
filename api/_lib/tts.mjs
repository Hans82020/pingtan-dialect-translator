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
