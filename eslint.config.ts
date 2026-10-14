/**
 * @file Lint policy. The layer rules mirror docs/ARCHITECTURE.md; change both together.
 * Messages are written for whoever has to fix them, human or agent.
 */
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import js from '@eslint/js'
import functional from 'eslint-plugin-functional'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import { localPlugin } from './tools/eslint-rules/index.ts'

const IMPURE_GLOBALS = ['process', 'Date', 'setTimeout', 'setInterval']

const noGlobals = (names: readonly string[], why: string) =>
  names.map((name) => ({ name, message: `${name} is impure. ${why}` }))

const ban = (group: readonly string[], why: string, allowTypeImports = false) => ({
  group: [...group],
  message: why,
  allowTypeImports,
})

const NO_NODE_BUILTINS = ban(
  ['node:*', 'fs', 'path', 'child_process', 'net', 'os', 'crypto'],
  'The functional core does no I/O. Put it in src/infra and pass the result in.',
)

const SRC_ONLY = ban(
  ['**/tools/**', '**/test/**'],
  'src/ is the app; it must not import tooling or tests.',
)

const ENTRY_POINTS = ['../cli.ts']

const layer = (
  files: string,
  groups: readonly ReturnType<typeof ban>[],
  pure: boolean,
): Linter.Config => ({
  files: [files],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      { patterns: [SRC_ONLY, ...(pure ? [NO_NODE_BUILTINS] : []), ...groups] },
    ],
    'no-restricted-globals': pure
      ? [
          'error',
          ...noGlobals(
            IMPURE_GLOBALS,
            'The shell in src/infra or src/app reads it and passes it in.',
          ),
        ]
      : 'off',
  },
})

const CORE = [
  'src/shared/**/*.ts',
  'src/domain/**/*.ts',
  'src/views/**/*.ts',
  'src/adapters/**/*.ts',
]

const SHELL = ['src/infra/**/*.ts', 'src/app/**/*.ts', 'src/*.ts']

export default defineConfig(
  { ignores: ['node_modules/', 'coverage/', 'dist/', '**/*.js', '**/*.mjs'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { local: localPlugin },
    rules: {
      'local/comment-density': 'error',
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@eslint-community/eslint-comments/disable-enable-pair': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { minimumDescriptionLength: 10 }],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'start' },
      ],
      eqeqeq: 'error',
      'no-param-reassign': ['error', { props: true }],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },

  // Layers: shared <- domain <- views; adapters -> domain/shared; infra -> core; app -> all.
  layer(
    'src/shared/**/*.ts',
    [
      ban(
        ['**/domain/**', '**/views/**', '**/adapters/**', '**/infra/**', '**/app/**'],
        'shared/ is the bottom layer; it imports nothing from src/.',
      ),
    ],
    true,
  ),
  layer(
    'src/domain/**/*.ts',
    [
      ban(
        ['**/views/**', '**/adapters/**', '**/infra/**', '**/app/**'],
        'domain/ may import shared/ only. Presentation goes in views/, parsing in adapters/.',
      ),
    ],
    true,
  ),
  layer(
    'src/views/**/*.ts',
    [
      ban(
        ['**/adapters/**', '**/infra/**', '**/app/**'],
        'views/ may import domain/ types and shared/ only.',
      ),
      ban(['**/domain/**'], 'views/ may import domain/ types only; use `import type`.', true),
    ],
    true,
  ),
  layer(
    'src/adapters/**/*.ts',
    [
      ban(
        ['**/views/**', '**/infra/**', '**/app/**'],
        'adapters/ turn raw input into domain types; they import domain/ and shared/ only.',
      ),
    ],
    true,
  ),
  layer(
    'src/infra/**/*.ts',
    [
      ban(
        ['**/views/**', '**/app/**', ...ENTRY_POINTS],
        'infra/ does one kind of I/O each; orchestration belongs in app/.',
      ),
    ],
    false,
  ),
  layer(
    'src/app/**/*.ts',
    [ban(ENTRY_POINTS, 'app/ must not import the entry points; they import app/.')],
    false,
  ),

  // Functional core, imperative shell.
  {
    files: CORE,
    extends: [functional.configs.externalTypeScriptRecommended, functional.configs.recommended],
    rules: {
      'functional/no-let': 'error',
      'functional/no-loop-statements': 'error',
      'functional/no-throw-statements': 'error',
      'functional/no-try-statements': 'error',
      'functional/no-classes': 'error',
      'functional/immutable-data': 'error',
      'functional/functional-parameters': ['error', { enforceParameterCount: false }],
      'functional/prefer-immutable-types': 'off',
      'functional/type-declaration-immutability': 'off',
      'functional/no-conditional-statements': 'off',
      'functional/no-mixed-types': 'off',
    },
  },
  {
    files: SHELL,
    extends: [functional.configs.externalTypeScriptRecommended, functional.configs.lite],
    rules: {
      'functional/functional-parameters': 'off',
      'functional/no-throw-statements': 'off',
      'functional/prefer-immutable-types': 'off',
      'functional/type-declaration-immutability': 'off',
      'functional/no-conditional-statements': 'off',
      // Dependency-injection records (Store, CliDeps) are data and functions by design.
      'functional/no-mixed-types': 'off',
      // Node's callback APIs take void callbacks; declared `: void` returns are still errors.
      'functional/no-return-void': ['error', { ignoreInferredTypes: true }],
      // Node's documented way to set a status without cutting off pending work.
      'functional/immutable-data': [
        'error',
        { ignoreClasses: 'fieldsOnly', ignoreAccessorPattern: ['process.exitCode'] },
      ],
    },
  },

  // Tooling and tests run on Node, not as the shipped package.
  {
    files: ['tools/**/*.ts', 'test/**/*.ts', '.claude/hooks/**/*.ts', '*.config.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow-as-parameter' },
      ],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      // Fakes stand in for async APIs; `async` keeps a thrown error a rejection, as the real one.
      '@typescript-eslint/require-await': 'off',
      'max-lines-per-function': 'off',
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
)
