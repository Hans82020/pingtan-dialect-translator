import { chatJson } from './zhipu.mjs'

export async function translateZhToPt(text, env = process.env) {
  const r = await chatJson(text, { apiKey: env.ZHIPU_API_KEY })
  return { ...r, source: 'llm' }
}
