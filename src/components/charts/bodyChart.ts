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
import {
  amountTicks,
  levelStrip,
  stripReadings,
  stripWindow,
  type StripInput,
  type StripReading,
  type StripScale,
  type StripSeries,
} from '@/domain/levelStrip'
import type { DoseMark } from '@/domain/doseMarks'
import { formatDose, roundTo } from '@/domain/units'

interface BodyPoint {
  at: number
  value: number
  /** Shown beside the value in the table, such as when in the day a glucose was taken. */
  note?: string
}

export interface BodyChartInput {
  points: BodyPoint[]
  /**
   * A second set of readings. Unjoined hollow points by default (glucose at other times of
   * day); `joined` draws a dashed line with hollow points instead (diastolic blood pressure).
   */
  secondary?: { name: string; points: BodyPoint[]; joined?: boolean }
  unitLabel: string
  /** "Weight", "BMI", "HbA1c": names the line and the table column. */
  measure: string
  decimals: number
  /** Horizontal guides such as a goal weight or BMI band edges; drawn dashed with a label. */
  guides: { value: number; label: string }[]
  /** Progress photos pinned to the line: `symbol` is the pin image, `value` the line's height. */
  photos?: { id: string; at: number; value: number; symbol: string }[]
  /** Doses marked on the line; a change of strength carries a label (see `domain/doseMarks.ts`). */
  doses?: DoseMark[]
  /** Medication levels in a strip below, on the same time axis (see `domain/levelStrip.ts`). */
  levels?: LevelStripInput
}

export interface LevelStripInput {
  window: { start: number; end: number }
  /** Each line with its colour slot, which stays with the medicine. */
  series: (StripSeries & { slot: number })[]
  /** Every line's exact level at a moment, for the readout above the strip. */
  readAt: (at: number) => StripReading[]
  /** Whether the strip's axis is in mg or percent of each line's own peak. */
  scale: StripScale
}

/**
 * The level strip for a chart whose entries fall at `times`: one window for every line, from
 * the first entry to now, so the strip and the measure share their dates.
 */
export function levelStripInput(
  inputs: readonly StripInput[],
  slots: ReadonlyMap<string, number>,
  times: readonly number[],
  now: number,
  scale: StripScale,
): LevelStripInput {
  const window = stripWindow(times, now)
  const series = levelStrip(inputs, window)
  return {
    window,
    series: series.map((s) => ({ ...s, slot: slots.get(s.key) ?? 0 })),
    readAt: (at: number) => stripReadings(inputs, series, at),
    scale,
  }
}

/** A dash per slot, so a level line is told apart by pattern as well as colour. */
const LEVEL_DASHES: ('solid' | number[])[] = ['solid', [10, 5], [2, 4]]

/** Names the pinned-photo series, so a click on a pin can be told apart. */
export const PHOTO_SERIES = 'Photos'

/** Names the dose-mark series, which the readout describes on its own line. */
const DOSE_SERIES = 'Doses'

/** A small upright needle-like diamond, told apart from the line's round points by shape. */
const DOSE_SYMBOL = 'path://M5 0 L10 7 L5 14 L0 7 Z'

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
  const joined = !!props.secondary?.joined
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
      top:
        (extra.length ? 36 : 16) +
        (props.photos?.length || options.pinRoom ? PIN.height : props.doses?.length ? 16 : 0),
      bottom: 8,
      containLabel: true,
    },
    legend: extra.length
      ? {
          top: 0,
          left: 0,
          itemGap: 20,
          // Wide enough to show a joined second line's dashes.
          itemWidth: joined ? 28 : 14,
          itemHeight: 10,
          textStyle: { color: c.axis, fontFamily: c.font, fontSize: 11 },
          data: [props.measure, props.secondary!.name],
        }
      : undefined,
    // Unjoined points have no axis position to snap to, so a chart with them reads per point.
    tooltip: {
      trigger: extra.length && !joined ? 'item' : 'axis',
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.text, fontFamily: c.font },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params]
        return list
          .filter((p) => p.seriesName !== PHOTO_SERIES)
          .map((p) =>
            p.seriesName === DOSE_SERIES
              ? doseText(p.data as DoseDatum)
              : `${p.marker}${p.seriesName}: ${fmt((p.value as [number, number])[1])}`,
          )
          .join('<br>')
      },
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
        // With doses marked, the diamonds carry the line; round points as well would crowd it.
        showSymbol: props.points.length < 40 && !props.doses?.length,
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
      ...(extra.length && joined
        ? [
            {
              name: props.secondary!.name,
              type: 'line' as const,
              symbol: 'emptyCircle',
              showSymbol: extra.length < 40,
              symbolSize: 6,
              lineStyle: {
                width: 2,
                color: c.preview,
                type: 'dashed' as const,
                cap: 'round' as const,
              },
              itemStyle: { color: c.preview, borderWidth: 2 },
              data: extra.map((p) => [p.at, p.value]),
            },
          ]
        : extra.length
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
      ...(props.doses?.length ? [doseSeries(props.doses, c)] : []),
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

interface DoseDatum {
  value: [number, number]
  name: string
  mg: number
  /** What is written above the mark, when anything is. */
  text: string
}

const doseText = (d: DoseDatum) => `${d.name}: ${formatDose(d.mg)} dose`

/**
 * Every dose as a small mark on the line, above the line's own points but below photo pins.
 * The strength is written above a mark only where it changes, so the labels stay legible. With
 * more than one medicine, each one's first mark also names it, so a switch between medicines
 * never reads as a change of strength (their mg are not comparable).
 */
function doseSeries(doses: DoseMark[], c: ChartColors): ScatterSeriesOption {
  const named = new Set(doses.map((d) => d.key)).size > 1
  return {
    name: DOSE_SERIES,
    type: 'scatter',
    z: 5,
    symbol: DOSE_SYMBOL,
    symbolSize: [7, 10],
    itemStyle: { color: c.now, borderColor: c.surface, borderWidth: 1 },
    // Labels start at their mark and read rightward, clear of the value axis on the left.
    label: {
      position: 'top',
      align: 'left',
      offset: [-4, 0],
      distance: 4,
      color: c.axis,
      fontFamily: c.font,
      fontSize: 10,
      formatter: (p) => (p.data as DoseDatum).text,
    },
    labelLayout: { hideOverlap: true },
    data: doses.map((d) => ({
      value: [d.at, d.value] as [number, number],
      name: d.label,
      mg: d.mg,
      text: named && d.first ? `${d.label} ${formatDose(d.mg)}` : formatDose(d.mg),
      label: { show: d.changed },
    })),
  }
}

const levelText = (r: StripReading, scale: StripScale) =>
  scale === 'amount'
    ? `${r.label}: ${formatDose(r.mg)} · ${roundTo(r.percent, 0)}% of peak`
    : `${r.label}: ${roundTo(r.percent, 0)}% of peak · ${formatDose(r.mg)}`

/**
 * Adds the level strip as a second panel under the measure: its own grid and axis (mg from
 * zero, or 0 to 100% of each line's peak),
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
      data: s.points.map(([at, percent, mg]) => [at, levels.scale === 'amount' ? mg : percent]),
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
        itemGap: 20,
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
          .map((p) =>
            p.seriesName === DOSE_SERIES
              ? doseText(p.data as DoseDatum)
              : `${p.marker}${p.seriesName}: ${fmt((p.value as [number, number])[1])}`,
          )
        const readings = Number.isFinite(at)
          ? levels.readAt(at).map((r) => levelText(r, levels.scale))
          : []
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
        ...levelAxis(levels, c),
        splitLine: { lineStyle: { color: c.grid } },
      },
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], filterMode: 'none' }],
    series: [...(base.series as (LineSeriesOption | ScatterSeriesOption)[]), ...lines],
  } as BodyChartOption
}

/** The strip's value axis: round mg from zero, or 0 to 100% of each line's peak. */
function levelAxis(levels: LevelStripInput, c: ChartColors) {
  if (levels.scale === 'percent') {
    return { min: 0, max: 100, interval: 50, axisLabel: { color: c.axis, formatter: '{value}%' } }
  }
  const ticks = amountTicks(levels.series)
  return {
    min: ticks[0],
    max: ticks[ticks.length - 1],
    interval: ticks[1]! - ticks[0]!,
    axisLabel: { color: c.axis, formatter: (v: number) => `${roundTo(v, 2)} mg` },
  }
}
