<script setup>
import { ref, onBeforeUnmount } from 'vue'

const emit = defineEmits(['start', 'end', 'cancel'])
const pressing = ref(false)
const elapsed = ref(0)
let timer = null

function down(e) {
  e.preventDefault()
  if (pressing.value) return
  pressing.value = true
  elapsed.value = 0
  timer = setInterval(() => { elapsed.value += 0.2 }, 200)
  emit('start')
}
function up() {
  if (!pressing.value) return
  clearInterval(timer)
  pressing.value = false
  emit('end', elapsed.value)
}
function cancel() {
  if (!pressing.value) return
  clearInterval(timer)
  pressing.value = false
  emit('cancel')
}
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="rec-wrap">
    <van-button round type="danger" size="large" class="rec-btn" :class="{ active: pressing }"
      @touchstart.prevent="down" @touchend.prevent="up" @touchcancel="cancel"
      @mousedown="down" @mouseup="up" @mouseleave="pressing && up()">
      {{ pressing ? `松开结束 ${elapsed.toFixed(1)}s` : '按住 说话' }}
    </van-button>
  </div>
</template>

<style scoped>
.rec-wrap { padding: 16px 24px; text-align: center; }
.rec-btn { height: 64px; font-size: 20px; width: 100%; }
.rec-btn.active { transform: scale(0.97); }
</style>
