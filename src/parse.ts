/**
 * Reader for the canonical nursing-record material.
 *
 * The material is either a JSON payload exported by a ward system or the same
 * payload written as YAML. Every field the model declares is optional at the
 * reader level and validated by the check engine, so a partially filled export
 * produces findings about the missing parts instead of a reader crash.
 */

import { YamlSubsetError, parseYaml } from './shared/yaml.ts'
import { canonicalize, ASSESSMENT_SYNONYMS } from './shared/dictionary.ts'
import { parseWallClock } from './shared/datetime.ts'
import { ALL_RECORD_KINDS, toRecordKind } from './model.ts'
import type {
  AssessmentForm,
  EpisodeFacts,
  ExecutionOutcome,
  MedicalOrder,
  NurseRecordInput,
  NursingRecordEntry,
} from './model.ts'

/** Raised when the material cannot be read at all. */
export class MaterialError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MaterialError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown, where: string): Record<string, unknown>[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new MaterialError(`${where} 必须是列表`)
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new MaterialError(`${where}[${index}] 必须是映射`)
    return entry
  })
}

function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/** Read an optional timestamp, recording a warning when it is unparseable. */
function stamp(value: unknown, where: string, warnings: string[]): string | undefined {
  const raw = text(value)
  if (raw === undefined) return undefined
  if (parseWallClock(raw) === undefined) {
    warnings.push(`${where} 的时间「${raw}」不是可识别的 YYYY-MM-DD HH:mm 形式，相关时间窗口检查将被跳过`)
    return undefined
  }
  return raw
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = text(value)
  if (raw === undefined) return undefined
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function outcome(value: unknown): ExecutionOutcome | undefined {
  const raw = text(value)?.toLowerCase()
  if (raw === undefined) return undefined
  const table: Record<string, ExecutionOutcome> = {
    executed: 'executed',
    已执行: 'executed',
    执行: 'executed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    已取消: 'cancelled',
    取消: 'cancelled',
    作废: 'cancelled',
    refused: 'refused',
    拒绝: 'refused',
  }
  return table[raw]
}

function parseRecord(raw: Record<string, unknown>, index: number, warnings: string[]): NursingRecordEntry {
  const where = `records[${index}]`
  const entry: NursingRecordEntry = {
    kind: toRecordKind(text(raw.kind) ?? text(raw.type) ?? 'other'),
    recordedAt: stamp(raw.recordedAt, where, warnings) ?? '',
  }
  const id = text(raw.id)
  if (id !== undefined) entry.id = id
  const row = optionalNumber(raw.row)
  if (row !== undefined) entry.row = row
  const ward = text(raw.ward)
  if (ward !== undefined) entry.ward = ward
  const nurseId = text(raw.nurseId)
  if (nurseId !== undefined) entry.nurseId = nurseId
  const nurseName = text(raw.nurseName)
  if (nurseName !== undefined) entry.nurseName = nurseName
  const rescueEndedAt = stamp(raw.rescueEndedAt, `${where}.rescueEndedAt`, warnings)
  if (rescueEndedAt !== undefined) entry.rescueEndedAt = rescueEndedAt
  const orderId = text(raw.orderId)
  if (orderId !== undefined) entry.orderId = orderId
  const body = text(raw.text)
  if (body !== undefined) entry.text = body
  return entry
}

function parseOrder(raw: Record<string, unknown>, index: number, warnings: string[]): MedicalOrder {
  const where = `orders[${index}]`
  const id = text(raw.id)
  if (id === undefined) throw new MaterialError(`${where} 缺少必填字段 id`)
  const rawType = (text(raw.type) ?? 'temporary').toLowerCase()
  const type: MedicalOrder['type'] =
    rawType === 'long-term' || rawType === 'longterm' || rawType === '长期' || rawType === '长期医嘱'
      ? 'long-term'
      : 'temporary'
  const order: MedicalOrder = {
    id,
    type,
    orderedAt: stamp(raw.orderedAt, where, warnings) ?? '',
  }
  const row = optionalNumber(raw.row)
  if (row !== undefined) order.row = row
  const body = text(raw.text)
  if (body !== undefined) order.text = body
  const prescriber = text(raw.prescriber)
  if (prescriber !== undefined) order.prescriber = prescriber

  if (isRecord(raw.execution)) {
    const execution: NonNullable<MedicalOrder['execution']> = {}
    const executedAt = stamp(raw.execution.executedAt, `${where}.execution.executedAt`, warnings)
    if (executedAt !== undefined) execution.executedAt = executedAt
    const nurseId = text(raw.execution.nurseId)
    if (nurseId !== undefined) execution.nurseId = nurseId
    const result = outcome(raw.execution.outcome)
    if (result !== undefined) execution.outcome = result
    order.execution = execution
  }
  if (isRecord(raw.cancellation)) {
    const cancellation: NonNullable<MedicalOrder['cancellation']> = {}
    const cancelledAt = stamp(raw.cancellation.cancelledAt, `${where}.cancellation.cancelledAt`, warnings)
    if (cancelledAt !== undefined) cancellation.cancelledAt = cancelledAt
    const reason = text(raw.cancellation.reason)
    if (reason !== undefined) cancellation.reason = reason
    const nurseId = text(raw.cancellation.nurseId)
    if (nurseId !== undefined) cancellation.nurseId = nurseId
    order.cancellation = cancellation
  }
  return order
}

function parseAssessment(raw: Record<string, unknown>, index: number, warnings: string[]): AssessmentForm {
  const where = `assessments[${index}]`
  const kind = text(raw.kind) ?? text(raw.name)
  if (kind === undefined) throw new MaterialError(`${where} 缺少必填字段 kind`)
  const canonical = canonicalize(kind, ASSESSMENT_SYNONYMS)
  if (canonical === undefined) warnings.push(`${where} 的评估表名称「${kind}」不在同义词典中，按原名参与检查`)
  const form: AssessmentForm = {
    kind,
    completedAt: stamp(raw.completedAt, where, warnings) ?? '',
  }
  if (canonical !== undefined) form.canonicalKind = canonical
  const row = optionalNumber(raw.row)
  if (row !== undefined) form.row = row
  const score = optionalNumber(raw.score)
  if (score !== undefined) form.score = score
  const nurseId = text(raw.nurseId)
  if (nurseId !== undefined) form.nurseId = nurseId
  return form
}

function parseEpisode(raw: unknown, warnings: string[]): EpisodeFacts {
  if (!isRecord(raw)) return {}
  const episode: EpisodeFacts = {}
  const admittedAt = stamp(raw.admittedAt, 'episode.admittedAt', warnings)
  if (admittedAt !== undefined) episode.admittedAt = admittedAt
  const dischargedAt = stamp(raw.dischargedAt, 'episode.dischargedAt', warnings)
  if (dischargedAt !== undefined) episode.dischargedAt = dischargedAt
  const careLevel = text(raw.careLevel)
  if (careLevel !== undefined) {
    const table: Record<string, NonNullable<EpisodeFacts['careLevel']>> = {
      special: 'special',
      特级: 'special',
      特级护理: 'special',
      'level-1': 'level-1',
      一级: 'level-1',
      一级护理: 'level-1',
      'level-2': 'level-2',
      二级: 'level-2',
      二级护理: 'level-2',
      'level-3': 'level-3',
      三级: 'level-3',
      三级护理: 'level-3',
    }
    const resolved = table[careLevel.toLowerCase()]
    if (resolved === undefined) warnings.push(`episode.careLevel 的值「${careLevel}」无法识别，护理级别相关检查将被跳过`)
    else episode.careLevel = resolved
  }
  const patientLabel = text(raw.patientLabel)
  if (patientLabel !== undefined) episode.patientLabel = patientLabel
  return episode
}

/**
 * Parse material into the normalized input contract.
 * @param source - JSON or YAML text.
 * @param target - description of where the material came from.
 * @returns the normalized input plus reader diagnostics.
 */
export function parseMaterial(source: string, target: string): NurseRecordInput {
  const trimmed = source.trim()
  if (trimmed === '') throw new MaterialError('材料为空')
  let document: unknown
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      document = JSON.parse(trimmed)
    } catch (error) {
      throw new MaterialError(`JSON 无法解析：${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    try {
      document = parseYaml(trimmed)
    } catch (error) {
      if (error instanceof YamlSubsetError) throw new MaterialError(`YAML 无法解析：${error.message}`)
      throw error
    }
  }
  if (!isRecord(document)) throw new MaterialError('材料根节点必须是映射')

  const warnings: string[] = []
  const input: NurseRecordInput = {
    target,
    episode: parseEpisode(document.episode, warnings),
    records: asArray(document.records, 'records').map((entry, index) => parseRecord(entry, index, warnings)),
    orders: asArray(document.orders, 'orders').map((entry, index) => parseOrder(entry, index, warnings)),
    assessments: asArray(document.assessments, 'assessments').map((entry, index) => parseAssessment(entry, index, warnings)),
    warnings,
  }

  // Refuse silently-empty material: an empty patient episode must be reported as
  // unreadable rather than as "no findings".
  if (input.records.length === 0 && input.orders.length === 0 && input.assessments.length === 0) {
    throw new MaterialError('材料中没有 records、orders 或 assessments 任何一项，无法执行检查')
  }

  const known = new Set<string>(ALL_RECORD_KINDS)
  const unknownKinds = input.records.filter((entry) => !known.has(entry.kind))
  if (unknownKinds.length > 0) warnings.push(`有 ${unknownKinds.length} 条记录的 kind 无法识别，按 other 处理`)

  return input
}
