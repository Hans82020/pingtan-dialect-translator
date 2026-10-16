<script setup>
import { ref } from 'vue'
import { showToast } from 'vant'
import { settings } from '../store/settings.js'
import { loadPhrases } from '../lib/phrases.js'

const remoteUrl = ref(settings.remotePhraseUrl)
const loading = ref(false)

async function reloadPhrases() {
  loading.value = true
  try {
    settings.remotePhraseUrl = remoteUrl.value.trim()
    const n = (await loadPhrases({ refresh: true, remoteUrl: settings.remotePhraseUrl })).length
    showToast(`词库已加载 ${n} 条`)
  } catch { showToast('加载失败，将使用内置词库') }
  finally { loading.value = false }
}
</script>

<template>
  <div class="page">
    <van-cell-group inset title="功能开关">
      <van-cell center title="方言语音识别（实验）" label="说平潭话→普通话。识别结果可能不准确">
        <template #right-icon><van-switch v-model="settings.experimentDialect" /></template>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset title="词库更新">
      <van-field v-model="remoteUrl" label="远程词库 URL" placeholder="https://…/phrases.json（可留空）" />
      <div style="padding:8px 16px">
        <van-button size="small" :loading="loading" @click="reloadPhrases">重新加载词库</van-button>
      </div>
    </van-cell-group>

    <van-cell-group inset title="关于">
      <van-cell title="版本" value="0.1.0 MVP" />
      <van-cell title="语料致谢" label="米时典 SeeDict（seedict.com）、开源平话字表（only3km/ciklinbekin）、LinguaCommons 福州话词表。AI 翻译结果仅供参考，方言写法与注音有待本地人校对。" />
      <van-cell title="免责声明" label="本工具为公益性方言学习辅助。方言语音识别为实验功能，准确率不作保证；正式场合请以真人沟通为准。" />
    </van-cell-group>
  </div>
</template>
