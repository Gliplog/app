<script setup lang="ts">
import { computed, ref } from 'vue'
import { use, type ComposeOption } from 'echarts/core'
import {
  LineChart,
  ScatterChart,
  type LineSeriesOption,
  type ScatterSeriesOption,
} from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type TooltipComponentOption,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { Trial } from '@/domain/catalog'
import { cohortOverlay, type ProgressPoint } from '@/domain/progress'
import {
  formatPercentChange,
  formatWeightChange,
  fromKg,
  roundTo,
  type WeightUnit,
} from '@/domain/units'
import { useChartColors } from '@/composables/useChartColors'

use([
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
])

/**
 * The user's change week by week, with each trial arm's published mean at the endpoint week
 * and the spread between arms. Arms are points with no line to them: the label prints one week,
 * and anything drawn before it would be invented. Series differ by shape and line style as
 * well as colour.
 */
const props = defineProps<{
  trial: Trial
  /** The user's progress from week 0 of this medicine. */
  series: ProgressPoint[]
  weightUnit: WeightUnit
}>()

const { colors } = useChartColors()
const showTable = ref(false)

const overlay = computed(() => cohortOverlay(props.series, props.trial))
const percent = computed(() => props.trial.measure === 'percent')

/** Plotted value: percent as is, kilograms in the user's weight unit. */
const plot = (change: number) =>
  percent.value ? change : roundTo(fromKg(change, props.weightUnit), 2)
const fmt = (change: number) =>
  percent.value ? formatPercentChange(change) : formatWeightChange(change, props.weightUnit)
const axisUnit = computed(() => (percent.value ? '%' : ` ${props.weightUnit}`))

const YOU = 'You'
const ARMS = 'Trial arm average'
const PLACEBO = 'Placebo average'
const SPREAD = 'Range across arms'

type Option = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
>

const option = computed<Option>(() => {
  const c = colors.value
  const { user, arms, spread } = overlay.value
  const endWeek = props.trial.weeks
  const lastUserWeek = user.length ? user[user.length - 1]!.weeks : 0
  const maxWeek = Math.ceil((Math.max(endWeek, lastUserWeek) + 4) / 4) * 4
  // The third value is the unplotted change, so the tooltip formats it like the rest of the app.
  const armPoint = (a: (typeof arms)[number]) => ({
    value: [a.weeks, plot(a.change), a.change],
    name: a.label,
  })
  const armLabel = {
    show: true,
    position: 'right' as const,
    color: c.axis,
    fontFamily: c.font,
    fontSize: 11,
    formatter: '{b}',
  }

  const series: (LineSeriesOption | ScatterSeriesOption)[] = []
  if (spread) {
    series.push({
      name: SPREAD,
      type: 'line',
      silent: true,
      symbol: 'none',
      lineStyle: { width: 12, color: c.trial, opacity: 0.18, cap: 'round' },
      data: [
        [endWeek, plot(spread.from)],
        [endWeek, plot(spread.to)],
      ],
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: c.now, type: 'dashed', width: 1 },
        label: {
          formatter: `Week ${endWeek}`,
          color: c.axis,
          fontFamily: c.font,
          fontSize: 11,
          position: 'end',
        },
        data: [{ xAxis: endWeek }],
      },
    })
  }
  series.push(
    {
      name: ARMS,
      type: 'scatter',
      symbol: 'diamond',
      symbolSize: 13,
      itemStyle: { color: c.trial },
      label: armLabel,
      labelLayout: { hideOverlap: true },
      data: arms.filter((a) => !a.placebo).map(armPoint),
    },
    {
      name: PLACEBO,
      type: 'scatter',
      symbol: 'emptyCircle',
      symbolSize: 11,
      itemStyle: { color: c.placebo, borderWidth: 2 },
      label: armLabel,
      labelLayout: { hideOverlap: true },
      data: arms.filter((a) => a.placebo).map(armPoint),
    },
  )
  if (user.length) {
    series.push({
      name: YOU,
      type: 'line',
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 6,
      z: 5,
      lineStyle: { width: 2.5, color: c.logged, cap: 'round', join: 'round' },
      itemStyle: { color: c.logged },
      data: user.map((p) => [roundTo(p.weeks, 2), plot(p.change), p.change]),
    })
  }

  return {
    animationDuration: 500,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: c.font, color: c.text },
    grid: { left: 8, right: 96, top: 48, bottom: 24, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 14,
      itemHeight: 10,
      textStyle: { color: c.axis, fontFamily: c.font, fontSize: 11 },
      data: [YOU, ARMS, ...(arms.some((a) => a.placebo) ? [PLACEBO] : [])],
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.text, fontFamily: c.font },
      formatter: (p) => {
        const item = Array.isArray(p) ? p[0]! : p
        const [weeks, value] = item.value as number[]
        const shown = percent.value
          ? formatPercentChange(value!)
          : `${value! > 0 ? '+' : value! < 0 ? '−' : ''}${roundTo(Math.abs(value!), 1)} ${props.weightUnit}`
        const who = item.seriesName === YOU ? 'You' : item.name
        return `${who}<br/>Week ${roundTo(weeks!, 1)}: ${shown}`
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: maxWeek,
      interval: maxWeek > 40 ? 12 : 4,
      name: 'Weeks since first dose',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: c.axis, fontFamily: c.font, fontSize: 11 },
      axisLine: { lineStyle: { color: c.grid } },
      axisLabel: { color: c.axis },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      max: (v: { max: number }) => Math.max(1, Math.ceil(v.max)),
      axisLabel: {
        color: c.axis,
        formatter: (v: number) => `${roundTo(v, 1)}${axisUnit.value}`,
      },
      splitLine: { lineStyle: { color: c.grid } },
    },
    series,
  }
})

const ariaSummary = computed(() => {
  const { user, arms } = overlay.value
  const t = props.trial
  const parts: string[] = []
  const last = user[user.length - 1]
  parts.push(
    last && last.weeks > 0
      ? `Your change: ${fmt(last.change)} at week ${roundTo(last.weeks, 1)}.`
      : 'No change to show for you yet.',
  )
  parts.push(
    `${t.name} averages at week ${t.weeks}: ${arms.map((a) => `${a.label} ${fmt(a.change)}`).join(', ')}.`,
  )
  return parts.join(' ')
})

const tableRows = computed(() => overlay.value.user.filter((p) => p.weeks > 0).reverse())
</script>

<template>
  <div>
    <v-chart
      class="cohort-chart"
      :option="option"
      autoresize
      role="img"
      :aria-label="ariaSummary"
    />
    <v-btn
      v-if="tableRows.length"
      variant="text"
      size="small"
      class="mt-1"
      @click="showTable = !showTable"
    >
      {{ showTable ? 'Hide your weigh-ins' : 'Show your weigh-ins as a table' }}
    </v-btn>
    <v-expand-transition>
      <v-table v-if="showTable" density="compact" class="cohort-chart__table">
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col" class="text-end">Your change</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.weeks">
            <td class="tb-num">{{ roundTo(row.weeks, 1) }}</td>
            <td class="text-end tb-num">{{ fmt(row.change) }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.cohort-chart {
  width: 100%;
  height: 280px;
}

@media (min-width: 840px) {
  .cohort-chart {
    height: 320px;
  }
}

.cohort-chart__table {
  background: transparent;
}
</style>
