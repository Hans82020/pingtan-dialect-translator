<script setup>
import { NavBar, Tabbar, TabbarItem } from 'vant'
</script>

<template>
  <van-nav-bar title="平潭话翻译器" fixed placeholder />
  <router-view />
  <van-tabbar route fixed>
    <van-tabbar-item to="/" icon="chat-o">翻译</van-tabbar-item>
    <van-tabbar-item to="/phrases" icon="bookmark-o">词库</van-tabbar-item>
    <van-tabbar-item to="/favorites" icon="star-o">收藏</van-tabbar-item>
    <van-tabbar-item to="/settings" icon="setting-o">设置</van-tabbar-item>
  </van-tabbar>
</template>

<style>
body { padding-bottom: 70px; }
#app { max-width: 640px; margin: 0 auto; }
</style>
