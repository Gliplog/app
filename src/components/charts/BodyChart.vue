<script setup lang="ts">
import { computed } from 'vue'
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
import { formatDose, roundTo } from '@/domain/units'
import { bodyChartOption, PHOTO_SERIES, type BodyChartInput } from './bodyChart'

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
 * One measure over time (weight, BMI, HbA1c, glucose, blood pressure or heart rate) with
 * optional labelled reference lines. A secondary set is drawn as unjoined hollow points (glucose
 * at other times of day, never joined into one line with fasting readings) or as a dashed line
 * (diastolic beside systolic blood pressure). Doses can be
 * marked on the line, and estimated levels drawn in a strip below on the same dates.
 */
const props = defineProps<BodyChartInput>()
const emit = defineEmits<{ photo: [id: string] }>()

function onClick(event: { seriesName?: string; data?: unknown }) {
  const id = (event.data as { id?: unknown } | undefined)?.id
  if (event.seriesName === PHOTO_SERIES && typeof id === 'string') emit('photo', id)
}

const { colors } = useChartColors()

const fmt = (v: number) => `${roundTo(v, props.decimals)} ${props.unitLabel}`.trim()

const option = computed(() => bodyChartOption(props, colors.value))

const ariaSummary = computed(() => {
  const pts = props.points
  if (!pts.length) return `${props.measure}: no entries yet.`
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const second = props.secondary?.joined ? props.secondary.points : []
  const secondary = second.length
    ? ` ${props.secondary!.name} from ${fmt(second[0]!.value)} to ${fmt(second[second.length - 1]!.value)}.`
    : ''
  const photos = props.photos?.length
    ? ` ${props.photos.length} progress photo${props.photos.length === 1 ? '' : 's'} pinned to the line.`
    : ''
  const doses = props.doses?.length
    ? ` ${props.doses.length} dose${props.doses.length === 1 ? '' : 's'} marked on the line; strength by date: ${props.doses
        .filter((d) => d.changed)
        .map((d) => `${formatDate(d.at)} ${d.label} ${formatDose(d.mg)}`)
        .join(', ')}.`
    : ''
  const levels = props.levels
    ? props.levels.scale === 'amount'
      ? ` Estimated amount in the body below, at the latest entry: ${props.levels
          .readAt(last.at)
          .map((r) => `${r.label} ${formatDose(r.mg)}`)
          .join(', ')}.`
      : ` Estimated levels below, each scaled to its own peak, at the latest entry: ${props.levels
          .readAt(last.at)
          .map((r) => `${r.label} ${roundTo(r.percent, 0)}%`)
          .join(', ')}.`
    : ''
  return `${props.measure} from ${fmt(first.value)} to ${fmt(last.value)}, ${formatDateRange(first.at, last.at)}, ${pts.length} entries.${secondary}${photos}${doses}${levels}`
})
</script>

<template>
  <div>
    <v-chart
      :class="['body-chart', { 'body-chart--levels': levels }]"
      :option="option"
      autoresize
      role="img"
      :aria-label="ariaSummary"
      @click="onClick"
    />
  </div>
</template>

<style scoped>
.body-chart {
  width: 100%;
  height: 260px;
}

.body-chart--levels {
  height: 380px;
}

@media (min-width: 840px) {
  .body-chart {
    height: 320px;
  }

  .body-chart--levels {
    height: 440px;
  }
}
</style>
