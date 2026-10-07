/**
 * Input contract for the nursing-record checker.
 *
 * The tool does not parse `.docx` or `.xlsx` binaries. Ward systems export
 * either a JSON payload or a flat table, so the contract is a small, explicit
 * shape that a caller (or the bundled table reader) can fill in reliably.
 * Anything the contract cannot express is reported as `skipped` rather than
 * guessed.
 */

/** Item type of one nursing record entry. */
export type RecordKind =
  | 'rescue'      // 抢救记录
  | 'general'     // 一般护理记录
  | 'rounds'      // 巡视记录
  | 'handover'    // 交接班记录
  | 'discharge'   // 出院记录
  | 'other'

/** What the executing nurse did with the order. */
export type ExecutionOutcome = 'executed' | 'cancelled' | 'refused'

/** One nursing record entry. */
export interface NursingRecordEntry {
  /** Free-form identifier used for locators and diagnostics. */
  id?: string
  /** Item type; governs which time-precision and time-window rules apply. */
  kind: RecordKind
  /** Wall-clock time the entry was written, `YYYY-MM-DD HH:mm`. */
  recordedAt: string
  /** 1-based row in the source table, when the input was tabular. */
  row?: number
  /** Ward the entry belongs to. */
  ward?: string
  /** Signing nurse identifier. */
  nurseId?: string
  /** Signing nurse display name. */
  nurseName?: string
  /** Time the rescue ended; only meaningful for `kind: 'rescue'`. */
  rescueEndedAt?: string
  /** Order id this entry documents, when it documents one. */
  orderId?: string
  /** Entry body, used for free-text presence checks. */
  text?: string
}

/** One medical order and its execution state. */
export interface MedicalOrder {
  id: string
  /** `temporary` = 临时医嘱 (one-off); `long-term` = 长期医嘱 (standing). */
  type: 'temporary' | 'long-term'
  /** Wall-clock time the order was placed. */
  orderedAt: string
  /** 1-based row in the source table, when the input was tabular. */
  row?: number
  /** Order body, e.g. `0.9%氯化钠注射液 100ml ivgtt st`. */
  text?: string
  /** Prescribing clinician. */
  prescriber?: string
  execution?: {
    /** Wall-clock time the order was carried out. */
    executedAt?: string
    /** Nurse who carried it out. */
    nurseId?: string
    /** Outcome recorded by the executing nurse. */
    outcome?: ExecutionOutcome
  }
  cancellation?: {
    /** Wall-clock time the order was cancelled. */
    cancelledAt?: string
    /** Why it was cancelled. */
    reason?: string
    /** Nurse who recorded the cancellation. */
    nurseId?: string
  }
}

/** One completed assessment form. */
export interface AssessmentForm {
  /** Free-text form name; matched against the shared synonym map. */
  kind: string
  /** Canonical kind resolved by the reader, when it recognized the name. */
  canonicalKind?: string
  /** Wall-clock time the form was completed. */
  completedAt: string
  /** 1-based row in the source table, when the input was tabular. */
  row?: number
  /** Assessed score, when the form carries one. */
  score?: number
  /** Nurse who completed it. */
  nurseId?: string
}

/** Patient-level facts the time-window rules need. */
export interface EpisodeFacts {
  /** Admission wall-clock time. */
  admittedAt?: string
  /** Discharge wall-clock time. */
  dischargedAt?: string
  /** Care level in force; drives the documentation-frequency check. */
  careLevel?: 'special' | 'level-1' | 'level-2' | 'level-3'
  /** Patient display name, used only for the report header. */
  patientLabel?: string
}

/** The whole normalized input. */
export interface NurseRecordInput {
  /** Source description rendered as the report target. */
  target: string
  episode: EpisodeFacts
  records: NursingRecordEntry[]
  orders: MedicalOrder[]
  assessments: AssessmentForm[]
  /** Diagnostics from the reader: what it could not map or interpret. */
  warnings: string[]
}

/** The record kinds for which a minute-precision timestamp is required. */
export const MINUTE_PRECISION_KINDS: readonly RecordKind[] = ['rescue']

/** All record kinds, in the order the report lists them. */
export const ALL_RECORD_KINDS: readonly RecordKind[] = [
  'rescue',
  'general',
  'rounds',
  'handover',
  'discharge',
  'other',
]

/** Narrow an arbitrary string to a known record kind. */
export function toRecordKind(raw: string): RecordKind {
  const text = raw.trim().toLowerCase()
  const table: Record<string, RecordKind> = {
    rescue: 'rescue',
    抢救: 'rescue',
    抢救记录: 'rescue',
    general: 'general',
    一般: 'general',
    护理记录: 'general',
    一般护理记录: 'general',
    rounds: 'rounds',
    巡视: 'rounds',
    巡视记录: 'rounds',
    handover: 'handover',
    交接班: 'handover',
    交接班记录: 'handover',
    discharge: 'discharge',
    出院: 'discharge',
    出院记录: 'discharge',
    other: 'other',
    其他: 'other',
  }
  return table[text] ?? 'other'
}
