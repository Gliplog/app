<script setup lang="ts">
import { useEntries } from '@/composables/useEntries'
import EntriesTimeline from '@/components/journal/EntriesTimeline.vue'

const { entries } = useEntries()
</script>

<template>
  <div class="gl-page">
    <header class="mb-4">
      <p class="gl-eyebrow">Everything you’ve logged</p>
      <h1 class="gl-display text-headline-large">History</h1>
    </header>

    <EntriesTimeline :entries="entries" />
  </div>
</template>
