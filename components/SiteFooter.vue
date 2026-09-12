<script setup lang="ts">
defineProps<{ siteName: string }>()

const jaar = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p>&copy; {{ jaar }} {{ siteName }}</p>
      <p>
        Content beheerd in
        <a href="https://www.stichting-bam.nl" rel="noopener noreferrer">WordPress</a>
      </p>
    </div>
  </footer>
</template>
