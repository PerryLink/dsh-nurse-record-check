import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Config } from './config.ts'
import type { Config as ConfigShape } from './config.ts'
import { runCheck } from './check.ts'
import { MaterialError, parseMaterial } from './parse.ts'
import { buildView } from './view.ts'
import { loadRulesetFile } from './shared/memo.ts'

export const name = 'dsh-nurse-record-check'
export const inject = ['tools']
export { Config }

/** Tool id exposed to the model, and the row id in `cordis.patch.yml`. */
export const TOOL_NAME = 'nurse_record_check'

/**
 * Locate a package-owned file such as the rule pack.
 *
 * Resolution order: absolute path, then the process working directory, then
 * every ancestor of the module directory. Ancestors are walked because a plugin
 * may run from the profile's `node_modules` while callers pass paths relative to
 * their own workspace, and a wrong silent fallback would produce a report built
 * from the wrong rule pack.
 *
 * @param relative - configured path, relative to the plugin package root.
 * @returns the resolved absolute path.
 * @throws Error naming every location tried, when the file is absent.
 */
export function resolvePackageFile(relative: string): string {
  if (isAbsolute(relative)) {
    if (existsSync(relative)) return relative
    throw new Error(`规则库文件不存在：${relative}`)
  }
  const tried: string[] = []
  let current = import.meta.dirname ?? process.cwd()
  for (;;) {
    const candidate = resolve(current, relative)
    tried.push(candidate)
    if (existsSync(candidate)) return candidate
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  const fromCwd = resolve(process.cwd(), relative)
  if (!tried.includes(fromCwd)) {
    tried.push(fromCwd)
    if (existsSync(fromCwd)) return fromCwd
  }
  throw new Error(`规则库文件未找到：${relative}；已尝试 ${tried.length} 个位置，最近一处为 ${join(tried[0] ?? '', '')}`)
}

/** Read material from a file path or use the inline text as-is. */
async function readMaterial(file: string | undefined, material: string | undefined, signal: AbortSignal): Promise<{ text: string; target: string }> {
  if (file !== undefined && file.trim() !== '') {
    const path = resolve(file)
    signal.throwIfAborted()
    const text = await readFile(path, { encoding: 'utf8', signal })
    return { text, target: path }
  }
  if (material !== undefined && material.trim() !== '') return { text: material, target: '(内联材料)' }
  throw new MaterialError('必须提供 file 或 material 之一')
}

/**
 * Register the nursing-record checker tool.
 *
 * Registration is an effect: `ctx.tools.register` returns the disposer that
 * removes the tool when this plugin unloads, which is what keeps the plugin
 * hot-reloadable.
 *
 * @param ctx - plugin context, with `tools` already available.
 * @param config - validated configuration.
 */
export function apply(ctx: Context, config: ConfigShape): () => void {
  return ctx.tools.register(
    defineTool({
      name: TOOL_NAME,
      description:
        '按声明的规则库核对护理记录的时限、签名与评估表记录，输出逐条差异与条款依据。' +
        '本工具只列出材料与所引条款之间的字面差异，供人工复核，不作出任何定性结论。' +
        '材料为 JSON 或 YAML，字段见插件 README；无法执行的检查会列在 skipped 中。',
      parameters: {
        file: { type: 'string', description: '材料文件绝对路径（JSON 或 YAML）。与 material 二选一。' },
        material: { type: 'string', description: '内联材料文本（JSON 或 YAML）。与 file 二选一。' },
        rulesFile: { type: 'string', description: '覆盖配置中的规则库路径（相对插件包根或绝对路径）。' },
        only: {
          type: 'array',
          items: { type: 'string' },
          description: '只执行这些规则 id；留空表示执行全部规则。',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            plugin: { type: 'string' },
            target: { type: 'string' },
            checkedAt: { type: 'string' },
            rulesetVersion: { type: 'string' },
            summary: {
              type: 'object',
              additionalProperties: false,
              properties: {
                error: { type: 'integer' },
                warn: { type: 'integer' },
                info: { type: 'integer' },
              },
            },
            issueCount: { type: 'integer' },
            skippedCount: { type: 'integer' },
            markdown: { type: 'string' },
            reportJson: { type: 'string' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: (value as { markdown: string }).markdown }],
      },
      timeoutMs: config.timeoutMs,
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const relative = args.rulesFile !== undefined && args.rulesFile.trim() !== '' ? args.rulesFile : config.rulesFile
        const [material, ruleset] = await Promise.all([
          readMaterial(args.file, args.material, exec.signal),
          loadRulesetFile(resolvePackageFile(relative)),
        ])
        exec.signal.throwIfAborted()
        const input = parseMaterial(material.text, material.target)
        const only = (args.only ?? []).length > 0 ? (args.only as string[]) : config.onlyRules
        const report = runCheck(input, ruleset, {
          plugin: name,
          checkedAt: new Date().toISOString(),
          disabledRules: config.disabledRules,
          onlyRules: only,
          skipNotes: config.skipNotes === '' ? undefined : config.skipNotes,
        })
        return buildView(report)
      },
    }),
  )
}
