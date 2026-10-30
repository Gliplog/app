<script setup lang="ts">
import markUrl from '@/assets/brand/gliplog-mark.svg'

/**
 * The Gliplog mark (a dose curve rising and ebbing over a wave) beside the
 * two-tone wordmark. The mark is a fixed brand asset, identical in both themes; the wordmark is
 * live text so it follows the theme and stays crisp at any size.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 32 })
</script>

<template>
  <span class="app-logo" :style="{ '--logo-size': `${size}px` }">
    <img :src="markUrl" alt="" class="app-logo__mark" />
    <span class="app-logo__word"><span>Glip</span><span class="app-logo__calc">log</span></span>
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--logo-size) * 0.3);
}

.app-logo__mark {
  width: var(--logo-size);
  height: var(--logo-size);
  border-radius: calc(var(--logo-size) * 0.22);
  box-shadow: var(--gl-glass-shadow);
}

.app-logo__word {
  font-family: var(--gl-font);
  font-weight: 700;
  font-size: calc(var(--logo-size) * 0.66);
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--gl-text-1);
}

.app-logo__calc {
  color: var(--gl-brand);
}
</style>
