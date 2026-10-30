import { onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'

export interface ChartColors {
  logged: string
  preview: string
  trial: string
  placebo: string
  grid: string
  axis: string
  now: string
  text: string
  surface: string
  font: string
}

function readColors(): ChartColors {
  const root = document.querySelector('.v-application') ?? document.documentElement
  const style = getComputedStyle(root)
  const read = (name: string) => style.getPropertyValue(name).trim()
  return {
    logged: read('--tb-chart-logged'),
    preview: read('--tb-chart-preview'),
    trial: read('--tb-chart-trial'),
    placebo: read('--tb-chart-placebo'),
    grid: read('--tb-chart-grid'),
    axis: read('--tb-chart-axis'),
    now: read('--tb-chart-now'),
    text: read('--tb-text-1'),
    surface: read('--tb-surface'),
    font: read('--tb-font'),
  }
}

/**
 * Chart colours resolved from the active theme's CSS tokens, so ECharts (which paints to a
 * canvas and cannot read CSS variables) follows light and dark mode. Re-read after the DOM
 * update that swaps the theme class.
 */
export function useChartColors() {
  const theme = useTheme()
  const colors = ref<ChartColors>(readColors())
  const update = () => {
    colors.value = readColors()
  }
  watch(() => theme.global.name.value, update, { flush: 'post' })
  onMounted(update)
  return { colors }
}
