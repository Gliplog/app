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
import { useChartColors } from '@/composables/useChartColors'
import { formatDate, formatDateRange } from '@/services/time'
import { roundTo } from '@/domain/units'
import { bodyChartOption, type BodyChartInput } from './bodyChart'

use([
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  MarkLineComponent,
  DataZoomComponent,
  CanvasRenderer,
])

/**
 * One measure over time (weight, BMI, HbA1c or glucose) with optional labelled reference lines.
 * A secondary set (glucose at other times of day) is drawn as unjoined hollow points, so
 * readings taken under different conditions are never joined into one line.
 */
const props = defineProps<BodyChartInput>()

const { colors } = useChartColors()
const showTable = ref(false)

const fmt = (v: number) => `${roundTo(v, props.decimals)} ${props.unitLabel}`.trim()

const option = computed(() => bodyChartOption(props, colors.value))

const ariaSummary = computed(() => {
  const pts = props.points
  if (!pts.length) return `${props.measure}: no entries yet.`
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return `${props.measure} from ${fmt(first.value)} to ${fmt(last.value)}, ${formatDateRange(first.at, last.at)}, ${pts.length} entries.`
})

/** Every reading, newest first, with its note when the chart has more than one kind. */
const rows = computed(() =>
  [...props.points, ...(props.secondary?.points ?? [])].sort((a, b) => b.at - a.at),
)
</script>

<template>
  <div>
    <v-chart class="body-chart" :option="option" autoresize role="img" :aria-label="ariaSummary" />
    <v-btn variant="text" size="small" class="mt-1" @click="showTable = !showTable">
      {{ showTable ? 'Hide table' : 'Show as table' }}
    </v-btn>
    <v-expand-transition>
      <v-table v-if="showTable" density="compact" class="body-chart__table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" class="text-end">{{ measure }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="`${row.at}-${i}`">
            <td>{{ formatDate(row.at) }}</td>
            <td class="text-end tb-num">
              {{ fmt(row.value) }}
              <span v-if="row.note" class="d-block text-body-small tb-faint">{{ row.note }}</span>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.body-chart {
  width: 100%;
  height: 260px;
}

@media (min-width: 840px) {
  .body-chart {
    height: 320px;
  }
}

.body-chart__table {
  background: transparent;
}
</style>
