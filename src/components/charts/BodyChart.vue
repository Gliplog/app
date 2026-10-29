<script setup lang="ts">
import { computed, ref } from 'vue'
import { use, type ComposeOption } from 'echarts/core'
import { LineChart, type LineSeriesOption } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  type DataZoomComponentOption,
  type GridComponentOption,
  type TooltipComponentOption,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useChartColors } from '@/composables/useChartColors'
import { formatDate, formatDateRange } from '@/services/time'
import { roundTo } from '@/domain/units'

use([
  LineChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  DataZoomComponent,
  CanvasRenderer,
])

/** One measure over time (weight or BMI) with optional labelled reference lines. */
const props = defineProps<{
  points: { at: number; value: number }[]
  unitLabel: string
  /** "Weight" or "BMI", for the accessible summary and table header. */
  measure: string
  decimals: number
  /** Horizontal guides such as a goal weight or BMI band edges; drawn dashed with a label. */
  guides: { value: number; label: string }[]
}>()

const { colors } = useChartColors()
const showTable = ref(false)

const fmt = (v: number) => `${roundTo(v, props.decimals)} ${props.unitLabel}`.trim()

type Option = ComposeOption<
  LineSeriesOption | GridComponentOption | TooltipComponentOption | DataZoomComponentOption
>

const option = computed<Option>(() => {
  const c = colors.value
  const values = props.points.map((p) => p.value)
  const all = [...values, ...props.guides.map((g) => g.value)]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const pad = Math.max((max - min) * 0.15, 1)
  return {
    animation: false,
    textStyle: { fontFamily: c.font, color: c.text },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.text, fontFamily: c.font },
      valueFormatter: (v) => fmt(Number(v)),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: c.grid } },
      axisLabel: {
        color: c.axis,
        hideOverlap: true,
        formatter: { month: '{MMM}', day: '{MMM} {d}', year: '{yyyy}' },
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: Math.floor(min - pad),
      max: Math.ceil(max + pad),
      axisLabel: { color: c.axis, formatter: (v: number) => `${roundTo(v, 1)}` },
      splitLine: { lineStyle: { color: c.grid } },
    },
    dataZoom: [{ type: 'inside', filterMode: 'none' }],
    series: [
      {
        name: props.measure,
        type: 'line',
        showSymbol: props.points.length < 40,
        symbolSize: 6,
        lineStyle: { width: 2, color: c.logged, cap: 'round', join: 'round' },
        itemStyle: { color: c.logged },
        data: props.points.map((p) => [p.at, p.value]),
        markLine: props.guides.length
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: c.now, type: 'dashed', width: 1 },
              label: {
                color: c.axis,
                fontFamily: c.font,
                formatter: '{b}',
                position: 'insideEndTop',
              },
              data: props.guides.map((g) => ({ yAxis: g.value, name: g.label })),
            }
          : undefined,
      },
    ],
  }
})

const ariaSummary = computed(() => {
  const pts = props.points
  if (!pts.length) return `${props.measure}: no entries yet.`
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return `${props.measure} from ${fmt(first.value)} to ${fmt(last.value)}, ${formatDateRange(first.at, last.at)}, ${pts.length} entries.`
})

const rows = computed(() => [...props.points].reverse())
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
          <tr v-for="row in rows" :key="row.at">
            <td>{{ formatDate(row.at) }}</td>
            <td class="text-end tb-num">{{ fmt(row.value) }}</td>
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
