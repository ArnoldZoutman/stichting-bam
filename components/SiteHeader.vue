<script setup lang="ts">
import { mainNavigation } from '~/config/navigation'

defineProps<{ siteName: string }>()
</script>

<template>
  <header class="site-header">
    <div class="container site-header__inner">
      <NuxtLink to="/" class="site-header__logo">{{ siteName }}</NuxtLink>
      <nav class="site-nav" aria-label="Hoofdnavigatie">
        <ul>
          <li v-for="item in mainNavigation" :key="item.to">
            <NuxtLink :to="item.to">{{ item.label }}</NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>
</template>
