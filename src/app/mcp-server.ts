/** @file The MCP tools: an agent reads, corrects, totals and exports entries. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod'
import { DAY, TIME } from '../adapters/argv.ts'
import { choices } from '../domain/config.ts'
import type { Context } from './context.ts'
import {
  blockEvidence,
  correct,
  effectiveEntries,
  hoursByProject,
  modelAccuracy,
  timesheetFor,
} from './entries.ts'

const INSTRUCTIONS = [
  'Local time-tracking data in fixed blocks (15 minutes by default).',
  'Dates are YYYY-MM-DD, times HH:MM, local time.',
  "Corrections (relabel) override the model's entries everywhere and become examples for the model.",
  'Check block_evidence before relabelling when unsure.',
].join(' ')

const day = z.string().regex(DAY, 'Use YYYY-MM-DD.')
const time = z.string().regex(TIME, 'Use HH:MM.')
const range = { day_from: day, day_to: day }

const text = (value: unknown) => ({
  content: [
    { type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) },
  ],
})

const readTools = (server: McpServer, ctx: Context): McpServer => {
  server.registerTool(
    'list_projects',
    { description: 'Projects an entry can be assigned to.' },
    () => text(choices(ctx.config)),
  )
  server.registerTool(
    'list_entries',
    {
      description: 'Entries between two dates (inclusive), corrections applied.',
      inputSchema: range,
    },
    (a) => text(effectiveEntries(ctx, a.day_from, a.day_to)),
  )
  server.registerTool(
    'block_evidence',
    {
      description:
        'What was on screen during one block: focused windows, cursor-only windows, idle time.',
      inputSchema: { day, time },
    },
    (a) => text(blockEvidence(ctx, a.day, a.time)),
  )
  server.registerTool(
    'accuracy',
    {
      description:
        "How often the model's project matched the corrections, and its most common mix-ups.",
    },
    () => text(modelAccuracy(ctx)),
  )
  return server
}

const reportTools = (server: McpServer, ctx: Context): McpServer => {
  server.registerTool(
    'relabel',
    {
      description: 'Correct the blocks from time_from up to time_to (exclusive) on one day.',
      inputSchema: {
        day,
        time_from: time,
        time_to: time,
        project: z.string(),
        activity: z.string().default(''),
      },
    },
    (a) => {
      const count = correct(ctx, { ...a, time: a.time_from, until: a.time_to })
      return text(`Relabelled ${String(count)} blocks.`)
    },
  )
  server.registerTool(
    'hours_by_project',
    { description: 'Hours per project between two dates (inclusive).', inputSchema: range },
    (a) => text(hoursByProject(ctx, a.day_from, a.day_to)),
  )
  server.registerTool(
    'export_timesheet',
    {
      description: 'CSV timesheet for one project: date, hours, activities.',
      inputSchema: { ...range, project: z.string() },
    },
    (a) => text(timesheetFor(ctx, a.day_from, a.day_to, a.project)),
  )
  return server
}

export const createMcpServer = (ctx: Context): McpServer =>
  reportTools(
    readTools(
      new McpServer({ name: 'timetracker', version: '0.2.0' }, { instructions: INSTRUCTIONS }),
      ctx,
    ),
    ctx,
  )
