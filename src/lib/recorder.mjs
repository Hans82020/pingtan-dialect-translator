import Recorder from 'recorder-core'
import 'recorder-core/src/engine/wav'

export const MIN_MS = 1000
export const MAX_MS = 30000

export function micUnsupported() { return !navigator.mediaDevices?.getUserMedia }

function err(key, message) { return Object.assign(new Error(message), { key }) }

export function openRecorder(onTick) {
  return new Promise((resolve, reject) => {
    if (micUnsupported()) return reject(err('UNSUPPORTED', '当前浏览器不支持录音'))
    const rec = Recorder({ type: 'wav', sampleRate: 16000, bitRate: 16 })
    rec.open(() => {
      rec.start()
      const t0 = Date.now()
      const timer = setInterval(() => onTick?.(Date.now() - t0), 200)
      resolve({
        stop: () => new Promise((res, rej) => {
          const dur = Date.now() - t0
          clearInterval(timer)
          rec.stop((blob) => {
            rec.close()
            if (dur < MIN_MS) rej(err('TOO_SHORT', '说话太短，请长按说话'))
            else if (dur > MAX_MS) rej(err('TOO_LONG', '录音超过 30 秒，请重录'))
            else res(blob)
          }, (msg) => { clearInterval(timer); rec.close(); rej(err('RECORD_FAIL', msg)) })
        }),
        cancel: () => { clearInterval(timer); try { rec.stop(() => {}, () => {}) } catch {} rec.close() }
      })
    }, (msg, isUserNotAllow) =>
      reject(err(isUserNotAllow ? 'PERMISSION_DENIED' : 'OPEN_FAIL', isUserNotAllow ? '麦克风权限被拒绝，请在浏览器设置中允许后重试，或改用打字' : msg)))
  })
}
