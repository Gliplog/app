import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption, ScatterSeriesOption } from 'echarts/charts'
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import type { LevelsInput, LevelsModel } from '@/domain/levels'
import { formatAmount, roundTo } from '@/domain/units'
import type { ChartColors } from '@/composables/useChartColors'

export type LevelsChartOption = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>

const LOGGED_SERIES = 'Logged doses'
const PREVIEW_SERIES = 'With this dose'

/**
 * The ECharts option for a levels chart: logged doses solid with a light fill, the previewed
 * draw dashed (identity never rests on colour alone), dose markers on the baseline and a "Now"
 * line. Colours come from the theme tokens via `c`.
 */
export function levelsOption(
  input: LevelsInput,
  model: LevelsModel,
  c: ChartColors,
): LevelsChartOption {
  const { preview, unitLabel, now } = input
  const { window, logged, projected, allDoses } = model
  const hasHistory = input.doses.length > 0
  const fontSize = 12
  const nowLine = {
    silent: true,
    symbol: 'none',
    label: { formatter: 'Now', color: c.axis, fontFamily: c.font, fontSize },
    lineStyle: { color: c.now, type: 'solid' as const, width: 1 },
    data: [{ xAxis: now }],
  }

  const series: (LineSeriesOption | ScatterSeriesOption)[] = []
  if (hasHistory) {
    series.push({
      name: LOGGED_SERIES,
      type: 'line',
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 2, color: c.logged, cap: 'round', join: 'round' },
      itemStyle: { color: c.logged },
      areaStyle: { color: c.logged, opacity: 0.1 },
      data: logged.map((p) => [p.at, p.amount]),
      markLine: nowLine,
    })
  }
  if (preview) {
    series.push({
      name: PREVIEW_SERIES,
      type: 'line',
      showSymbol: false,
      lineStyle: { width: 2, color: c.preview, type: 'dashed' },
      itemStyle: { color: c.preview },
      areaStyle: hasHistory ? undefined : { color: c.preview, opacity: 0.1 },
      data: projected.map((p) => [p.at, p.amount]),
      markLine: hasHistory ? undefined : nowLine,
    })
  }
  series.push({
    name: 'Doses',
    type: 'scatter',
    symbol: 'triangle',
    symbolSize: 10,
    itemStyle: { color: c.axis, borderColor: c.surface, borderWidth: 2 },
    tooltip: { show: false },
    data: allDoses.filter((d) => d.at >= window.start && d.at <= window.end).map((d) => [d.at, 0]),
    z: 3,
  })

  const legend = hasHistory && preview
  return {
    animation: false,
    textStyle: { fontFamily: c.font, color: c.text, fontSize },
    grid: {
      left: 8,
      right: 16,
      top: legend ? 40 : 16,
      bottom: 8,
      containLabel: true,
    },
    legend: legend
      ? {
          data: [LOGGED_SERIES, PREVIEW_SERIES],
          top: 0,
          left: 0,
          textStyle: { color: c.text, fontFamily: c.font, fontSize },
          itemWidth: 18,
          itemHeight: 8,
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: c.axis } },
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.text, fontFamily: c.font },
      valueFormatter: (v) => formatAmount(Number(v), unitLabel),
    },
    xAxis: {
      type: 'time',
      min: window.start,
      max: window.end,
      axisLine: { lineStyle: { color: c.grid } },
      axisLabel: {
        color: c.axis,
        fontSize,
        hideOverlap: true,
        formatter: {
          year: '{yyyy}',
          month: '{MMM} {d}',
          day: '{MMM} {d}',
          hour: '{HH}:{mm}',
          minute: '{HH}:{mm}',
        },
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: c.axis,
        fontSize,
        formatter: (v: number): string => `${roundTo(v, 3)} ${unitLabel}`,
      },
      splitLine: { lineStyle: { color: c.grid, type: 'solid', width: 1 } },
    },
    dataZoom: [{ type: 'inside', filterMode: 'none' }],
    series,
  }
}
