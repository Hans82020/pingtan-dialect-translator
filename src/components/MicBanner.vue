<script setup>
const inWechat = /MicroMessenger/i.test(navigator.userAgent)
const inQQ = /QQ\//i.test(navigator.userAgent)
</script>

<template>
  <van-notice-bar v-if="inWechat || inQQ" wrapable :scrollable="false"
    left-icon="info-o"
    text="微信内无法使用语音：请点右上角「···」→「在浏览器打开」，即可语音输入。当前可先用打字翻译。" />
</template>
