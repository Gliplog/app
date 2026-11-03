import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'today',
    component: () => import('@/views/TodayView.vue'),
    meta: { title: 'Today' },
  },
  {
    path: '/progress',
    name: 'progress',
    component: () => import('@/views/ProgressView.vue'),
    meta: { title: 'Progress' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: 'History' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

// Measured rather than fixed: in the Android app the bar also covers the status bar inset.
function appBarHeight(): number {
  return document.querySelector<HTMLElement>('.v-app-bar')?.offsetHeight ?? 48
}

/*
 * Hash history: GitHub Pages has no SPA rewrite, so a path URL reloaded offline or opened from
 * a bookmark would 404. With a hash every URL resolves to index.html.
 */
export function createAppRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes,
    // A section link ("See summary") lands below the app bar and any status bar inset above it.
    scrollBehavior: (to) =>
      to.hash ? { el: to.hash, top: appBarHeight() + 24, behavior: 'smooth' } : { top: 0 },
  })
}
