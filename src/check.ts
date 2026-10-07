/**
 * Pure check core: `(input, ruleset, options) => Report`.
 *
 * No plugin context, no I/O, no clock and no model access, so the whole rule set
 * is unit-testable without credentials. Every finding carries the verbatim
 * clause that produced it, and every check that could not run is reported in
 * `skipped` so an empty issue list can never be read as "nothing is wrong".
 */

import { diffMinutes, formatDuration, instant, parseWallClock } from './shared/datetime.ts'
import { formatBasis, disabledAsSkipped } from './shared/rules.ts'
import { paramNumber, paramNumberMap, paramStrings, ruleById } from './shared/ruleset.ts'
import { issueId, makeReport, type Issue, type Locator, type Report, type Severity, type Skipped } from './shared/report.ts'
import { MINUTE_PRECISION_KINDS } from './model.ts'
import type { AssessmentForm, MedicalOrder, NurseRecordInput, NursingRecordEntry } from './model.ts'
import type { Ruleset } from './shared/rules.ts'

/** Options that come from the plugin configuration rather than the rule pack. */
export interface CheckOptions {
  /** Plugin name recorded in the report. */
  plugin: string
  /** UTC timestamp recorded in the report. */
  checkedAt: string
  /** Extra rule ids to disable for this run, on top of the pack's own list. */
  disabledRules: readonly string[]
  /** Extra notes shown next to each skipped check. */
  skipNotes?: string
  /** When non-empty, only these rule ids run. */
  onlyRules: readonly string[]
}

const DEFAULT_NURSE_PATTERN = '^[A-Za-z0-9\\u4e00-\\u9fa5_-]{2,32}$'

/** Severity ranking used to keep per-item severities inside the pack's ceiling. */
const SEVERITY_RANK: Record<Severity, number> = { error: 2, warn: 1, info: 0 }

interface RuleContext {
  input: NurseRecordInput
  ruleset: Ruleset
  issues: Issue[]
  skipped: Skipped[]
  /** Rule ids that produced at least one issue. */
  fired: Set<string>
  /** Rule ids that were declared but not executed, with the reason. */
  skipReasons: Map<string, string>
  add(ruleId: string, locator: Locator, found: string, expected: string, fix?: string): void
  skip(ruleId: string, reason: string): void
}

function locatorOfRecord(entry: NursingRecordEntry): Locator {
  const locator: Locator = {}
  if (entry.id !== undefined) locator.cell = entry.id
  if (entry.row !== undefined) locator.row = entry.row
  return locator
}

function locatorOfOrder(order: MedicalOrder): Locator {
  const locator: Locator = { column: order.id }
  if (order.row !== undefined) locator.row = order.row
  return locator
}

function locatorOfAssessment(form: AssessmentForm): Locator {
  const locator: Locator = { column: form.kind }
  if (form.row !== undefined) locator.row = form.row
  return locator
}

function severityOf(ruleset: Ruleset, ruleId: string): Severity {
  return ruleById(ruleset, ruleId).severity
}

function basisOf(ruleset: Ruleset, ruleId: string): string {
  const rule = ruleById(ruleset, ruleId)
  return formatBasis(rule.basis, rule.alsoBasis ?? [])
}

function makeAdd(context: Omit<RuleContext, 'add' | 'skip'>): RuleContext['add'] {
  return (ruleId, locator, found, expected, fix) => {
    const rule = ruleById(context.ruleset, ruleId)
    const issue: Issue = {
      id: issueId(context.ruleset.plugin, ruleId, locator),
      ruleId,
      severity: rule.severity,
      locator,
      found,
      expected,
      basis: formatBasis(rule.basis, rule.alsoBasis ?? []),
    }
    if (fix !== undefined) issue.fix = fix
    context.issues.push(issue)
    context.fired.add(ruleId)
  }
}

/** R-001 — every nursing entry is signed by an identifiable nurse. */
function checkSignatures(context: RuleContext): void {
  const ruleId = 'NR-001'
  const pattern = new RegExp(paramStrings(ruleById(context.ruleset, ruleId), 'nurseIdPattern', [DEFAULT_NURSE_PATTERN])[0] as string)
  for (const entry of context.input.records) {
    const locator = locatorOfRecord(entry)
    if (entry.nurseId === undefined) {
      context.add(ruleId, locator, '记录无签名护士标识', '每条护理记录均应有签名', '补录签名护士工号；无法确认签名人时应通过系统日志追溯')
      continue
    }
    if (!pattern.test(entry.nurseId)) {
      context.add(ruleId, locator, `签名标识「${entry.nurseId}」不符合工号格式`, `签名标识应匹配 ${pattern.source}`, '核对签名护士工号')
    }
  }
}

/** R-002 — every timestamp in the material is readable. */
function checkTimestampReadable(context: RuleContext): void {
  const ruleId = 'NR-002'
  for (const entry of context.input.records) {
    if (parseWallClock(entry.recordedAt) !== undefined) continue
    context.add(
      ruleId,
      locatorOfRecord(entry),
      entry.recordedAt === '' ? '记录时间为空' : `记录时间「${entry.recordedAt}」无法解析`,
      '时间应可解析为 YYYY-MM-DD HH:mm',
      '核对导出格式与时间字段取值',
    )
  }
  for (const order of context.input.orders) {
    if (order.orderedAt !== '' && parseWallClock(order.orderedAt) === undefined) {
      context.add(
        ruleId,
        locatorOfOrder(order),
        `开立时间「${order.orderedAt}」无法解析`,
        '时间应可解析为 YYYY-MM-DD HH:mm',
        '核对导出格式与时间字段取值',
      )
    }
  }
  for (const form of context.input.assessments) {
    if (form.completedAt !== '' && parseWallClock(form.completedAt) === undefined) {
      context.add(
        ruleId,
        locatorOfAssessment(form),
        `评估完成时间「${form.completedAt}」无法解析`,
        '时间应可解析为 YYYY-MM-DD HH:mm',
        '核对导出格式与时间字段取值',
      )
    }
  }
}

/** R-003 — minute precision where the entry type needs it. */
function checkMinutePrecision(context: RuleContext): void {
  const ruleId = 'NR-003'
  const kinds = paramStrings(ruleById(context.ruleset, ruleId), 'kinds', MINUTE_PRECISION_KINDS)
  const applicable = context.input.records.filter((entry) => kinds.includes(entry.kind))
  if (applicable.length === 0) {
    context.skip(ruleId, `材料中没有 ${kinds.join(' / ')} 类记录`)
    return
  }
  for (const entry of applicable) {
    const wall = parseWallClock(entry.recordedAt)
    if (wall === undefined) continue // R-002 already reported the unreadable value.
    if (wall.hasTime) continue
    context.add(
      ruleId,
      locatorOfRecord(entry),
      `记录时间「${entry.recordedAt}」只精确到日`,
      '该类记录的时间应精确到分钟',
      '补充具体时刻，或确认导出时未截断时间字段',
    )
  }
}

/** R-004 — a rescue note is written up within the allowed window. */
function checkRescueWindow(context: RuleContext): void {
  const ruleId = 'NR-004'
  const rule = ruleById(context.ruleset, ruleId)
  const maxHours = paramNumber(rule, 'maxHours', 6)
  const rescues = context.input.records.filter((entry) => entry.kind === 'rescue')
  if (rescues.length === 0) {
    context.skip(ruleId, '材料中没有 kind 为 rescue 的抢救记录')
    return
  }
  const withEnd = rescues.filter((entry) => entry.rescueEndedAt !== undefined && parseWallClock(entry.rescueEndedAt) !== undefined)
  if (withEnd.length === 0) {
    context.skip(ruleId, `材料中有 ${rescues.length} 条抢救记录，但均未提供 rescueEndedAt，无法计算补记窗口`)
    return
  }
  for (const entry of withEnd) {
    const written = parseWallClock(entry.recordedAt)
    const ended = parseWallClock(entry.rescueEndedAt as string)
    if (written === undefined || ended === undefined) continue
    const minutes = diffMinutes(ended, written)
    if (minutes < 0) {
      context.add(
        ruleId,
        locatorOfRecord(entry),
        `书写时间 ${entry.recordedAt} 早于抢救结束时间 ${entry.rescueEndedAt}`,
        '补记时间不应早于抢救结束时间',
        '核对抢救结束时间与记录时间的取值来源',
      )
      continue
    }
    if (minutes > maxHours * 60) {
      context.add(
        ruleId,
        locatorOfRecord(entry),
        `抢救结束 ${entry.rescueEndedAt} → 记录时间 ${entry.recordedAt}，间隔 ${formatDuration(minutes)}`,
        `抢救结束后 ${maxHours} 小时内据实补记`,
        '核对抢救结束时间；若确为超时补记，应在记录中说明原因',
      )
    }
  }
}

/** R-005 — an executed order carries both a timestamp and a signature. */
function checkExecutionSignoff(context: RuleContext): void {
  const ruleId = 'NR-005'
  const executing = context.input.orders.filter((order) => order.type === 'temporary')
  if (executing.length === 0) {
    context.skip(ruleId, '材料中没有临时医嘱')
    return
  }
  for (const order of executing) {
    const execution = order.execution
    if (execution === undefined) {
      context.add(
        ruleId,
        locatorOfOrder(order),
        '临时医嘱无执行记录',
        '临时医嘱执行后应有执行时间与执行人签名',
        '补充执行记录；若医嘱未执行，应记录未执行原因',
      )
      continue
    }
    const missing: string[] = []
    if (execution.executedAt === undefined) missing.push('执行时间')
    if (execution.nurseId === undefined) missing.push('执行人签名')
    if (missing.length === 0) continue
    const reported = execution.executedAt === undefined && execution.nurseId === undefined ? '执行记录为空' : `执行记录缺 ${missing.join('、')}`
    context.add(
      ruleId,
      locatorOfOrder(order),
      reported,
      '临时医嘱执行后应有执行时间与执行人签名',
      '补录执行时间与执行人；签名缺失会影响追溯',
    )
  }
}

/** R-006 — execution time is not before the order, and not implausibly late. */
function checkExecutionWindow(context: RuleContext): void {
  const ruleId = 'NR-006'
  const rule = ruleById(context.ruleset, ruleId)
  const maxLag = paramNumber(rule, 'maxLagMinutes', 120)
  const candidates = context.input.orders.filter((order) => order.execution?.executedAt !== undefined)
  if (candidates.length === 0) {
    context.skip(ruleId, '材料中没有带执行时间的医嘱')
    return
  }
  for (const order of candidates) {
    const placed = parseWallClock(order.orderedAt)
    const executed = parseWallClock(order.execution?.executedAt as string)
    if (placed === undefined || executed === undefined) continue
    const minutes = diffMinutes(placed, executed)
    if (minutes < 0) {
      context.add(
        ruleId,
        locatorOfOrder(order),
        `执行时间 ${order.execution?.executedAt} 早于开立时间 ${order.orderedAt}`,
        '执行时间不应早于开立时间',
        '核对开立与执行时间的取值来源与时钟同步情况',
      )
      continue
    }
    if (order.type === 'temporary' && minutes > maxLag) {
      context.add(
        ruleId,
        locatorOfOrder(order),
        `开立 ${order.orderedAt} → 执行 ${order.execution?.executedAt}，间隔 ${formatDuration(minutes)}`,
        `临时医嘱开立至执行的间隔不应超过 ${maxLag} 分钟`,
        '核对执行时间；确因特殊情况延迟的，应有原因记录',
      )
    }
  }
}

/** R-007 — a cancelled order records when, why and by whom. */
function checkCancellation(context: RuleContext): void {
  const ruleId = 'NR-007'
  const cancelled = context.input.orders.filter(
    (order) => order.cancellation !== undefined || order.execution?.outcome === 'cancelled' || order.execution?.outcome === 'refused',
  )
  if (cancelled.length === 0) {
    context.skip(ruleId, '材料中没有取消或拒绝的医嘱')
    return
  }
  for (const order of cancelled) {
    const missing: string[] = []
    if (order.cancellation?.cancelledAt === undefined) missing.push('取消时间')
    if (order.cancellation?.reason === undefined) missing.push('取消原因')
    if (missing.length === 0) continue
    context.add(
      ruleId,
      locatorOfOrder(order),
      `取消记录缺 ${missing.join('、')}`,
      '取消的医嘱应记录取消时间与取消原因',
      '补录取消信息；仅有执行状态而无取消记录时追溯困难',
    )
  }
}

/** R-008 — an admission assessment exists and meets the locally configured window. */
function checkAdmissionAssessment(context: RuleContext): void {
  const ruleId = 'NR-008'
  const rule = ruleById(context.ruleset, ruleId)
  const configured = rule.params.maxAfterAdmission
  if (typeof configured !== 'string' || configured.trim() === '') {
    context.skip(ruleId, '规则库未配置 maxAfterAdmission（国家层面无明文时限），本条不执行；如需启用请在本机构规则库中填写阈值')
    return
  }
  const window = parseConfiguredWindow(configured)
  const admittedAt = context.input.episode.admittedAt
  if (admittedAt === undefined) {
    context.skip(ruleId, '材料未提供 episode.admittedAt，无法计算入院评估时限')
    return
  }
  const forms = context.input.assessments.filter((form) => form.canonicalKind === 'admission')
  if (forms.length === 0) {
    context.add(
      ruleId,
      { column: 'assessments' },
      '材料中无入院评估表记录',
      `按本机构配置，入院后 ${window.label} 内应完成首次护理评估`,
      '确认入院评估是否在其他材料中；补充后重新检查',
    )
    return
  }
  const admission = parseWallClock(admittedAt)
  for (const form of forms) {
    const completed = parseWallClock(form.completedAt)
    if (admission === undefined || completed === undefined) continue
    const minutes = diffMinutes(admission, completed)
    if (minutes > window.minutes) {
      context.add(
        ruleId,
        locatorOfAssessment(form),
        `入院 ${admittedAt} → 评估完成 ${form.completedAt}，间隔 ${formatDuration(minutes)}`,
        `按本机构配置，入院后 ${window.label} 内完成首次护理评估`,
        '核对评估时间与入院时间；确因抢救等特殊情形延后的应有说明',
      )
    }
  }
}

/**
 * Parse a configured window such as `24小时`, `48h` or `90分钟`.
 * The unit is part of the value on purpose, because `24` alone cannot say
 * whether the authority meant hours or days.
 */
function parseConfiguredWindow(raw: string): { minutes: number; label: string } {
  const match = /^(\d+(?:\.\d+)?)\s*(分钟|小时|天|min|minutes|h|hours|d|days)?$/.exec(raw.trim())
  if (match === null) {
    throw new Error(`NR-008: maxAfterAdmission 的值「${raw}」无法解析；请写成如「24小时」「90分钟」「2天」`)
  }
  const amount = Number.parseFloat(match[1] as string)
  const unit = (match[2] ?? '小时').toLowerCase()
  const factor = unit.startsWith('分') || unit === 'min' || unit === 'minutes' ? 1 : unit === '天' || unit === 'd' || unit === 'days' ? 1440 : 60
  return { minutes: amount * factor, label: raw.trim() }
}

/** R-009 — the risk assessment forms the material declares are present. */
function checkRequiredAssessments(context: RuleContext): void {
  const ruleId = 'NR-009'
  const rule = ruleById(context.ruleset, ruleId)
  const defaults = [
    { canonicalKind: 'fall-risk', label: '跌倒/坠床风险评估' },
    { canonicalKind: 'pressure-ulcer', label: '压疮（压力性损伤）风险评估' },
  ]
  const required = paramStrings(rule, 'require', defaults.map((entry) => entry.canonicalKind))
  const present = new Set(context.input.assessments.map((form) => form.canonicalKind).filter((kind): kind is string => kind !== undefined))
  for (const spec of required) {
    const [canonicalKind, requestedRaw] = spec.split(':', 2)
    if (canonicalKind === undefined || canonicalKind === '') continue
    if (present.has(canonicalKind)) continue
    const label = defaults.find((entry) => entry.canonicalKind === canonicalKind)?.label ?? canonicalKind
    // The pack's own severity is a ceiling: a per-item request may lower it
    // (a form may be less load-bearing than the rule's headline) but never
    // raise it above what the cited basis supports.
    const requested: Severity = requestedRaw === 'info' || requestedRaw === 'warn' || requestedRaw === 'error' ? requestedRaw : rule.severity
    const severity = SEVERITY_RANK[requested] < SEVERITY_RANK[rule.severity] ? requested : rule.severity
    const locator: Locator = { column: 'assessments' }
    const issue = {
      id: issueId(context.ruleset.plugin, ruleId, locator),
      ruleId,
      severity,
      locator,
      found: `材料中无「${label}」表单记录`,
      expected: `应留存「${label}」评估结果`,
      basis: basisOf(context.ruleset, ruleId),
    } satisfies Issue
    context.issues.push(issue)
    context.fired.add(ruleId)
  }
}

/** R-010 — the recorded event does not precede the order it documents. */
function checkRecordOrderConsistency(context: RuleContext): void {
  const ruleId = 'NR-010'
  const byId = new Map(context.input.orders.map((order) => [order.id, order]))
  const linked = context.input.records.filter((entry) => entry.orderId !== undefined && byId.has(entry.orderId))
  if (linked.length === 0) {
    context.skip(ruleId, '材料中没有通过 orderId 关联到医嘱的护理记录')
    return
  }
  for (const entry of linked) {
    const order = byId.get(entry.orderId as string) as MedicalOrder
    const executedAt = order.execution?.executedAt
    if (executedAt === undefined) continue
    const written = parseWallClock(entry.recordedAt)
    const executed = parseWallClock(executedAt)
    if (written === undefined || executed === undefined) continue
    const minutes = diffMinutes(written, executed)
    if (minutes <= 0) continue
    context.add(
      ruleId,
      locatorOfRecord(entry),
      `记录时间 ${entry.recordedAt} 早于医嘱 ${order.id} 的执行时间 ${executedAt}，相差 ${formatDuration(minutes)}`,
      '记录时间不应早于被记录事件的执行时间',
      '核对时间来源；提前书写与事后补记均需在文书中体现',
    )
  }
}

/**
 * R-011 — nursing rounds interval against the national graded-nursing guidance.
 *
 * The national guidance states a rounds interval per care level; it does not
 * state a documentation frequency, so only the rounds interval is compared.
 */
function checkRoundsInterval(context: RuleContext): void {
  const ruleId = 'NR-011'
  const rule = ruleById(context.ruleset, ruleId)
  const careLevel = context.input.episode.careLevel
  if (careLevel === undefined) {
    context.skip(ruleId, '材料未提供 episode.careLevel，无法比对分级护理巡视间隔')
    return
  }
  if (careLevel === 'special') {
    context.skip(ruleId, '特级护理在国家指导原则中只要求「严密观察患者病情变化」，未给出具体巡视间隔，本条不适用')
    return
  }
  const configured: Record<string, number> = {
    'level-1': paramNumber(rule, 'intervalLevel1Hours', 1),
    'level-2': paramNumber(rule, 'intervalLevel2Hours', 2),
    'level-3': paramNumber(rule, 'intervalLevel3Hours', 3),
  }
  const thresholdHours = configured[careLevel]
  if (thresholdHours === undefined) {
    context.skip(ruleId, `护理级别「${careLevel}」未配置巡视间隔阈值`)
    return
  }
  const tolerance = paramNumber(rule, 'toleranceMinutes', 15)
  const entries = context.input.records
    .filter((entry) => entry.kind === 'rounds')
    .flatMap((entry) => {
      const wall = parseWallClock(entry.recordedAt)
      return wall === undefined ? [] : [{ entry, at: instant(wall) }]
    })
    .sort((left, right) => left.at - right.at)
  if (entries.length < 2) {
    context.skip(ruleId, '材料中可用于间隔比对的巡视记录少于 2 条')
    return
  }
  const maxGap = thresholdHours * 60 + tolerance
  for (let index = 1; index < entries.length; index++) {
    const previous = entries[index - 1] as { entry: NursingRecordEntry; at: number }
    const current = entries[index] as { entry: NursingRecordEntry; at: number }
    const gap = current.at - previous.at
    if (gap <= maxGap) continue
    context.add(
      ruleId,
      locatorOfRecord(current.entry),
      `相邻巡视记录 ${previous.entry.recordedAt} → ${current.entry.recordedAt}，间隔 ${formatDuration(gap)}`,
      `该护理级别要求的巡视间隔为 ${thresholdHours} 小时（比对时另放宽 ${tolerance} 分钟）`,
      '核对巡视记录是否完整；巡视间隔依据为国家指导原则，记录缺失与巡视未做需分别核实',
    )
  }
}

/**
 * R-012 — nursing documentation frequency against a locally configured policy.
 *
 * No national document states a documentation frequency per care level, so the
 * threshold ships empty and the check reports itself as skipped until the
 * deployment fills it in.
 */
function checkDocumentationFrequency(context: RuleContext): void {
  const ruleId = 'NR-012'
  const rule = ruleById(context.ruleset, ruleId)
  const intervals = paramNumberMap(rule, 'intervalHours')
  if (Object.keys(intervals).length === 0) {
    context.skip(ruleId, '规则库未配置 intervalHours（国家层面无明文记录频次要求），本条不执行；如需启用请填写本省或本机构阈值')
    return
  }
  const careLevel = context.input.episode.careLevel
  if (careLevel === undefined) {
    context.skip(ruleId, '材料未提供 episode.careLevel，无法比对配置的记录频次')
    return
  }
  const threshold = intervals[careLevel]
  if (threshold === undefined) {
    context.skip(ruleId, `配置的 intervalHours 中没有「${careLevel}」，本条不执行`)
    return
  }
  const entries = context.input.records
    .filter((entry) => entry.kind === 'general')
    .flatMap((entry) => {
      const wall = parseWallClock(entry.recordedAt)
      return wall === undefined ? [] : [{ entry, at: instant(wall) }]
    })
    .sort((left, right) => left.at - right.at)
  if (entries.length < 2) {
    context.skip(ruleId, '可用于间隔比对的护理记录少于 2 条')
    return
  }
  const maxGap = threshold * 60
  for (let index = 1; index < entries.length; index++) {
    const previous = entries[index - 1] as { entry: NursingRecordEntry; at: number }
    const current = entries[index] as { entry: NursingRecordEntry; at: number }
    const gap = current.at - previous.at
    if (gap <= maxGap) continue
    context.add(
      ruleId,
      locatorOfRecord(current.entry),
      `${previous.entry.recordedAt} → ${current.entry.recordedAt} 之间无护理记录，间隔 ${formatDuration(gap)}`,
      `按本机构配置，${careLevel} 护理的记录间隔不超过 ${threshold} 小时`,
      '核对本机构护理文书制度；该阈值可经规则库或 cordis.yml 调整',
    )
  }
}

const CHECKERS: readonly ((context: RuleContext) => void)[] = [
  checkSignatures,
  checkTimestampReadable,
  checkMinutePrecision,
  checkRescueWindow,
  checkExecutionSignoff,
  checkExecutionWindow,
  checkCancellation,
  checkAdmissionAssessment,
  checkRequiredAssessments,
  checkRecordOrderConsistency,
  checkRoundsInterval,
  checkDocumentationFrequency,
]

/**
 * Run the whole rule pack against one patient episode.
 * @param input - normalized material.
 * @param ruleset - validated rule pack.
 * @param options - plugin identity, clock value and rule selection.
 * @returns the report, with `skipped` listing every check that did not run.
 */
export function runCheck(input: NurseRecordInput, ruleset: Ruleset, options: CheckOptions): Report {
  const disabled = new Set([...ruleset.disabled, ...options.disabledRules])
  const only = new Set(options.onlyRules)
  const base = {
    input,
    ruleset,
    issues: [] as Issue[],
    skipped: [] as Skipped[],
    fired: new Set<string>(),
    skipReasons: new Map<string, string>(),
  }
  const context: RuleContext = { ...base, add: makeAdd(base), skip: (ruleId, reason) => { base.skipReasons.set(ruleId, reason) } }

  for (const checker of CHECKERS) checker(context)

  const skipped: Skipped[] = disabledAsSkipped(ruleset, [...disabled], '该规则在当前配置中被禁用')
  const withNote = (reason: string): string => (options.skipNotes === undefined ? reason : `${reason}；${options.skipNotes}`)
  for (const [ruleId, reason] of base.skipReasons) {
    if (disabled.has(ruleId) || only.has(ruleId) === false && options.onlyRules.length > 0) continue
    skipped.push({ rule: ruleId, reason: withNote(reason) })
  }
  // Declared rules that neither fired nor explained themselves must be named.
  for (const rule of ruleset.rules) {
    if (disabled.has(rule.id) || base.fired.has(rule.id) || base.skipReasons.has(rule.id)) continue
    if (options.onlyRules.length > 0 && !only.has(rule.id)) continue
    skipped.push({ rule: rule.id, reason: withNote('材料满足该检查的前置条件且未发现差异条目') })
  }
  if (options.onlyRules.length > 0) {
    const notSelected = ruleset.rules.filter((rule) => !only.has(rule.id) && !disabled.has(rule.id))
    if (notSelected.length > 0) {
      skipped.push({
        rule: notSelected.map((rule) => rule.id).join(','),
        reason: withNote(`本次调用通过 only 参数把执行范围限制为 ${[...only].join(', ')}，上列规则未执行`),
      })
    }
  }

  return makeReport({
    plugin: options.plugin,
    target: input.target,
    rulesetVersion: ruleset.version,
    checkedAt: options.checkedAt,
    issues: context.issues,
    skipped,
  })
}
