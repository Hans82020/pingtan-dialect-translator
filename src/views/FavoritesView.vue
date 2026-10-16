<script setup>
import { ref, onMounted } from 'vue'
import { loadPhrases } from '../lib/phrases.js'
import { getFavorites } from '../store/settings.js'

const favs = ref([])
onMounted(async () => {
  const all = await loadPhrases({ remoteUrl: '' })
  const ids = getFavorites()
  favs.value = all.filter(p => ids.includes(p.id))
})
</script>

<template>
  <div class="page">
    <van-cell v-for="p in favs" :key="p.id" is-link :title="p.zh" :value="p.pt_hanzi"
      @click="$router.push('/phrases')" />
    <van-empty v-if="!favs.length" description="还没有收藏，去翻译或词库页收藏吧" />
  </div>
</template>
