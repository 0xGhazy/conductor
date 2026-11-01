import fs from 'node:fs'
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

const reactRecommended =
  react.configs?.flat?.recommended ?? react.configs?.recommended

const reactJsxRuntime =
  react.configs?.flat?.['jsx-runtime'] ?? react.configs?.['jsx-runtime']

const commonExtends = [
  js.configs.recommended,
  reactRecommended,
  reactJsxRuntime,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
].filter(Boolean)

const baseLanguageOptions = {
  ecmaVersion: 2020,
  sourceType: 'module',
  parserOptions: { ecmaFeatures: { jsx: true } },
  globals: globals.browser,
}

const reactSettings = { react: { version: 'detect' } }

// Feature boundaries: outside a feature, import it only through its public API
// (`@/features/<name>`). Its own files may use deep paths; CSS side-effect imports are allowed.
const featureNames = fs
  .readdirSync(new URL('./src/features', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const testFiles = ['**/*.test.{ts,tsx}', 'src/test/**']

const featureBoundaryRule = (ownFeature) => [
  'error',
  {
    patterns: [
      {
        // any "@/features/<other>/<path>" that is not a .css file
        regex: `^@/features/${ownFeature ? `(?!${ownFeature}/)` : ''}[^/]+/(?!.*\\.css$)`,
        message: 'Import other features through their public API (`@/features/<name>`), not their internals.',
      },
    ],
  },
]

export default tseslint.config([
  globalIgnores(['dist', 'build', '.vite', 'coverage', 'node_modules']),

  {
    files: ['**/*.{js,jsx}'],
    extends: commonExtends,
    languageOptions: baseLanguageOptions,
    settings: reactSettings,
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [...commonExtends, tseslint.configs.recommended],
    languageOptions: baseLanguageOptions,
    settings: reactSettings,
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: testFiles,
    rules: { 'no-restricted-imports': featureBoundaryRule() },
  },

  ...featureNames.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    ignores: testFiles,
    rules: { 'no-restricted-imports': featureBoundaryRule(feature) },
  })),
])
