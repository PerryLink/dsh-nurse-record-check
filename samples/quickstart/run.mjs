import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as plugin from '../../lib/index.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const material = await readFile(join(here, 'input', "NR-001-unsafe.yaml"), 'utf8')

const registered = []
const ctx = { tools: { register: (tool) => { registered.push(tool); return () => {} } } }
plugin.apply(ctx, plugin.Config ? plugin.Config({}) : {})
const tool = registered.find((t) => t.name === plugin.TOOL_NAME)
if (!tool) throw new Error('tool not registered: ' + plugin.TOOL_NAME)

const result = await tool.execute({ material }, { signal: new AbortController().signal })
const summary = {
  tool: tool.name,
  issueCount: result.issueCount,
  summary: result.summary,
  skippedCount: result.skippedCount,
}
if (process.argv.includes('--json')) console.log(JSON.stringify(summary, null, 2))
else {
  console.log('$ node samples/quickstart/run.mjs')
  console.log(tool.name + ': ' + summary.issueCount + ' issue(s) — error ' + summary.summary.error + ', warn ' + summary.summary.warn + ', info ' + summary.summary.info)
  console.log('skipped: ' + summary.skippedCount)
}
