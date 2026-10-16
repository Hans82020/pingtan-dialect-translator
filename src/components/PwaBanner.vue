<script setup>
import { computed } from 'vue'

const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
const inWechatOrQq = /MicroMessenger|QQ\//i.test(navigator.userAgent)
const show = !standalone && !inWechatOrQq
const guide = computed(() =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? '点 Safari 底部「分享」→「添加到主屏幕」，即可像 App 一样全屏使用。'
    : '点浏览器右上角菜单 →「添加到主屏幕」，即可像 App 一样全屏使用。')
</script>

<template>
  <van-notice-bar v-if="show" wrapable :scrollable="false" left-icon="apps-o" :text="guide" />
</template>
