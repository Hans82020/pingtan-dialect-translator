<script setup>
import { ref, computed } from 'vue'
import { showToast, showLoadingToast, closeToast } from 'vant'
import MicBanner from '../components/MicBanner.vue'
import RecordButton from '../components/RecordButton.vue'
import ResultCard from '../components/ResultCard.vue'
import { settings } from '../store/settings.js'
import { loadPhrases } from '../lib/phrases.js'
import { matchPhrase } from '../lib/match.js'
import { openRecorder, micUnsupported } from '../lib/recorder.mjs'
import { postJSON, postAudio, ApiError } from '../lib/api.mjs'

const mode = computed({ get: () => settings.direction, set: v => (settings.direction = v) })
const text = ref('')
const busy = ref(false)
const result = ref(null)   // {entry?, fuzzy?, llm?, mandarin?}
const errMsg = ref('')

const micOK = !micUnsupported()
const dialectOn = computed(() => settings.experimentDialect)

async function handleText(raw) {
  const input = (raw ?? text.value).trim()
  if (!input || busy.value) return
  busy.value = true; errMsg.value = ''; result.value = null
  showLoadingToast({ message: '翻译中…', forbidClick: true, duration: 0 })
  try {
    const phrases = await loadPhrases({ remoteUrl: settings.remotePhraseUrl })
    if (mode.value === 'zh2pt') {
      const hit = matchPhrase(phrases, input)
      if (hit) { result.value = { entry: hit.entry, fuzzy: hit.fuzzy } }
      else { result.value = { llm: await postJSON('/api/translate', { text: input }) } }
    } else {
      result.value = { mandarin: input }   // 方言文字兜底：直接当作普通话展示
    }
  } catch (e) { errMsg.value = msgOf(e) }
  finally { busy.value = false; closeToast() }
}

let rec = null
async function onRecStart() {
  errMsg.value = ''; result.value = null
  try { rec = await openRecorder(ms => { if (ms > 29500) onRecEnd() }) }
  catch (e) { errMsg.value = e.message }
}
async function onRecEnd() {
  if (!rec) return
  const r = rec; rec = null
  try {
    const blob = await r.stop()
    busy.value = true
    showLoadingToast({ message: '识别中…', forbidClick: true, duration: 0 })
    const api = mode.value === 'zh2pt' ? '/api/asr' : '/api/audio'
    const { text: heard } = await postAudio(api, blob)
    text.value = heard
    await handleText(heard)
  } catch (e) { errMsg.value = msgOf(e) }
  finally { busy.value = false; closeToast() }
}
function msgOf(e) {
  if (e instanceof ApiError && e.key === 'QUOTA') return 'AI 免费额度已用尽，请联系维护者充值或稍后再试'
  if (e.key === 'NO_SPEECH') return e.message
  return e.message || '出错了，请重试'
}
</script>

<template>
  <div class="page">
    <MicBanner />
    <van-radio-group v-model="mode" direction="horizontal" style="justify-content:center;padding:8px">
      <van-radio name="zh2pt">普通话 → 平潭话</van-radio>
      <van-radio name="pt2zh">平潭话 → 普通话</van-radio>
    </van-radio-group>

    <template v-if="micOK && (mode === 'zh2pt' || dialectOn)">
      <RecordButton @start="onRecStart" @end="onRecEnd" />
    </template>
    <van-notice-bar v-else-if="mode === 'pt2zh' && !dialectOn" wrapable :scrollable="false"
      text="「平潭话语音识别」为实验功能，请在设置页开启后使用；可先在下方输入方言文字。" />

    <van-field v-model="text" type="textarea" rows="2" autosize clearable
      :placeholder="mode === 'zh2pt' ? '输入普通话，如：今天天气真好' : '输入平潭话文字（可选）'" />

    <div style="padding:0 16px">
      <van-button type="primary" block :loading="busy" @click="handleText()">翻 译</van-button>
    </div>

    <van-notice-bar v-if="errMsg" wrapable :scrollable="false" left-icon="warning-o" :text="errMsg" />
    <ResultCard v-if="result" v-bind="result" />
  </div>
</template>
