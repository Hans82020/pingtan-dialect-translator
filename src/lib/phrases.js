import localData from '../../data/phrases.json'

let cache = null

function merge(local, remote) {
  const map = new Map(local.map(p => [p.id, p]))
  for (const p of remote) if (p && p.id) map.set(p.id, { ...map.get(p.id), ...p })
  return [...map.values()]
}

export async function loadPhrases({ refresh = false, remoteUrl = '' } = {}) {
  if (cache && !refresh) return cache
  let list = [...localData]
  if (remoteUrl) {
    try {
      const r = await fetch(remoteUrl, { cache: 'no-store' })
      if (r.ok) {
        const remote = await r.json()
        if (Array.isArray(remote)) list = merge(list, remote)
      }
    } catch { /* 远程失败静默用本地 */ }
  }
  cache = list
  return list
}
