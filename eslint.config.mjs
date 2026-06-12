import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import noXModuleImports from './eslint-rules/no-cross-module-imports.js'
import noModuleProcessEnv from './eslint-rules/no-module-process-env.js'

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'amplify/**',
      'coverage/**',
      'data/**'
    ]
  },
  js.configs.recommended,
  // Use essential rules only (no formatting enforcement)
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // Allow unused vars prefixed with _
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Vue rules
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'off'
    }
  },
  {
    // Prevent cross-module imports, API calls, and route references
    files: ['modules/*/**'],
    ignores: ['modules/**/__tests__/**'],
    plugins: {
      'org-pulse': {
        rules: {
          'no-cross-module-imports': noXModuleImports,
          'no-module-process-env': noModuleProcessEnv
        }
      }
    },
    rules: {
      'org-pulse/no-cross-module-imports': 'error'
    }
  },
  {
    // Enforce secrets system in module server code
    files: ['modules/**/server/**/*.js'],
    ignores: ['modules/**/__tests__/**'],
    rules: {
      'org-pulse/no-module-process-env': 'error'
    }
  },
  {
    // Test files can use globals like describe, it, expect
    files: ['**/__tests__/**', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    }
  }
]
