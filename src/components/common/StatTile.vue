<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  label: string
  value: string
  note?: string
  to?: RouteLocationRaw
}>()
</script>

<template>
  <v-card :to="to" :link="Boolean(to)" class="stat-tile">
    <v-card-text class="stat-tile__body">
      <span class="stat-tile__label gl-muted">{{ label }}</span>
      <span class="stat-tile__value gl-display gl-num">{{ value }}</span>
      <span v-if="note" class="stat-tile__note gl-muted">{{ note }}</span>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.stat-tile {
  display: flex;
  flex-direction: column;
  min-height: 48px;
}

.stat-tile__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
}

.stat-tile__label {
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
}

.stat-tile__value {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.25;
  color: var(--gl-text-1);
}

.stat-tile__note {
  font-size: 0.75rem;
  line-height: 1.3;
}
</style>
