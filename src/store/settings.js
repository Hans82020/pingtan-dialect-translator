import { reactive, watch } from 'vue'

const KEY = 'pt-settings'
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}

export const settings = reactive(Object.assign(
  { direction: 'zh2pt', experimentDialect: false, remotePhraseUrl: '' }, load()))

watch(settings, v => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* 隐私模式等场景静默 */ } }, { deep: true })

const FKEY = 'pt-favorites'
export function getFavorites() { try { return JSON.parse(localStorage.getItem(FKEY)) || [] } catch { return [] } }
export function isFav(id) { return getFavorites().includes(id) }
export function toggleFav(id) {
  const f = getFavorites(); const i = f.indexOf(id)
  i < 0 ? f.push(id) : f.splice(i, 1)
  try { localStorage.setItem(FKEY, JSON.stringify(f)) } catch { /* 隐私模式等场景静默 */ }
  return i < 0
}
