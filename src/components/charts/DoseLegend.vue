<script setup lang="ts">
import type { DoseLegendItem } from '@/domain/doseBands'
import { formatAmount } from '@/domain/units'

defineProps<{
  legend: DoseLegendItem[]
  named: boolean
}>()

const text = (item: DoseLegendItem) => formatAmount(item.amount, item.unitLabel)
</script>

<template>
  <ul class="gl-dose-legend" aria-label="Doses">
    <li v-for="item in legend" :key="`${item.key}:${item.amount}`">
      <span :class="['gl-swatch', `gl-swatch--dose-${item.slot + 1}`]" aria-hidden="true" />
      {{ named ? `${item.label} ${text(item)}` : text(item) }}
    </li>
  </ul>
</template>

<style scoped>
.gl-dose-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: 0.8125rem;
  color: var(--gl-text-2);
}

.gl-dose-legend li {
  display: inline-flex;
  align-items: center;
}
</style>
