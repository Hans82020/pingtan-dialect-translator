// 一键生成 EdgeOne Pages 预览链接：重新部署 → 输出带 token 的分享链接（3 小时有效）并复制到剪贴板
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const NAME = 'pingtan-dialect-translator'
const FALLBACK = 'D:\\environment\\node-v24.22.0-win-x64\\edgeone.cmd'

function deploy(cmdPath) {
  return new Promise((resolve, reject) => {
    console.log(`正在部署（edgeone pages deploy），约需 1~2 分钟...`)
    const c = spawn('cmd.exe', ['/c', cmdPath, 'pages', 'deploy', '-n', NAME], { windowsHide: true })
    let out = ''
    c.stdout.on('data', d => { process.stdout.write(d); out += d })
    c.stderr.on('data', d => { process.stderr.write(d); out += d })
    c.on('error', e => reject(Object.assign(e, { retry: e.code === 'ENOENT' })))
    c.on('close', code => code === 0 ? resolve(out) : reject(new Error(`部署失败（exit ${code}），请检查上方日志`)))
  })
}

let out = null
for (const cmdPath of ['edgeone.cmd', FALLBACK]) {
  try {
    out = await deploy(cmdPath)
    break
  } catch (e) {
    if (!e.retry || cmdPath === FALLBACK) {
      console.error(`\n${e.message}`)
      process.exit(1)
    }
    console.log(`PATH 中未找到 edgeone，改用 ${FALLBACK}`)
  }
}

const links = [...new Set((out.match(/https:\/\/[^\s"'`<]+edgeone\.cool[^\s"'`<]*/g) || []).filter(u => u.includes('eo_token=')))]
if (!links.length) {
  console.error('部署成功但未提取到预览链接，请从上方日志手动复制 Deploy URL')
  process.exit(1)
}
const link = links[links.length - 1]

spawn('clip', { windowsHide: true }).stdin.end(link)
console.log(`\n========================================`)
console.log(`预览链接已生成（3 小时内有效，过期请重新执行本脚本）：`)
console.log(`\n${link}\n`)
console.log(`已复制到剪贴板，可直接粘贴发给手机（微信/QQ 均可）。`)
console.log(`首次在新设备打开时同样按提示通过即可。`)
console.log(`========================================`)
