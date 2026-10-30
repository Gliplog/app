<script setup lang="ts">
import { computed, ref } from 'vue'
import { levelsModel, type LevelsInput } from '@/domain/levels'
import { formatAmount } from '@/domain/units'
import { useChartColors } from '@/composables/useChartColors'
import { formatDateTime, formatHours, formatShort, nowIso } from '@/services/time'
import { levelsOption } from '@/components/charts/levelsChart'
import ShareImageDialog from './ShareImageDialog.vue'
import type { ShareCardContent } from './shareCard'

/**
 * Share the estimated-levels curve as an image. The medicine's name and the amounts can be
 * left off; the half-life stays in the caption because every figure carries its source.
 */
const props = defineProps<{
  input: LevelsInput
  /** "Semaglutide injection", shown unless the user hides it. */
  name: string
  /** Where the half-life came from: "the prescribing label" or "your own values". */
  sourceText: string
}>()
const open = defineModel<boolean>({ required: true })

const { colors } = useChartColors()
const showName = ref(true)
const showAmounts = ref(true)

const content = computed<ShareCardContent | null>(() => {
  if (!open.value) return null
  const model = levelsModel(props.input)
  const { summary } = model
  const unit = props.input.unitLabel
  const stats: [string, string][] = []
  if (showAmounts.value) stats.push(['Now', formatAmount(summary.now, unit)])
  if (summary.peak) {
    stats.push([
      'Peak',
      showAmounts.value ? formatAmount(summary.peak.amount, unit) : formatShort(summary.peak.at),
    ])
  }
  if (summary.clearsAt) stats.push(['Below 10% of peak', formatShort(summary.clearsAt)])
  const option = levelsOption(props.input, model, colors.value)
  if (!showAmounts.value && option.yAxis && !Array.isArray(option.yAxis)) {
    option.yAxis = { ...option.yAxis, axisLabel: { show: false } }
  }
  const halfLife = formatHours(props.input.params.halfLifeHours)
  return {
    eyebrow: 'Estimated levels',
    title: showName.value ? props.name : 'My estimated levels',
    stats,
    chart: option,
    caption:
      `Estimated amount in the body from logged doses, using a simple model with a half-life ` +
      `of ${halfLife} from ${props.sourceText}. Not a blood test.`,
    madeAt: formatDateTime(nowIso()),
  }
})
</script>

<template>
  <ShareImageDialog
    v-model="open"
    title="Share estimated levels"
    file-stem="gliplog-levels"
    :content="content"
  >
    <v-switch v-model="showName" label="Show medicine name" hide-details />
    <v-switch v-model="showAmounts" label="Show amounts" hide-details />
  </ShareImageDialog>
</template>
