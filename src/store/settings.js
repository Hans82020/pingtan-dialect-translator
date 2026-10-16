import { reactive, watch } from 'vue'

const KEY = 'pt-settings'
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }

export const settings = reactive(Object.assign(
  { direction: 'zh2pt', experimentDialect: false, remotePhraseUrl: '' }, load()))

watch(settings, v => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true })

const FKEY = 'pt-favorites'
export function getFavorites() { try { return JSON.parse(localStorage.getItem(FKEY)) || [] } catch { return [] } }
export function isFav(id) { return getFavorites().includes(id) }
export function toggleFav(id) {
  const f = getFavorites(); const i = f.indexOf(id)
  i < 0 ? f.push(id) : f.splice(i, 1)
  localStorage.setItem(FKEY, JSON.stringify(f))
  return i < 0
}
