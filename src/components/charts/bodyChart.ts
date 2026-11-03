import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption, ScatterSeriesOption } from 'echarts/charts'
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import type { ChartColors } from '@/composables/useChartColors'
import { PIN } from './photoPins'
import { niceRange } from '@/domain/report'
import type { StripReading, StripSeries } from '@/domain/levelStrip'
import { roundTo } from '@/domain/units'

interface BodyPoint {
  at: number
  value: number
  /** Shown beside the value in the table, such as when in the day a glucose was taken. */
  note?: string
}

export interface BodyChartInput {
  points: BodyPoint[]
  /** Readings drawn as unjoined hollow points (glucose at other times of day). */
  secondary?: { name: string; points: BodyPoint[] }
  unitLabel: string
  /** "Weight", "BMI", "HbA1c": names the line and the table column. */
  measure: string
  decimals: number
  /** Horizontal guides such as a goal weight or BMI band edges; drawn dashed with a label. */
  guides: { value: number; label: string }[]
  /** Progress photos pinned to the line: `symbol` is the pin image, `value` the line's height. */
  photos?: { id: string; at: number; value: number; symbol: string }[]
  /** Medication levels in a strip below, on the same time axis (see `domain/levelStrip.ts`). */
  levels?: LevelStripInput
}

export interface LevelStripInput {
  window: { start: number; end: number }
  /** Each line with its colour slot, which stays with the medicine. */
  series: (StripSeries & { slot: number })[]
  /** Every line's exact level at a moment, for the readout above the strip. */
  readAt: (at: number) => StripReading[]
}

/** A dash per slot, so a level line is told apart by pattern as well as colour. */
const LEVEL_DASHES: ('solid' | number[])[] = ['solid', [10, 5], [2, 4]]

/** Names the pinned-photo series, so a click on a pin can be told apart. */
export const PHOTO_SERIES = 'Photos'

export type BodyChartOption = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
>

/**
 * The ECharts option for a body measure over time, shared by the in-app chart and the share
 * image. `hideValues` drops the value axis labels, for an image that shows the shape only;
 * `pinRoom` leaves space above the plot for photo pins drawn over it.
 */
export function bodyChartOption(
  props: BodyChartInput,
  c: ChartColors,
  options: { hideValues?: boolean; pinRoom?: boolean } = {},
): BodyChartOption {
  const base = measureOption(props, c, options)
  return props.levels ? withLevelStrip(base, props, c) : base
}

function measureOption(
  props: BodyChartInput,
  c: ChartColors,
  options: { hideValues?: boolean; pinRoom?: boolean },
): BodyChartOption {
  const fmt = (v: number) => `${roundTo(v, props.decimals)} ${props.unitLabel}`.trim()
  const extra = props.secondary?.points ?? []
  const values = [...props.points, ...extra].map((p) => p.value)
  const all = [...values, ...props.guides.map((g) => g.value)]
  const min = Math.min(...all)
  const max = Math.max(...all)
  // Round ticks with a little room either side, so the first and last labels never collide.
  const pad = Math.max((max - min) * 0.1, 0.5)
  const ticks = niceRange(min - pad, max + pad, 5)
  return {
    animation: false,
    textStyle: { fontFamily: c.font, color: c.text },
    // Pins stand above their point, so the plot leaves room for the tallest one.
    grid: {
      left: 8,
      right: 16,
      top: (extra.length ? 36 : 16) + (props.photos?.length || options.pinRoom ? PIN.height : 0),
      bottom: 8,
      containLabel: true,
    },
    legend: extra.length
      ? {
          top: 0,
          left: 0,
          itemWidth: 14,
          itemHeight: 10,
          textStyle: { color: c.axis, fontFamily: c.font, fontSize: 11 },
          data: [props.measure, props.secondary!.name],
        }
      : undefined,
    // Unjoined points have no axis position to snap to, so a chart with them reads per point.
    tooltip: {
      trigger: extra.length ? 'item' : 'axis',
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
      min: ticks[0],
      max: ticks[ticks.length - 1],
      interval: ticks[1]! - ticks[0]!,
      axisLabel: {
        show: !options.hideValues,
        color: c.axis,
        formatter: (v: number) => `${roundTo(v, 2)}${props.unitLabel === '%' ? '%' : ''}`,
      },
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
      ...(extra.length
        ? [
            {
              name: props.secondary!.name,
              type: 'scatter' as const,
              symbol: 'emptyCircle',
              symbolSize: 8,
              itemStyle: { color: c.preview, borderWidth: 2 },
              data: extra.map((p) => [p.at, p.value]),
            },
          ]
        : []),
      // The pin's tip, at the bottom centre of its image, sits on the line.
      ...(props.photos?.length
        ? [
            {
              name: PHOTO_SERIES,
              type: 'scatter' as const,
              z: 10,
              cursor: 'pointer',
              tooltip: { show: false },
              symbolSize: [PIN.width, PIN.height],
              symbolOffset: [0, '-50%'],
              data: props.photos.map((p) => ({
                value: [p.at, p.value],
                symbol: `image://${p.symbol}`,
                id: p.id,
              })),
            },
          ]
        : []),
    ],
  }
}

const levelText = (r: StripReading) =>
  `${r.label}: ${roundTo(r.percent, 0)}% of peak · ${roundTo(r.mg, 2)} mg`

/**
 * Adds the level strip as a second panel under the measure: its own grid and 0 to 100% axis,
 * an x-axis locked to the measure's, one zoom for both and a crosshair across both. The readout
 * gives the measure and every level at the same moment.
 */
function withLevelStrip(
  base: BodyChartOption,
  props: BodyChartInput,
  c: ChartColors,
): BodyChartOption {
  const levels = props.levels!
  const fmt = (v: number) => `${roundTo(v, props.decimals)} ${props.unitLabel}`.trim()
  const top = base.grid as GridComponentOption
  const measureX = base.xAxis as Record<string, unknown>
  const { min, max } = { min: levels.window.start, max: levels.window.end }
  const levelNames = new Set(levels.series.map((s) => s.label))
  const lines: LineSeriesOption[] = levels.series.map((s) => {
    const color = c.levels[s.slot] ?? c.preview
    return {
      name: s.label,
      type: 'line',
      xAxisIndex: 1,
      yAxisIndex: 1,
      // No symbol, so the legend draws each line in its own dash pattern.
      symbol: 'none',
      lineStyle: { width: 2, color, type: LEVEL_DASHES[s.slot], cap: 'round', join: 'round' },
      itemStyle: { color },
      data: s.points.map(([at, percent]) => [at, percent]),
    }
  })
  const baseLegend = base.legend as LegendComponentOption | undefined
  return {
    ...base,
    grid: [
      { ...top, bottom: '42%' },
      { left: 8, right: 16, top: '68%', bottom: 8, containLabel: true },
    ],
    legend: [
      ...(baseLegend ? [baseLegend] : []),
      {
        top: '60%',
        left: 0,
        itemWidth: 28,
        itemHeight: 10,
        textStyle: { color: c.axis, fontFamily: c.font, fontSize: 11 },
        data: levels.series.map((s) => s.label),
      },
    ],
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    tooltip: {
      trigger: 'axis',
      // The readout is several lines; keep it on the chart at either edge of a phone screen.
      confine: true,
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.text, fontFamily: c.font },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params]
        const at = Number((list[0]?.value as [number, number] | undefined)?.[0])
        const measure = list
          .filter((p) => !levelNames.has(p.seriesName ?? '') && p.seriesName !== PHOTO_SERIES)
          .map((p) => `${p.marker}${p.seriesName}: ${fmt((p.value as [number, number])[1])}`)
        const readings = Number.isFinite(at) ? levels.readAt(at).map(levelText) : []
        return [...measure, ...readings].join('<br>')
      },
    },
    xAxis: [
      { ...measureX, min, max, axisLabel: { show: false } },
      { ...measureX, gridIndex: 1, min, max },
    ],
    yAxis: [
      base.yAxis as Record<string, unknown>,
      {
        type: 'value',
        gridIndex: 1,
        min: 0,
        max: 100,
        interval: 50,
        axisLabel: { color: c.axis, formatter: '{value}%' },
        splitLine: { lineStyle: { color: c.grid } },
      },
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], filterMode: 'none' }],
    series: [...(base.series as (LineSeriesOption | ScatterSeriesOption)[]), ...lines],
  } as BodyChartOption
}
