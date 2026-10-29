<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { amountAt, rateConstants, type DoseEvent, type PkParameters } from '@/domain/pk'
import { useChartColors } from '@/composables/useChartColors'
import { formatShort } from '@/services/time'
import { levelsModel } from '@/domain/levels'
import { formatAmount } from '@/domain/units'
import { levelsOption } from './levelsChart'

use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  DataZoomComponent,
  CanvasRenderer,
])

const props = defineProps<{
  params: PkParameters
  /** Logged doses, already converted to `unitLabel`. */
  doses: DoseEvent[]
  /** The draw being calculated, shown as a dashed projection; null when only history is shown. */
  preview: DoseEvent | null
  unitLabel: string
  now: number
  /** Limits history for frequently dosed medicines. */
  lookbackHours?: number
}>()

const { colors } = useChartColors()
const showTable = ref(false)

const model = computed(() => levelsModel(props))
const summary = computed(() => model.value.summary)
const option = computed(() => levelsOption(props, model.value, colors.value))

const fmt = (v: number) => formatAmount(v, props.unitLabel)

const ariaSummary = computed(() => {
  const { now, peak, clearsAt } = summary.value
  const parts = [`Estimated amount in the body now: ${fmt(now)}.`]
  if (peak) parts.push(`Peak ${fmt(peak.amount)} around ${formatShort(peak.at)}.`)
  if (clearsAt) parts.push(`Below 10% of peak by ${formatShort(clearsAt)}.`)
  return parts.join(' ')
})

/** A dozen evenly spaced readings for the table view. */
const tableRows = computed(() => {
  const { start, end } = model.value.window
  const k = rateConstants(props.params)
  return Array.from({ length: 13 }, (_, i) => {
    const at = start + ((end - start) * i) / 12
    return { at, amount: amountAt(at, model.value.allDoses, k) }
  })
})
</script>

<template>
  <div class="pk-chart">
    <dl class="pk-chart__stats">
      <div>
        <dt class="tb-faint">Now</dt>
        <dd class="tb-num">{{ fmt(summary.now) }}</dd>
      </div>
      <div v-if="summary.peak">
        <dt class="tb-faint">{{ preview ? 'Peak with this dose' : 'Peak' }}</dt>
        <dd class="tb-num">
          {{ fmt(summary.peak.amount) }}
          <span class="tb-faint">· {{ formatShort(summary.peak.at) }}</span>
        </dd>
      </div>
      <div v-if="summary.clearsAt">
        <dt class="tb-faint">Below 10% of peak</dt>
        <dd class="tb-num">{{ formatShort(summary.clearsAt) }}</dd>
      </div>
    </dl>
    <v-chart
      class="pk-chart__canvas"
      :option="option"
      autoresize
      role="img"
      :aria-label="ariaSummary"
    />
    <v-btn variant="text" size="small" class="mt-1" @click="showTable = !showTable">
      {{ showTable ? 'Hide table' : 'Show as table' }}
    </v-btn>
    <v-expand-transition>
      <v-table v-if="showTable" density="compact" class="pk-chart__table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col" class="text-end">Estimated amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.at">
            <td>{{ formatShort(row.at) }}</td>
            <td class="text-end tb-num">{{ fmt(row.amount) }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.pk-chart__canvas {
  width: 100%;
  height: 280px;
}

@media (min-width: 840px) {
  .pk-chart__canvas {
    height: 340px;
  }
}

.pk-chart__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0 0 8px;
}

.pk-chart__stats dt {
  font-size: 0.75rem;
  font-weight: 600;
}

.pk-chart__stats dd {
  margin: 0;
  font-weight: 600;
}

.pk-chart__table {
  background: transparent;
}
</style>
