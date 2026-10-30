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

/*
 * Hash history: GitHub Pages has no SPA rewrite, so a path URL reloaded offline or opened from
 * a bookmark would 404. With a hash every URL resolves to index.html.
 */
export function createAppRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes,
    // A section link ("See summary") lands below the app bar; anything else starts at the top.
    scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 72, behavior: 'smooth' } : { top: 0 }),
  })
}
