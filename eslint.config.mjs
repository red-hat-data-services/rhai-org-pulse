import { createRequire } from 'module'
import { createEslintConfig } from '@org-pulse/core/eslint';

const require = createRequire(import.meta.url)
const noModuleProcessEnv = require('./eslint-rules/no-module-process-env.js')

export default createEslintConfig({
  additionalConfigs: [
    {
      // Override no-module-process-env with AI Eng extended ALLOWED set
      files: ['modules/**/server/**/*.js'],
      ignores: ['modules/**/__tests__/**'],
      plugins: {
        'org-pulse-ai-eng': {
          rules: {
            'no-module-process-env': noModuleProcessEnv
          }
        }
      },
      rules: {
        'org-pulse/no-module-process-env': 'off',
        'org-pulse-ai-eng/no-module-process-env': 'error'
      }
    }
  ]
});
