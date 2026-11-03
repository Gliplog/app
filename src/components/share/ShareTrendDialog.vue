<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  decimalsFor,
  formatA1c,
  formatA1cChange,
  formatGlucose,
  fromA1cPercent,
  fromMgDl,
} from '@/domain/glucose'
import {
  formatPercentChange,
  formatWeight,
  formatWeightChange,
  fromKg,
  roundTo,
} from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import { valueAt } from '@/domain/photos'
import { useSettingsStore } from '@/stores/settings'
import { useBodyMetrics } from '@/composables/useBodyMetrics'
import { useChartColors } from '@/composables/useChartColors'
import { formatDate, formatDateTime, nowIso, toEpochMs } from '@/services/time'
import {
  bodyChartOption,
  levelStripInput,
  type BodyChartInput,
} from '@/components/charts/bodyChart'
import { stripScale, type StripInput } from '@/domain/levelStrip'
import { doseMarks, type DoseMarkInput } from '@/domain/doseMarks'
import ShareImageDialog from './ShareImageDialog.vue'
import type { ShareCardContent } from './shareCard'

/**
 * Share a trend (weight, BMI, HbA1c or glucose) as an image for friends. Numbers are off by
 * default: weight then shows as percent change and the other measures as change only, with no
 * axis values, so a card can be shared without revealing a weight or a lab result.
 *
 * Estimated levels can go in a strip under the line, and doses can be marked on the weight
 * line; both are off by default, since they name the medicine. The strip follows the numbers
 * choice: in mg beside a measure with its values, as percent of peak beside a change only.
 */
const props = defineProps<{
  measure: 'weight' | 'bmi' | 'a1c' | 'glucose'
  now: number
  /** Photos that can be pinned to the weight line (see TrendCard). */
  photos?: { id: string; at: number }[]
  /** The level strip's medicines and colour slots, as the app's chart has them. */
  levelInputs?: StripInput[]
  levelSlots?: ReadonlyMap<string, number>
  /** Whether each strip line's half-life is the user's own; named in the caption. */
  levelSources?: { key: string; userSupplied: boolean }[]
  /** Every logged dose, for marks on the weight line. */
  doses?: DoseMarkInput[]
}>()
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const settings = useSettingsStore()
const body = useBodyMetrics()
const { colors } = useChartColors()
const showNumbers = ref(false)
// Off by default: whoever receives the image sees the photos.
const showPhotos = ref(false)
const photosStore = usePhotosStore()
const showLevels = ref(false)
const showDoses = ref(false)
const canLevels = computed(() => (props.levelInputs?.length ?? 0) > 0)
const canDoses = computed(() => props.measure === 'weight' && (props.doses?.length ?? 0) > 0)

const byTime = <T extends { at: number }>(list: T[]) => [...list].sort((a, b) => a.at - b.at)
const madeAt = () => formatDateTime(nowIso())

/**
 * The chosen extras on a card's chart: the level strip over the same dates as its entries, in
 * mg only while the card shows values, and dose marks on the weight line.
 */
function withExtras(input: BodyChartInput, inPercent: boolean): BodyChartInput {
  const inputs = props.levelInputs ?? []
  const times = [...input.points, ...(input.secondary?.points ?? [])].map((p) => p.at)
  const levels =
    showLevels.value && inputs.length && times.length
      ? levelStripInput(
          inputs,
          props.levelSlots ?? new Map(),
          times,
          props.now,
          stripScale(inPercent, inputs.length),
        )
      : undefined
  const doses =
    showDoses.value && canDoses.value ? doseMarks(props.doses ?? [], input.points) : undefined
  return { ...input, levels, doses }
}

/** The caption's sentence on estimated levels, which carries where their half-lives came from. */
function levelsCaption(input: BodyChartInput): string {
  if (!input.levels) return ''
  const own = props.levelSources?.some((s) => s.userSupplied)
  const from = own ? 'label and your own half-lives' : 'label half-lives'
  return ` Levels estimated from ${from}.`
}

/** `hideValues` defaults to hiding the axis while numbers are off. */
function card(
  eyebrow: string,
  title: string,
  stats: [string, string][],
  base: BodyChartInput,
  caption: string,
  hideValues = !showNumbers.value,
): ShareCardContent {
  const input = withExtras(base, !showNumbers.value)
  return {
    eyebrow,
    title,
    stats,
    chart: bodyChartOption(input, colors.value, { hideValues }),
    caption: caption + levelsCaption(input),
    madeAt: madeAt(),
  }
}

function weightCard(): ShareCardContent | null {
  const base = journal.baseline
  const series = journal.progress
  const last = series[series.length - 1]
  if (!base || !last) return null
  const sinceText = formatDate(base.at)
  const weeks = base.basis === 'no-doses' ? null : roundTo(last.weeks, 0)
  const stats: [string, string][] = [['Since', sinceText]]
  if (weeks !== null) stats.push(['Weeks', String(weeks)])
  if (showNumbers.value) stats.push(['Now', formatWeight(last.kg, settings.weightUnit)])
  const points = byTime(
    journal.weights.map((w) => ({
      at: toEpochMs(w.measuredAt),
      value: showNumbers.value
        ? fromKg(w.kg, settings.weightUnit)
        : ((w.kg - base.kg) / base.kg) * 100,
    })),
  ).filter((p) => p.at >= base.at)
  const title = showNumbers.value
    ? `${formatWeightChange(last.changeKg, settings.weightUnit)} (${formatPercentChange(last.changePercent)})`
    : formatPercentChange(last.changePercent)
  // Pins sit on the line the card draws, whichever measure it is in.
  const pinned = showPhotos.value
    ? (props.photos ?? []).flatMap((p) => {
        const value = valueAt(points, p.at)
        const src = photosStore.thumbUrls[p.id]
        return value !== null && src ? [{ at: p.at, value, src }] : []
      })
    : []
  const input = withExtras(
    {
      points,
      unitLabel: showNumbers.value ? settings.weightUnit : '%',
      measure: 'Weight',
      decimals: 1,
      guides: [],
    },
    !showNumbers.value,
  )
  // Percent change keeps its axis: it reveals no weight.
  return {
    eyebrow: 'Weight',
    title,
    stats,
    chart: bodyChartOption(input, colors.value, { pinRoom: pinned.length > 0 }),
    caption:
      `Weight change since ${sinceText}, from weigh-ins` +
      (input.doses?.length ? ' and doses' : '') +
      ` logged in Gliplog.` +
      levelsCaption(input),
    madeAt: madeAt(),
    photos: pinned,
  }
}

function bmiCard(): ShareCardContent | null {
  const series = body.bmiSeries.value
  const first = series[0]
  const last = series[series.length - 1]
  if (!first || !last) return null
  const change = last.value - first.value
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  const changeText = `${sign}${roundTo(Math.abs(change), 1)}`
  return card(
    'Body mass index',
    showNumbers.value ? `BMI ${roundTo(last.value, 1)}` : `${changeText} BMI`,
    [
      ['Since', formatDate(first.at)],
      ['Change', changeText],
    ],
    { points: series, unitLabel: '', measure: 'BMI', decimals: 1, guides: [] },
    'Body mass index from weigh-ins and height logged in Gliplog.',
  )
}

function a1cCard(): ShareCardContent | null {
  const readings = byTime(
    journal.glucose
      .filter((g) => g.kind === 'a1c')
      .map((g) => ({ at: toEpochMs(g.measuredAt), value: g.value })),
  )
  const first = readings[0]
  const last = readings[readings.length - 1]
  if (!first || !last) return null
  const change = formatA1cChange(last.value - first.value, settings.a1cUnit)
  const stats: [string, string][] = [['Since', formatDate(first.at)]]
  if (showNumbers.value) stats.push(['Latest', formatA1c(last.value, settings.a1cUnit)])
  stats.push(['Results', String(readings.length)])
  return card(
    'HbA1c',
    // A single result has no change to show, so with numbers off the title names the measure.
    readings.length > 1
      ? change
      : showNumbers.value
        ? formatA1c(last.value, settings.a1cUnit)
        : 'HbA1c',
    stats,
    {
      points: readings.map((r) => ({ at: r.at, value: fromA1cPercent(r.value, settings.a1cUnit) })),
      unitLabel: settings.a1cUnit,
      measure: 'HbA1c',
      decimals: decimalsFor(settings.a1cUnit),
      guides: [],
    },
    'HbA1c results logged in Gliplog.',
  )
}

function glucoseCard(): ShareCardContent | null {
  const all = journal.glucose.filter((g) => g.kind === 'glucose')
  const fasting = byTime(
    all
      .filter((g) => g.kind === 'glucose' && g.context === 'fasting')
      .map((g) => ({ at: toEpochMs(g.measuredAt), value: g.value })),
  )
  const other = byTime(
    all
      .filter((g) => g.kind === 'glucose' && g.context !== 'fasting')
      .map((g) => ({ at: toEpochMs(g.measuredAt), value: g.value })),
  )
  const latest = fasting[fasting.length - 1]
  if (!all.length) return null
  const toPoint = (r: { at: number; value: number }) => ({
    at: r.at,
    value: fromMgDl(r.value, settings.glucoseUnit),
  })
  const stats: [string, string][] = [['Readings', String(all.length)]]
  if (showNumbers.value && latest)
    stats.unshift(['Latest fasting', formatGlucose(latest.value, settings.glucoseUnit)])
  return card(
    'Glucose',
    'Blood glucose',
    stats,
    {
      points: fasting.map(toPoint),
      secondary: other.length ? { name: 'Other times', points: other.map(toPoint) } : undefined,
      unitLabel: settings.glucoseUnit,
      measure: 'Fasting',
      decimals: decimalsFor(settings.glucoseUnit),
      guides: [],
    },
    'Glucose readings logged in Gliplog: fasting as a line, other times of day as points.',
  )
}

const content = computed<ShareCardContent | null>(() => {
  if (!open.value) return null
  switch (props.measure) {
    case 'bmi':
      return bmiCard()
    case 'a1c':
      return a1cCard()
    case 'glucose':
      return glucoseCard()
    default:
      return weightCard()
  }
})

const NAMES = { weight: 'weight', bmi: 'bmi', a1c: 'hba1c', glucose: 'glucose' } as const
</script>

<template>
  <ShareImageDialog
    v-model="open"
    title="Share as an image"
    :file-stem="`gliplog-${NAMES[measure]}`"
    :content="content"
  >
    <v-switch
      v-model="showNumbers"
      :label="measure === 'weight' ? 'Show my weight' : 'Show my numbers'"
      hide-details
    />
    <p class="text-body-small gl-muted">
      {{
        showNumbers
          ? 'The image includes your values.'
          : measure === 'weight'
            ? 'Only the percent change is shown.'
            : 'Only the change is shown, without values.'
      }}
    </p>
    <template v-if="measure === 'weight' && photos?.length">
      <v-switch v-model="showPhotos" label="Include my photos" hide-details />
      <p v-if="showPhotos" class="text-body-small gl-muted">
        Anyone you share with can see your photos.
      </p>
    </template>
    <template v-if="canDoses">
      <v-switch v-model="showDoses" label="Include my doses" hide-details />
    </template>
    <template v-if="canLevels">
      <v-switch v-model="showLevels" label="Include estimated levels" hide-details />
      <p v-if="showLevels" class="text-body-small gl-muted">
        {{
          showNumbers && (levelInputs?.length ?? 0) === 1
            ? 'Shown in mg.'
            : 'Shown as a percent of peak.'
        }}
        Includes the medicine name.
      </p>
    </template>
  </ShareImageDialog>
</template>
