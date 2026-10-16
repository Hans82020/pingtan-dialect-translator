<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadPhrases } from '../lib/phrases.js'
import ResultCard from '../components/ResultCard.vue'

const CATEGORY_NAMES = {
  greeting: '问候', daily: '日常', food: '吃喝', shopping: '买卖',
  transport: '出行', emergency: '应急', weather: '天气', family: '家庭',
  numbers: '数字', other: '其他'
}

const list = ref([])
const keyword = ref('')
const activeCat = ref('all')
const active = ref(null)      // 当前查看的词条
const showPopup = ref(false)  // 弹层开关与词条分离，避免 vant 关闭时把对象 ref 回写成 false

onMounted(async () => { list.value = await loadPhrases({ remoteUrl: '' }) })

const cats = computed(() => ['all', ...new Set(list.value.map(p => p.category))])
const filtered = computed(() => list.value.filter(p =>
  (activeCat.value === 'all' || p.category === activeCat.value) &&
  (!keyword.value || (p.zh + p.pt_hanzi).includes(keyword.value))))
</script>

<template>
  <div class="page">
    <van-search v-model="keyword" placeholder="搜索普通话或平潭话" />
    <van-tabs v-model:active="activeCat" swipeable>
      <van-tab v-for="c in cats" :key="c" :name="c" :title="c === 'all' ? '全部' : (CATEGORY_NAMES[c] || c)" />
    </van-tabs>
    <van-cell v-for="p in filtered" :key="p.id" is-link @click="active = p; showPopup = true">
      <template #title>{{ p.zh }}</template>
      <template #value>{{ p.pt_hanzi }}<van-tag v-if="!p.audio" plain type="default" style="margin-left:6px">无录音</van-tag></template>
    </van-cell>
    <van-empty v-if="!filtered.length" description="没有匹配的词条" />
    <van-popup v-model:show="showPopup" position="bottom" round style="padding-bottom:12px">
      <ResultCard v-if="active" :entry="active" />
    </van-popup>
  </div>
</template>
