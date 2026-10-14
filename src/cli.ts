/** @file Entry point: `node src/cli.ts <command>`. Wires the real sampler, model and stdio. */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { parseArgs } from './adapters/argv.ts'
import { runCommand } from './app/cli.ts'
import { errorMessage } from './shared/errors.ts'
import { loadConfig } from './infra/config-file.ts'
import { ollamaChat } from './infra/ollama.ts'
import { windowsSampler } from './infra/sampler.ts'
import { openStore } from './infra/store.ts'
import { nowSeconds, today } from './infra/time.ts'
import { unwrap } from './infra/unwrap.ts'

const main = async (): Promise<unknown> => {
  const { configPath, command } = unwrap(parseArgs(process.argv.slice(2), today()))
  const config = loadConfig(configPath ?? process.env['TIMETRACKER_CONFIG'] ?? 'config.toml')
  const store = openStore(config.dbPath)
  return runCommand(
    command,
    { config, store },
    {
      print: (text) => process.stdout.write(`${text}\n`),
      warn: (text) => process.stderr.write(`${text}\n`),
      now: nowSeconds,
      sampler: windowsSampler,
      chat: ollamaChat(config.ollamaUrl, config.model),
      serve: (server) => server.connect(new StdioServerTransport()),
    },
  )
}

main().catch((err: unknown) => {
  process.stderr.write(`${errorMessage(err)}\n`)
  process.exitCode = 1
})
