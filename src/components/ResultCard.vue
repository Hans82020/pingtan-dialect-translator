<script setup>
import { ref, computed } from 'vue'
import { showToast } from 'vant'
import { isFav, toggleFav } from '../store/settings.js'
import { fetchTTS } from '../lib/api.mjs'

const props = defineProps({
  /* 词库词条对象；LLM 结果；方言识别的普通话文本 */
  entry: { type: Object, default: null },
  llm: { type: Object, default: null },
  mandarin: { type: String, default: '' },
  fuzzy: { type: Boolean, default: false }
})

const hanzi = computed(() => props.entry?.pt_hanzi || props.llm?.pt_hanzi || '')
const buc = computed(() => props.entry?.pt_buc || props.llm?.pt_buc || '')
const rom = computed(() => props.entry?.pt_rom || props.llm?.pt_rom || '')
const tones = computed(() => props.entry?.tones || props.llm?.tones || '')
const audio = computed(() => (props.entry?.audio ? '/' + props.entry.audio : ''))
const lowConf = computed(() => props.llm?.confidence === 'low' || props.fuzzy)

const playing = ref(false)
async function play() {
  try {
    playing.value = true
    if (audio.value) {
      await new Audio(audio.value).play()
    } else if (props.mandarin) {
      const url = await fetchTTS(props.mandarin)
      await new Audio(url).play()
    }
  } catch { showToast('播放失败，请重试') } finally { playing.value = false }
}

const favId = computed(() => props.entry?.id || null)
function onFav() {
  showToast(toggleFav(favId.value) ? '已收藏' : '已取消收藏')
}
async function copy() {
  const t = [hanzi.value, buc.value, rom.value].filter(Boolean).join('\n') || props.mandarin
  try { await navigator.clipboard.writeText(t); showToast('已复制') }
  catch { showToast('复制失败') }
}
</script>

<template>
  <div class="card">
    <van-tag v-if="lowConf" type="warning" style="float:right">仅供参考</van-tag>
    <template v-if="mandarin">
      <div class="label">普通话</div>
      <div class="hanzi">{{ mandarin }}</div>
      <van-button size="small" icon="volume-o" :loading="playing" @click="play">朗读</van-button>
    </template>
    <template v-else>
      <div class="label">平潭话</div>
      <div class="hanzi">{{ hanzi }}</div>
      <div v-if="buc" class="sub">平话字：{{ buc }}</div>
      <div v-if="rom" class="sub">拼音：{{ rom }}</div>
      <div v-if="tones" class="sub">声调：{{ tones }}</div>
      <van-button size="small" icon="volume-o" :disabled="!audio" @click="play">
        {{ audio ? '播放录音' : '暂无录音' }}
      </van-button>
    </template>
    <van-button size="small" icon="records" @click="copy">复制</van-button>
    <van-button v-if="favId" size="small" :icon="isFav(favId) ? 'star' : 'star-o'" @click="onFav">收藏</van-button>
  </div>
</template>

<style scoped>
.card { background: #fff; border-radius: 12px; padding: 16px; margin: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.label { color: #888; font-size: 12px; }
.hanzi { font-size: 24px; font-weight: bold; margin: 6px 0; }
.sub { color: #555; font-size: 14px; margin: 2px 0; }
</style>
