/**
 * @file PostToolUse(Edit|Write|MultiEdit): format and lint the file just written, and hand
 * any leftover errors back to Claude.
 */
import { relative } from 'node:path'
import { node, projectDir, readInput, reply, tail } from './lib.ts'

const file = readInput().tool_input?.file_path
const path = file === undefined ? '' : relative(projectDir(), file).replaceAll('\\', '/')
const inside = path !== '' && !path.startsWith('..')

const PRETTIER = 'node_modules/prettier/bin/prettier.cjs'
const ESLINT = 'node_modules/eslint/bin/eslint.js'

const problems: string[] = []

if (inside && /\.(ts|json|md|ya?ml)$/.test(path) && path !== 'pnpm-lock.yaml') {
  node(PRETTIER, ['--write', '--log-level=warn', '--', path])
}
if (inside && path.endsWith('.ts')) {
  const lint = node(ESLINT, ['--fix', '--max-warnings=0', '--', path])
  if (!lint.ok) problems.push(`ESLint on ${path}:\n${tail(lint.output, 40)}`)
}

if (problems.length > 0) {
  reply({ decision: 'block', reason: `Fix before moving on:\n\n${problems.join('\n\n')}` })
}
