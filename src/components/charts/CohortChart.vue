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
  type MarkLineComponentOption,
  type TooltipComponentOption,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { CohortMeasure, CohortReadout, CohortSummary } from '@/domain/cohort'
import {
  a1cChangeIn,
  formatA1cChange,
  formatGlucoseChange,
  fromMgDl,
  type A1cUnit,
  type GlucoseUnit,
} from '@/domain/glucose'
import { formatPercentChange, formatWeightChange, roundTo } from '@/domain/units'
import { useChartColors } from '@/composables/useChartColors'

use([
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
])

/**
 * One medicine's trial readouts merged over time, with the user's own path. The shaded band is
 * the range across active arms at each week a trial reported, joined by straight lines from no
 * change at week 0; every arm stays visible as a point. Shape tells the populations apart and a
 * hollow point marks a percent derived from kilograms, so nothing rests on colour alone. Line
 * weights, markers and type follow the levels chart so the two read as one family, and the
 * user's line is labelled at its end so the eye need not go back to the legend.
 */
const props = defineProps<{
  summary: CohortSummary
  /** The user's change from their own starting value, in the measure's stored unit. */
  user: { weeks: number; change: number }[]
  measure: CohortMeasure
  a1cUnit: A1cUnit
  glucoseUnit: GlucoseUnit
}>()

const { colors } = useChartColors()
const showTable = ref(false)

/** A stored change (percent, HbA1c points, mg/dL) in the unit the axis shows. */
function toDisplay(change: number): number {
  if (props.measure === 'hba1c') return a1cChangeIn(change, props.a1cUnit)
  if (props.measure === 'fastingGlucose') return fromMgDl(change, props.glucoseUnit)
  return change
}

function fmt(change: number): string {
  if (props.measure === 'hba1c') return formatA1cChange(change, props.a1cUnit)
  if (props.measure === 'fastingGlucose') return formatGlucoseChange(change, props.glucoseUnit)
  return formatPercentChange(change)
}

/** Says what the value axis measures, above the chart where it has room on a phone. */
const axisName = computed(() => {
  if (props.measure === 'hba1c')
    return `Change in HbA1c, ${props.a1cUnit === '%' ? 'percentage points' : 'mmol/mol'}`
  if (props.measure === 'fastingGlucose') return `Change in fasting glucose, ${props.glucoseUnit}`
  return 'Change in weight, % of starting weight'
})

const YOU = 'You'
const NO_DIABETES = 'Without diabetes'
const T2D = 'With type 2 diabetes'
const PLACEBO = 'Placebo'
const RANGE = 'Range across trials'

function describe(r: CohortReadout): string {
  const printed =
    r.printedKg !== null ? `<br/>Printed as ${formatWeightChange(r.printedKg, 'kg')}` : ''
  return `${r.trialName} · ${r.armLabel}<br/>Week ${r.weeks}: ${fmt(r.change)}${printed}`
}

type Option = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | TooltipComponentOption
>

const option = computed<Option>(() => {
  const c = colors.value
  const { readouts, band } = props.summary
  const lastUser = props.user.length ? props.user[props.user.length - 1]!.weeks : 0
  const lastReadout = readouts.length ? readouts[readouts.length - 1]!.weeks : 0
  const maxWeek = Math.ceil((Math.max(lastReadout, lastUser) + 2) / 12) * 12
  const active = readouts.filter((r) => !r.placebo)
  const fontSize = 12
  // A light ring separates overlapping markers from each other and from the band.
  const ring = { borderColor: c.surface, borderWidth: 1.5 }

  const point = (r: CohortReadout) => ({
    value: [r.weeks, toDisplay(r.change)],
    name: describe(r),
    // Hollow: a percent derived from kilograms rather than printed.
    itemStyle:
      r.printedKg !== null
        ? { color: c.surface, borderColor: c.trial, borderWidth: 2 }
        : { color: c.trial, ...ring },
  })

  const series: (LineSeriesOption | ScatterSeriesOption)[] = []
  if (band.length) {
    // The low edge, then the range stacked on it; the fill between them is the band. 'all'
    // stacks a negative range on a negative edge, which same-sign stacking would split apart.
    const edge = { width: 1, color: c.trial, opacity: 0.5 }
    series.push(
      {
        name: RANGE,
        type: 'line',
        stack: 'band',
        stackStrategy: 'all',
        silent: true,
        symbol: 'none',
        lineStyle: edge,
        data: band.map((b) => [b.weeks, toDisplay(b.low)]),
      },
      {
        name: RANGE,
        type: 'line',
        stack: 'band',
        stackStrategy: 'all',
        silent: true,
        symbol: 'none',
        lineStyle: edge,
        areaStyle: { color: c.trial, opacity: 0.14 },
        data: band.map((b) => [b.weeks, toDisplay(b.high) - toDisplay(b.low)]),
      },
    )
  }
  series.push(
    {
      name: NO_DIABETES,
      type: 'scatter',
      symbol: 'diamond',
      symbolSize: 11,
      itemStyle: { color: c.trial, ...ring },
      emphasis: { scale: 1.4 },
      data: active.filter((r) => r.population === 'obesity').map(point),
    },
    {
      name: T2D,
      type: 'scatter',
      symbol: 'triangle',
      symbolSize: 11,
      itemStyle: { color: c.trial, ...ring },
      emphasis: { scale: 1.4 },
      data: active.filter((r) => r.population === 't2d').map(point),
    },
    {
      name: PLACEBO,
      type: 'scatter',
      // A filled circle in the surface colour: ECharts fills 'emptyCircle' white, even in dark.
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { color: c.surface, borderColor: c.placebo, borderWidth: 1.5 },
      emphasis: { scale: 1.4 },
      data: readouts
        .filter((r) => r.placebo)
        .map((r) => ({ value: [r.weeks, toDisplay(r.change)], name: describe(r) })),
    },
  )
  if (props.user.length > 1) {
    series.push({
      name: YOU,
      type: 'line',
      symbol: 'circle',
      symbolSize: 7,
      z: 5,
      lineStyle: { width: 2.5, color: c.logged, cap: 'round', join: 'round' },
      itemStyle: { color: c.logged, ...ring },
      endLabel: {
        show: true,
        formatter: YOU,
        color: c.logged,
        fontFamily: c.font,
        fontSize,
        fontWeight: 700,
      },
      data: props.user.map((p) => ({
        value: [roundTo(p.weeks, 2), toDisplay(p.change)],
        name: `You<br/>Week ${roundTo(p.weeks, 1)}: ${fmt(p.change)}`,
      })),
    })
  }

  // Week 0 is everyone's start, so the zero line is the reference every point is read against.
  series.push({
    name: 'Start',
    type: 'line',
    data: [],
    silent: true,
    markLine: {
      silent: true,
      symbol: 'none',
      label: { show: false },
      lineStyle: { color: c.now, type: 'dashed', width: 1 },
      data: [{ yAxis: 0 }],
    },
  })

  const legend: NonNullable<LegendComponentOption['data']> = [
    ...(props.user.length > 1 ? [YOU] : []),
    ...(active.some((r) => r.population === 'obesity') ? [NO_DIABETES] : []),
    ...(active.some((r) => r.population === 't2d') ? [T2D] : []),
    ...(readouts.some((r) => r.placebo) ? [PLACEBO] : []),
    ...(band.length
      ? [{ name: RANGE, icon: 'roundRect', itemStyle: { color: c.trial, opacity: 0.35 } }]
      : []),
  ]

  return {
    animationDuration: 600,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: c.font, color: c.text, fontSize },
    // Room for the legend to wrap onto a second row on a phone, and for the "You" end label.
    grid: {
      left: 8,
      right: props.user.length > 1 ? 40 : 16,
      top: 64,
      bottom: 28,
      containLabel: true,
    },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 18,
      itemHeight: 10,
      itemGap: 16,
      textStyle: { color: c.text, fontFamily: c.font, fontSize },
      data: legend,
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.text, fontFamily: c.font, fontSize: 12 },
      formatter: (p) => (Array.isArray(p) ? p[0]!.name : p.name),
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: maxWeek,
      interval: 12,
      name: 'Weeks since first dose',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: c.axis, fontFamily: c.font, fontSize },
      axisLine: { lineStyle: { color: c.grid } },
      axisLabel: { color: c.axis, fontSize },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      max: (v: { max: number }) => Math.max(0, Math.ceil(v.max)),
      axisLabel: {
        color: c.axis,
        fontSize,
        formatter: (v: number) => `${roundTo(v, 1)}${props.measure === 'weight' ? '%' : ''}`,
      },
      splitLine: { lineStyle: { color: c.grid } },
    },
    series,
  }
})

const ariaSummary = computed(() => {
  const { readouts, band } = props.summary
  const weeks = [...new Set(readouts.map((r) => r.weeks))]
  const last = props.user[props.user.length - 1]
  const parts = [
    last && last.weeks > 0
      ? `Your change: ${fmt(last.change)} at week ${roundTo(last.weeks, 1)}.`
      : 'No change to show for you yet.',
    `Trial readouts at week ${weeks.join(', ')}.`,
  ]
  for (const b of band.slice(1)) parts.push(`Week ${b.weeks}: ${fmt(b.high)} to ${fmt(b.low)}.`)
  return parts.join(' ')
})

const userRows = computed(() => props.user.filter((p) => p.weeks > 0))
</script>

<template>
  <div>
    <p class="text-body-small gl-muted">{{ axisName }}</p>
    <v-chart
      class="cohort-chart"
      :option="option"
      autoresize
      role="img"
      :aria-label="ariaSummary"
    />
    <v-btn variant="text" size="small" class="mt-1" @click="showTable = !showTable">
      {{ showTable ? 'Hide table' : 'Show as table' }}
    </v-btn>
    <v-expand-transition>
      <v-table v-if="showTable" density="compact" class="cohort-chart__table">
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Group</th>
            <th scope="col" class="text-end">Change</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in userRows" :key="`you-${row.weeks}`">
            <td class="gl-num">{{ roundTo(row.weeks, 1) }}</td>
            <td class="font-weight-bold">You</td>
            <td class="text-end gl-num">{{ fmt(row.change) }}</td>
          </tr>
          <tr v-for="r in summary.readouts" :key="`${r.trialId}-${r.armLabel}`">
            <td class="gl-num">{{ r.weeks }}</td>
            <td>
              {{ r.trialName }} · {{ r.armLabel }}
              <span v-if="r.printedKg !== null" class="d-block text-body-small gl-faint"
                >Printed as {{ formatWeightChange(r.printedKg, 'kg') }}</span
              >
            </td>
            <td class="text-end gl-num">{{ fmt(r.change) }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.cohort-chart {
  width: 100%;
  height: 320px;
}

@media (min-width: 840px) {
  .cohort-chart {
    height: 360px;
  }
}

.cohort-chart__table {
  background: transparent;
}
</style>
