import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

/*
 * Vuetify's built-in `light` and `dark` themes are overridden with the Tidebook palette so the
 * `system` default follows the device's colour scheme. The user can pin one in Settings.
 * Colours mirror the semantic tokens in styles/tokens.css.
 */
export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: {
    defaultTheme: 'system',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#fbf8f3',
          surface: '#fffdf9',
          'surface-variant': '#f4ede2',
          'on-surface-variant': '#5f5544',
          primary: '#2d6567',
          secondary: '#c8704f',
          error: '#bc5740',
          warning: '#c98a2e',
          success: '#2f8f5b',
          info: '#4e7a8c',
          'on-background': '#1d1a14',
          'on-surface': '#1d1a14',
        },
      },
      dark: {
        dark: true,
        colors: {
          background: '#15120e',
          surface: '#221e18',
          'surface-variant': '#2c2820',
          'on-surface-variant': '#d6c7af',
          primary: '#74c3bd',
          secondary: '#dc8d6b',
          error: '#e08a74',
          warning: '#e0ac5a',
          success: '#66c58f',
          info: '#8fb4c4',
          'on-background': '#f4ede2',
          'on-surface': '#f4ede2',
          // Dark text on the light teal and terracotta fills keeps buttons above 4.5:1.
          'on-primary': '#15120e',
          'on-secondary': '#15120e',
        },
      },
    },
  },
  defaults: {
    // hideDetails 'auto': the message row exists only when there is a hint or error to show,
    // so spacing between fields comes from the container (.tb-stack), never from empty rows.
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
    },
    VSelect: { variant: 'outlined', density: 'comfortable', color: 'primary', hideDetails: 'auto' },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
      rows: 2,
      autoGrow: true,
    },
    VSwitch: { color: 'primary', inset: true },
    VCheckbox: { color: 'primary' },
    VRadioGroup: { color: 'primary' },
    VChip: { variant: 'tonal' },
    VBtnToggle: { color: 'primary', variant: 'outlined', divided: true },
  },
})
