import typography from '@tailwindcss/typography'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Resolve module paths for Tailwind content scanning.
 * Uses fs.realpathSync to follow symlinks so fast-glob can traverse them.
 */
function getResolvedModulePaths(projectRoot) {
  const modulesDir = path.join(projectRoot, 'modules')
  if (!fs.existsSync(modulesDir)) return []
  return fs.readdirSync(modulesDir)
    .filter(mod => {
      const modPath = path.join(modulesDir, mod)
      try { return fs.statSync(modPath).isDirectory() } catch { return false }
    })
    .map(mod => {
      const modPath = path.join(modulesDir, mod)
      const realPath = fs.realpathSync(modPath)
      return path.join(realPath, 'client/**/*.{vue,js}')
    })
}

/**
 * Create a Tailwind config for Org Pulse.
 *
 * Resolves content paths to real filesystem paths so fast-glob
 * can traverse symlinked modules and core code in node_modules.
 *
 * @param {{ root?: string, additionalContent?: string[] }} options
 */
export function createTailwindConfig(options = {}) {
  const coreDir = __dirname
  const projectRoot = options.root || coreDir

  const content = [
    path.resolve(projectRoot, 'index.html'),
    path.resolve(coreDir, 'src/**/*.{vue,js}'),
    path.resolve(coreDir, 'shared/client/**/*.{vue,js}'),
    ...getResolvedModulePaths(projectRoot),
    path.resolve(projectRoot, 'platform/**/*.{vue,js,json}'),
    ...(options.additionalContent || []),
  ]

  return {
    darkMode: 'class',
    content,
    safelist: [
      // Dynamic allocation category colors (used via template literals in AllocationBar, BucketBreakdown, AllocationTeamCard)
      { pattern: /bg-(amber|blue|green|gray|red|purple|indigo|cyan|teal|orange|pink|yellow|lime|emerald|sky|violet|fuchsia|rose)-400/ },
      { pattern: /text-(amber|blue|green|gray|red|purple|indigo|cyan|teal|orange|pink|yellow|lime|emerald|sky|violet|fuchsia|rose)-900/ },
      { pattern: /border-l-(amber|blue|green|gray|red|purple|indigo|cyan|teal|orange|pink|yellow|lime|emerald|sky|violet|fuchsia|rose)-400/ },
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
          },
        },
      },
    },
    plugins: [
      typography,
    ],
  }
}

/** @type {import('tailwindcss').Config} */
export default createTailwindConfig()
