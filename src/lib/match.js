export function normalize(s) {
  return (s || '').replace(/[\s，。？！?!,.:：;；、~～"'‘’“”·…]/g, '')
}

export function editDistance(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

export function matchPhrase(phrases, text) {
  const q = normalize(text)
  if (!q) return null
  let best = null
  for (const p of phrases) {
    const t = normalize(p.zh)
    if (t === q) return { entry: p, fuzzy: false }
    const d = editDistance(t, q)
    const max = Math.max(1, Math.floor(Math.max(t.length, q.length) / 4))
    if (d <= max && (!best || d < best.d)) best = { entry: p, fuzzy: true, d }
  }
  return best ? { entry: best.entry, fuzzy: true } : null
}
