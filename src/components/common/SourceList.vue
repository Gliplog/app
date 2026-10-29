<script setup lang="ts">
import { ref, useId } from 'vue'
import type { SourceRef } from '@/domain/catalog'
import SourceBadge from './SourceBadge.vue'

/** Citations behind a card's figures, collapsed behind a toggle so they don't crowd the text. */
defineProps<{ sources: readonly SourceRef[] }>()

const open = ref(false)
const listId = useId()
</script>

<template>
  <div v-if="sources.length">
    <v-btn
      variant="text"
      size="small"
      :aria-expanded="open"
      :aria-controls="listId"
      @click="open = !open"
    >
      {{ open ? 'Hide sources' : `Sources (${sources.length})` }}
    </v-btn>
    <v-expand-transition>
      <ul v-show="open" :id="listId" class="source-list">
        <li v-for="source in sources" :key="source.citation" class="text-body-small">
          <SourceBadge :kind="source.kind" />
          <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{
            source.citation
          }}</a>
          <span v-else>{{ source.citation }}</span>
        </li>
      </ul>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.source-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: grid;
  gap: 6px;
}

.source-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
