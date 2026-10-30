import 'vuetify/styles'
import '@/plugins/fonts'
import '@/styles/tokens.css'
import '@/styles/theme.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import { createAppRouter } from './router'

const router = createAppRouter()
createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')

// A tapped dose reminder opens Today's Log dose for that medication (see TodayView).
if (__NATIVE__) {
  void import('@/services/reminders/nativeReminders').then(({ onReminderTap }) =>
    onReminderTap(
      (medicationId) => void router.push({ name: 'today', query: { log: medicationId } }),
    ),
  )
}
