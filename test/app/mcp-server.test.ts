import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { expect, test } from 'vitest'
import { createMcpServer } from '../../src/app/mcp-server.ts'
import { context, DAY, entries, hhmm } from '../support/context.ts'

const connect = async () => {
  const ctx = context()
  entries(ctx, [
    ['Sono', 'PR review'],
    ['Sono', 'standup'],
  ])
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createMcpServer(ctx).connect(serverSide)
  const client = new Client({ name: 'test', version: '0' })
  await client.connect(clientSide)
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args })
    const [first] = result.content as { text: string }[]
    return { text: first?.text ?? '', isError: result.isError === true }
  }
  return { client, call }
}

test('lists the tools', async () => {
  const { client } = await connect()
  const { tools } = await client.listTools()
  expect(tools.map((t) => t.name).toSorted()).toEqual([
    'accuracy',
    'block_evidence',
    'export_timesheet',
    'hours_by_project',
    'list_entries',
    'list_projects',
    'relabel',
  ])
})

test('relabel, then read the result back', async () => {
  const { call } = await connect()
  expect((await call('list_projects')).text).toBe('["Sono","Job search","Idle"]')
  const range = { day_from: DAY, day_to: DAY }
  const relabel = { day: DAY, time_from: hhmm(1), time_to: hhmm(2), project: 'Job search' }
  expect((await call('relabel', relabel)).text).toBe('Relabelled 1 blocks.')
  expect(JSON.parse((await call('hours_by_project', range)).text)).toEqual([
    { project: 'Sono', hours: 0.25 },
    { project: 'Job search', hours: 0.25 },
  ])
  expect(JSON.parse((await call('list_entries', range)).text)).toHaveLength(2)
  expect((await call('export_timesheet', { ...range, project: 'Sono' })).text).toContain(
    'PR review',
  )
  expect((await call('block_evidence', { day: DAY, time: hhmm(0) })).text).toBe('evidence 0')
  expect(JSON.parse((await call('accuracy')).text)).toMatchObject({ blocks: 1, accuracy: 0 })
})

test('bad input comes back as a tool error naming the fix', async () => {
  const { call } = await connect()
  const golf = await call('relabel', {
    day: DAY,
    time_from: '09:00',
    time_to: '10:00',
    project: 'Golf',
  })
  expect(golf).toMatchObject({ isError: true })
  expect(golf.text).toMatch(/Unknown project "Golf"/)
  expect((await call('list_entries', { day_from: 'today', day_to: DAY })).text).toMatch(
    /YYYY-MM-DD/,
  )
})
