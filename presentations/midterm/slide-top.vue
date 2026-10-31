<script setup lang="ts">
// Thin progress bar adapted from slidev-theme-touying's university preset (MIT).
// Backup slides (frontmatter `backup: true`) are excluded from the total, so the
// bar reaches the end on the closing slide of the 5-minute talk.
import { useSlideContext } from '@slidev/client'
import { computed } from 'vue'

const { $page, $nav, $frontmatter } = useSlideContext()

const mainTotal = computed(
  () => $nav.value.slides.filter((slide) => !slide.meta.slide.frontmatter.backup).length,
)
const visible = computed(
  () => !$frontmatter.backup && !['cover', 'focus'].includes($frontmatter.layout ?? ''),
)
const percent = computed(() => Math.min(($page.value / mainTotal.value) * 100, 100))
</script>

<template>
  <div v-if="visible" class="lumen-progress">
    <div class="lumen-progress-fill" :style="{ width: `${percent}%` }" />
  </div>
</template>

<style scoped>
.lumen-progress {
  background: #d0d7de;
  height: 3px;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.lumen-progress-fill {
  background: var(--slidev-theme-primary);
  height: 100%;
}
</style>
