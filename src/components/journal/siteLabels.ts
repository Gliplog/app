import type { InjectionSite } from '@/db/database'

/** Plain words for each injection site, shared by the dose dialog and the history list. */
export const SITE_LABELS: Record<InjectionSite, string> = {
  'abdomen-left': 'Belly, left',
  'abdomen-right': 'Belly, right',
  'thigh-left': 'Thigh, left',
  'thigh-right': 'Thigh, right',
  'arm-left': 'Arm, left',
  'arm-right': 'Arm, right',
}
