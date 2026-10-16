import { chatJson } from './zhipu.mjs'

export async function translateZhToPt(text, apiKey) {
  const r = await chatJson(text, { apiKey })
  return { ...r, source: 'llm' }
}
