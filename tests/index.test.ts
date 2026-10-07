import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadRuleset } from '../src/shared/ruleset.ts'
import { parseMaterial } from '../src/parse.ts'
import { runCheck } from '../src/check.ts'
import { buildView } from '../src/view.ts'
import { findForbiddenWording } from '../src/shared/wording.ts'
import { suggestHeader } from '../src/shared/dictionary.ts'
import { addDays, diffDays, eachDay, parseWallClock, weekday } from '../src/shared/datetime.ts'
import { parseYaml } from '../src/shared/yaml.ts'
import { Config as ConfigSchema } from '../src/config.ts'
import { inject, name as pluginName, resolvePackageFile, TOOL_NAME } from '../src/index.ts'
import type { Report } from '../src/shared/report.ts'
import type { CheckOptions } from '../src/check.ts'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')
const rulesPath = join(packageRoot, 'rules', 'nurse-record.yaml')
const fixturesRoot = join(here, 'fixtures')

const CHECKED_AT = '2026-10-06T00:00:00.000Z'

interface CaseExpectation {
  ruleId: string
  count: number
  severity?: 'error' | 'warn' | 'info'
}

interface CaseFile {
  ruleId: string
  purpose: string
  /** Rule parameters this fixture needs in order to exercise the check. */
  configure?: Record<string, Record<string, unknown>>
  pairs: { name: string; material: string; expect: CaseExpectation }[]
}

async function loadPack() {
  return loadRuleset(await readFile(rulesPath, 'utf8'))
}

/** Apply a fixture's `configure` block on top of the loaded rule pack. */
function withConfiguration(ruleset: Awaited<ReturnType<typeof loadPack>>, configure: Record<string, Record<string, unknown>> | undefined) {
  if (configure === undefined) return ruleset
  return {
    ...ruleset,
    rules: ruleset.rules.map((rule) =>
      configure[rule.id] === undefined ? rule : { ...rule, params: { ...rule.params, ...configure[rule.id] } },
    ),
  }
}

function runOptions(overrides: Partial<CheckOptions> = {}): CheckOptions {
  return {
    plugin: pluginName,
    checkedAt: CHECKED_AT,
    disabledRules: [],
    onlyRules: [],
    ...overrides,
  }
}

async function runFixtureMaterial(
  materialText: string,
  target: string,
  configure?: Record<string, Record<string, unknown>>,
): Promise<Report> {
  const ruleset = withConfiguration(await loadPack(), configure)
  const input = parseMaterial(materialText, target)
  return runCheck(input, ruleset, runOptions())
}

function issuesOf(report: Report, ruleId: string) {
  return report.issues.filter((issue) => issue.ruleId === ruleId)
}

async function ruleDirectories(): Promise<string[]> {
  const entries = await readdir(fixturesRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

async function readCases(directory: string): Promise<CaseFile> {
  return JSON.parse(await readFile(join(fixturesRoot, directory, 'cases.json'), 'utf8')) as CaseFile
}

describe('rule pack', () => {
  it('declares a citable basis for every rule', async () => {
    const ruleset = await loadPack()
    expect(ruleset.plugin).toBe(pluginName)
    expect(ruleset.rules.length).toBeGreaterThanOrEqual(12)
    for (const rule of ruleset.rules) {
      expect(rule.basis.document, `${rule.id} document`).not.toBe('')
      expect(rule.basis.clause, `${rule.id} clause`).not.toBe('')
      expect(rule.basis.excerpt.length, `${rule.id} excerpt`).toBeGreaterThanOrEqual(8)
      expect(rule.basis.source, `${rule.id} source`).toMatch(/^https?:\/\//)
      expect(['direct', 'derived-from-principle', 'institutional-configuration'], `${rule.id} kind`).toContain(rule.basis.kind)
      expect(['error', 'warn', 'info'], `${rule.id} severity`).toContain(rule.severity)
      for (const extra of rule.alsoBasis ?? []) {
        expect(extra.clause, `${rule.id} alsoBasis clause`).not.toBe('')
        expect(extra.excerpt.length, `${rule.id} alsoBasis excerpt`).toBeGreaterThanOrEqual(8)
        expect(extra.source, `${rule.id} alsoBasis source`).toMatch(/^https?:\/\//)
      }
    }
  })

  it('never lets a principle-derived or locally configured check be an error', async () => {
    const ruleset = await loadPack()
    for (const rule of ruleset.rules) {
      if (rule.basis.kind === 'derived-from-principle') expect(rule.severity, rule.id).not.toBe('error')
      if (rule.basis.kind === 'institutional-configuration') expect(rule.severity, rule.id).toBe('info')
    }
  })

  it('refuses a rule pack that overstates a principle-derived check', () => {
    const overstated = [
      'plugin: probe',
      'version: "0"',
      'rules:',
      '  - id: X-001',
      '    title: probe',
      '    severity: error',
      '    basis:',
      '      document: 《X》',
      '      number: X〔2020〕1号',
      '      clause: 第一条',
      '      excerpt: 这是一个足够长的逐字摘录示例。',
      '      kind: derived-from-principle',
      '      source: https://example.invalid/x',
    ].join('\n')
    expect(() => loadRuleset(overstated)).toThrow(/strongest permitted severity/)
  })

  it('ships a paired fixture for every rule it declares', async () => {
    const ruleset = await loadPack()
    const directories = await ruleDirectories()
    for (const rule of ruleset.rules) {
      expect(directories, `fixtures for ${rule.id}`).toContain(rule.id)
      const cases = await readCases(rule.id)
      expect(cases.pairs.length, `${rule.id} pair count`).toBeGreaterThanOrEqual(2)
      for (const pair of cases.pairs) {
        const materialPath = join(fixturesRoot, rule.id, pair.material)
        expect(existsSync(materialPath), `material ${pair.material}`).toBe(true)
      }
    }
  })
})

describe('paired fixtures', () => {
  it('has both a compliant and a violating sample in every pair', async () => {
    const directories = await ruleDirectories()
    const covered = new Set<string>()
    for (const directory of directories) {
      const cases = await readCases(directory)
      const failing = cases.pairs.filter((pair) => pair.expect.count > 0)
      const passing = cases.pairs.filter((pair) => pair.expect.count === 0)
      expect(passing.length, `${directory} compliant sample`).toBeGreaterThanOrEqual(1)
      expect(failing.length, `${directory} violating sample`).toBeGreaterThanOrEqual(1)
      for (const pair of cases.pairs) {
        const materialPath = join(fixturesRoot, directory, pair.material)
        const material = await readFile(materialPath, 'utf8')
        const report = await runFixtureMaterial(material, pair.material, cases.configure)
        const matched = issuesOf(report, cases.ruleId)
        expect(
          matched.length,
          `${directory}/${pair.name} expected ${pair.expect.count} × ${cases.ruleId}, got ${matched.map((issue) => issue.found).join(' | ')}`,
        ).toBe(pair.expect.count)
        covered.add(cases.ruleId)
      }
    }
    const ruleset = await loadPack()
    for (const rule of ruleset.rules) expect(covered.has(rule.id), `covered ${rule.id}`).toBe(true)
  })

  it('gives every issue a citable basis, a stable id and a locator', async () => {
    const directories = await ruleDirectories()
    for (const directory of directories) {
      const cases = await readCases(directory)
      for (const pair of cases.pairs) {
        const material = await readFile(join(fixturesRoot, directory, pair.material), 'utf8')
        const report = await runFixtureMaterial(material, pair.material, cases.configure)
        for (const issue of report.issues) {
          expect(issue.basis, `${issue.ruleId} basis`).toContain('「')
          expect(issue.id).toMatch(/^dsh-nurse-record-check\.[A-Z]+-\d{3}\.[0-9a-f]{8}$/)
          expect(issue.found).not.toBe('')
          expect(issue.expected).not.toBe('')
          expect(Object.keys(issue.locator).length, `${issue.id} locator`).toBeGreaterThan(0)
        }
        expect(report.rulesetVersion).not.toBe('')
        expect(Array.isArray(report.skipped)).toBe(true)
      }
    }
  })
})

describe('skipped reporting', () => {
  it('keeps a config-dependent check out of the findings and names it as skipped', async () => {
    const ruleset = await loadPack()
    const input = parseMaterial(
      [
        'episode:',
        '  admittedAt: "2026-03-15 08:00"',
        '  careLevel: level-2',
        'records:',
        '  - kind: rounds',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
        '  - kind: rounds',
        '    recordedAt: "2026-03-15 10:00"',
        '    nurseId: N10231',
      ].join('\n'),
      'inline',
    )
    const report = runCheck(input, ruleset, runOptions())
    for (const ruleId of ['NR-008', 'NR-012']) {
      expect(issuesOf(report, ruleId).length, `${ruleId} must not fire while unconfigured`).toBe(0)
      const entry = report.skipped.find((item) => item.rule === ruleId)
      expect(entry?.reason, `${ruleId} skip reason`).toMatch(/未配置/)
    }
  })

  it('runs the config-dependent checks once a threshold is configured', async () => {
    const ruleset = await loadPack()
    const configured = {
      ...ruleset,
      rules: ruleset.rules.map((rule) => {
        if (rule.id === 'NR-008') return { ...rule, params: { maxAfterAdmission: '24小时' } }
        if (rule.id === 'NR-012') return { ...rule, params: { intervalHours: { 'level-2': 12 } } }
        return rule
      }),
    }
    const report = runCheck(
      parseMaterial(
        [
          'episode:',
          '  admittedAt: "2026-03-15 08:00"',
          '  careLevel: level-2',
          'records:',
          '  - kind: general',
          '    recordedAt: "2026-03-15 09:00"',
          '    nurseId: N10231',
          '  - kind: general',
          '    recordedAt: "2026-03-16 09:00"',
          '    nurseId: N10231',
          'assessments:',
          '  - kind: 入院评估',
          '    completedAt: "2026-03-16 15:00"',
          '  - kind: 跌倒风险评估',
          '    completedAt: "2026-03-15 09:10"',
          '  - kind: 压疮风险评估',
          '    completedAt: "2026-03-15 09:20"',
        ].join('\n'),
        'inline',
      ),
      configured,
      runOptions(),
    )
    expect(issuesOf(report, 'NR-008').length).toBe(1)
    expect(issuesOf(report, 'NR-012').length).toBe(1)
    expect(report.skipped.some((item) => item.rule === 'NR-008')).toBe(false)
  })

  it('rejects a configured window whose unit cannot be read', async () => {
    const ruleset = await loadPack()
    const broken = {
      ...ruleset,
      rules: ruleset.rules.map((rule) =>
        rule.id === 'NR-008' ? { ...rule, params: { maxAfterAdmission: '一天左右' } } : rule,
      ),
    }
    expect(() =>
      runCheck(
        parseMaterial(['episode:', '  admittedAt: "2026-03-15 08:00"', 'records:', '  - kind: general', '    recordedAt: "2026-03-15 09:00"', '    nurseId: N10231'].join('\n'), 'inline'),
        broken,
        runOptions(),
      ),
    ).toThrow(/无法解析/)
  })

  it('names the rescue check when the material carries no rescue record', async () => {
    const report = await runFixtureMaterial(
      [
        'episode:',
        '  admittedAt: "2026-03-15 08:00"',
        'records:',
        '  - kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
      ].join('\n'),
      'inline',
    )
    const entry = report.skipped.find((item) => item.rule === 'NR-004')
    expect(entry).toBeDefined()
    expect(entry?.reason).toContain('抢救记录')
  })

  it('names disabled rules and admits a restricted run', async () => {
    const ruleset = await loadPack()
    const input = parseMaterial(
      [
        'episode:',
        '  admittedAt: "2026-03-15 08:00"',
        'records:',
        '  - kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
      ].join('\n'),
      'inline',
    )
    const report = runCheck(input, ruleset, runOptions({ disabledRules: ['NR-011'], onlyRules: ['NR-001'], skipNotes: '本机构实施细则' }))
    const disabled = report.skipped.find((item) => item.rule === 'NR-011')
    const scope = report.skipped.find((item) => item.reason.includes('only 参数'))
    expect(disabled?.reason).toContain('禁用')
    expect(scope?.rule).toContain('NR-002')
    expect(report.skipped.some((item) => item.rule === 'NR-002'), 'NR-002 must not be reported twice').toBe(false)
  })

  it('appends the configured note to every skip reason', async () => {
    const ruleset = await loadPack()
    const input = parseMaterial(
      [
        'episode:',
        '  admittedAt: "2026-03-15 08:00"',
        'records:',
        '  - kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
      ].join('\n'),
      'inline',
    )
    const report = runCheck(input, ruleset, runOptions({ skipNotes: '依本机构护理文书制度' }))
    expect(report.skipped.length).toBeGreaterThan(0)
    for (const entry of report.skipped) expect(entry.reason).toContain('依本机构护理文书制度')
  })
})

describe('report rendering', () => {
  it('never uses adjudicating wording and always carries the disclaimer', async () => {
    const material = await readFile(join(fixturesRoot, 'NR-004', 'NR-004-unsafe.yaml'), 'utf8')
    const report = await runFixtureMaterial(material, 'NR-004-unsafe.yaml')
    const view = buildView(report)
    expect(findForbiddenWording(view.markdown)).toEqual([])
    expect(view.markdown).toContain('免责声明')
    expect(view.markdown).toContain('未执行的检查')
    expect(JSON.parse(view.reportJson)).toMatchObject({ plugin: pluginName, summary: report.summary })
    expect(view.issueCount).toBe(report.issues.length)
  })
})

describe('plugin contract', () => {
  it('declares a static inject array covering every service apply touches', () => {
    expect(Array.isArray(inject)).toBe(true)
    expect(inject).toContain('tools')
  })

  it('exposes a Schemastery Config with serializable defaults', () => {
    const resolved = ConfigSchema(null)
    expect(resolved.rulesFile).toBe('rules/nurse-record.yaml')
    expect(resolved.disabledRules).toEqual([])
    expect(resolved.onlyRules).toEqual([])
    expect(resolved.timeoutMs).toBeGreaterThan(0)
  })

  it('resolves the packaged rule pack and rejects a missing one', () => {
    expect(resolvePackageFile('rules/nurse-record.yaml')).toBe(rulesPath)
    expect(() => resolvePackageFile('rules/does-not-exist.yaml')).toThrow(/未找到/)
  })

  it('names the tool after the package family convention', () => {
    expect(TOOL_NAME).toBe('nurse_record_check')
  })
})

describe('material reader', () => {
  it('rejects empty material instead of reporting an empty result', () => {
    expect(() => parseMaterial('   ', 'inline')).toThrow(/材料为空/)
  })

  it('rejects material without any checkable collection', () => {
    expect(() => parseMaterial('episode:\n  admittedAt: "2026-03-15 08:00"', 'inline')).toThrow(/无法执行检查/)
  })

  it('records unreadable timestamps as a reader warning', () => {
    const input = parseMaterial(
      ['records:', '  - kind: general', '    recordedAt: "上周五"', '    nurseId: N10231'].join('\n'),
      'inline',
    )
    expect(input.warnings.join(' ')).toContain('上周五')
  })
})

describe('shared kit', () => {
  it('parses a wall-clock timestamp with and without time', () => {
    expect(parseWallClock('2026-03-15 08:30')).toEqual({ date: '2026-03-15', time: '08:30', hasTime: true, minutes: 510 })
    expect(parseWallClock('2026-03-15')).toEqual({ date: '2026-03-15', time: '00:00', hasTime: false, minutes: 0 })
    expect(parseWallClock('2026/3/5T06:05:00')).toMatchObject({ date: '2026-03-05', time: '06:05' })
    expect(parseWallClock('2026-02-30')).toBeUndefined()
    expect(parseWallClock('2026-03-15 25:00')).toBeUndefined()
  })

  it('does calendar arithmetic across months and weekdays', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01')
    expect(diffDays('2026-03-01', '2026-03-31')).toBe(30)
    expect(eachDay('2026-03-30', '2026-04-02')).toEqual(['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02'])
    expect(weekday('2026-03-15')).toBe(0)
    expect(eachDay('2026-03-31', '2026-03-01')).toEqual([])
  })

  it('reads the supported YAML subset and rejects the rest', () => {
    expect(parseYaml('a: 1\nb:\n  - x\n  - y\n')).toEqual({ a: 1, b: ['x', 'y'] })
    expect(parseYaml('a:\n  - id: K\n    v: "q # not a comment"\n')).toEqual({ a: [{ id: 'K', v: 'q # not a comment' }] })
    expect(parseYaml('a: |\n  line1\n  line2\n')).toEqual({ a: 'line1\nline2' })
    expect(parseYaml('')).toBeNull()
    expect(() => parseYaml('a: 1\na: 2\n')).toThrow(/duplicate/)
  })

  it('suggests the closest header for an unmatched column', () => {
    expect(suggestHeader('性别代码', [{ key: 'sex', aliases: ['性别', 'SEX'] }])).toBe('性别')
    expect(suggestHeader('完全无关的列名', [{ key: 'sex', aliases: ['性别'] }])).toBeUndefined()
  })
})
