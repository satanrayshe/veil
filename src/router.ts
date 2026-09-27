export type Route = 'home' | 'docs' | 'shield' | 'ledger'

export const parseRoute = (): { route: Route; sample?: string } => {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?')
  const route = (['docs', 'shield', 'ledger'].includes(path) ? path : 'home') as Route
  const sample = new URLSearchParams(query ?? '').get('sample') ?? undefined
  return { route, sample }
}

export const go = (route: Route, sample?: string) => {
  location.hash = route === 'home' ? '/' : `/${route}${sample ? `?sample=${sample}` : ''}`
}
