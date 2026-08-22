var PRODUCT_COLORS = {
  rhoai: { bg: 'bg-violet-50 dark:bg-violet-900/15', border: 'border-l-violet-500', badge: 'bg-violet-100 dark:bg-violet-800/40 text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  rhelai: { bg: 'bg-emerald-50 dark:bg-emerald-900/15', border: 'border-l-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  rhaii: { bg: 'bg-pink-50 dark:bg-pink-900/15', border: 'border-l-pink-500', badge: 'bg-pink-100 dark:bg-pink-800/40 text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
  rhai: { bg: 'bg-amber-50 dark:bg-amber-900/15', border: 'border-l-amber-500', badge: 'bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' }
}

var DEFAULT_COLORS = { bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-l-gray-400', badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', dot: 'bg-gray-400' }

var PRODUCT_HEX = {
  rhoai: '#8b5cf6',
  rhelai: '#10b981',
  rhaii: '#f472b6',
  rhai: '#f59e0b'
}
var DEFAULT_HEX = '#9ca3af'

function productColors(product) {
  return PRODUCT_COLORS[product] || DEFAULT_COLORS
}

export { PRODUCT_COLORS, DEFAULT_COLORS, PRODUCT_HEX, DEFAULT_HEX, productColors }
