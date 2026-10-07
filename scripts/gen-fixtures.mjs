/**
 * One-shot generator for the remaining rule-pair fixtures of
 * `dsh-nurse-record-check`. Run once, inspect the output, then delete.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'tests', 'fixtures')

const EPISODE = {
  admittedAt: '2026-03-15 08:00',
  patientLabel: '样本患者甲',
  careLevel: 'level-2',
}

function yamlEpisode(extra = '') {
  return [
    'episode:',
    `  admittedAt: "${EPISODE.admittedAt}"`,
    `  patientLabel: ${EPISODE.patientLabel}`,
    `  careLevel: ${EPISODE.careLevel}`,
    extra,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

const caselist = [
  {
    ruleId: 'NR-002',
    purpose: '材料中的时间字段应可解析',
    compliant: {
      name: 'readable-timestamp',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0002',
        '    kind: rescue',
        '    recordedAt: "2026-03-15 10:15"',
        '    rescueEndedAt: "2026-03-15 09:40"',
        '    nurseId: N10231',
      ].join('\n'),
    },
    unsafe: {
      name: 'chinese-date-timestamp',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0002',
        '    kind: general',
        '    recordedAt: "2026年3月15日 10:15"',
        '    nurseId: N10231',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-003',
    purpose: '抢救记录的时间应精确到分钟',
    compliant: {
      name: 'rescue-with-minute',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0003',
        '    kind: rescue',
        '    recordedAt: "2026-03-15 14:20"',
        '    rescueEndedAt: "2026-03-15 13:50"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-15 09:00"',
        '  - kind: 跌倒风险评估',
        '    completedAt: "2026-03-15 09:10"',
        '  - kind: 压疮风险评估',
        '    completedAt: "2026-03-15 09:20"',
      ].join('\n'),
    },
    unsafe: {
      name: 'rescue-day-only',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0003',
        '    kind: rescue',
        '    recordedAt: "2026-03-15"',
        '    rescueEndedAt: "2026-03-15 13:50"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-15 09:00"',
        '  - kind: 跌倒风险评估',
        '    completedAt: "2026-03-15 09:10"',
        '  - kind: 压疮风险评估',
        '    completedAt: "2026-03-15 09:20"',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-004',
    purpose: '抢救记录应在抢救结束后规定时限内补记',
    compliant: {
      name: 'rescue-written-in-window',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0004',
        '    kind: rescue',
        '    recordedAt: "2026-03-15 19:30"',
        '    rescueEndedAt: "2026-03-15 14:30"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-15 09:00"',
        '  - kind: 跌倒风险评估',
        '    completedAt: "2026-03-15 09:10"',
        '  - kind: 压疮风险评估',
        '    completedAt: "2026-03-15 09:20"',
      ].join('\n'),
    },
    unsafe: {
      name: 'rescue-written-late',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0004',
        '    kind: rescue',
        '    recordedAt: "2026-03-15 22:30"',
        '    rescueEndedAt: "2026-03-15 14:30"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-15 09:00"',
        '  - kind: 跌倒风险评估',
        '    completedAt: "2026-03-15 09:10"',
        '  - kind: 压疮风险评估',
        '    completedAt: "2026-03-15 09:20"',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-005',
    purpose: '临时医嘱执行后应有执行时间与执行人签名',
    compliant: {
      name: 'temporary-order-signed',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1001',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    text: 0.9%氯化钠注射液 100ml ivgtt st',
        '    execution:',
        '      executedAt: "2026-03-15 10:20"',
        '      nurseId: N10231',
        '      outcome: executed',
      ].join('\n'),
    },
    unsafe: {
      name: 'temporary-order-unsigned',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1001',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    text: 0.9%氯化钠注射液 100ml ivgtt st',
        '    execution:',
        '      executedAt: "2026-03-15 10:20"',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-006',
    purpose: '执行时间不应早于开立时间',
    compliant: {
      name: 'executed-after-ordered',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1002',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    execution:',
        '      executedAt: "2026-03-15 10:30"',
        '      nurseId: N10231',
      ].join('\n'),
    },
    unsafe: {
      name: 'executed-before-ordered',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1002',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    execution:',
        '      executedAt: "2026-03-15 09:40"',
        '      nurseId: N10231',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-007',
    purpose: '取消的医嘱应记录取消时间与原因',
    compliant: {
      name: 'cancellation-complete',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1003',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    execution:',
        '      outcome: cancelled',
        '    cancellation:',
        '      cancelledAt: "2026-03-15 10:10"',
        '      reason: 患者外出检查，医嘱停止执行',
        '      nurseId: N10231',
      ].join('\n'),
    },
    unsafe: {
      name: 'cancellation-without-reason',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1003',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    execution:',
        '      outcome: cancelled',
        '    cancellation:',
        '      cancelledAt: "2026-03-15 10:10"',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-008',
    purpose: '首次护理评估应在入院后规定时限内完成',
    compliant: {
      name: 'admission-assessment-in-time',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0008',
        '    kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-15 09:30"',
        '  - kind: 跌倒风险评估',
        '    completedAt: "2026-03-15 09:40"',
        '  - kind: 压疮风险评估',
        '    completedAt: "2026-03-15 09:50"',
      ].join('\n'),
    },
    unsafe: {
      name: 'admission-assessment-late',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0008',
        '    kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-16 15:00"',
        '  - kind: 跌倒风险评估',
        '    completedAt: "2026-03-16 15:10"',
        '  - kind: 压疮风险评估',
        '    completedAt: "2026-03-16 15:20"',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-009',
    purpose: '应留存跌倒与压疮风险评估记录',
    compliant: {
      name: 'both-risk-forms-present',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0009',
        '    kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-15 09:30"',
        '  - kind: 跌倒坠床风险评估',
        '    completedAt: "2026-03-15 09:40"',
        '  - kind: 压力性损伤风险评估',
        '    completedAt: "2026-03-15 09:50"',
      ].join('\n'),
    },
    unsafe: {
      name: 'pressure-ulcer-form-missing',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0009',
        '    kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
        'assessments:',
        '  - kind: 入院评估',
        '    completedAt: "2026-03-15 09:30"',
        '  - kind: 跌倒风险评估',
        '    completedAt: "2026-03-15 09:40"',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-010',
    purpose: '护理记录时间不应早于所记录事件的执行时间',
    compliant: {
      name: 'record-after-execution',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1004',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    execution:',
        '      executedAt: "2026-03-15 10:20"',
        '      nurseId: N10231',
        'records:',
        '  - id: REC-0010',
        '    kind: general',
        '    recordedAt: "2026-03-15 10:25"',
        '    orderId: ORD-1004',
        '    nurseId: N10231',
      ].join('\n'),
    },
    unsafe: {
      name: 'record-before-execution',
      body: [
        yamlEpisode(),
        'orders:',
        '  - id: ORD-1004',
        '    type: temporary',
        '    orderedAt: "2026-03-15 10:00"',
        '    execution:',
        '      executedAt: "2026-03-15 10:20"',
        '      nurseId: N10231',
        'records:',
        '  - id: REC-0010',
        '    kind: general',
        '    recordedAt: "2026-03-15 09:55"',
        '    orderId: ORD-1004',
        '    nurseId: N10231',
      ].join('\n'),
    },
  },
  {
    ruleId: 'NR-011',
    purpose: '分级护理护理记录的间隔不应超过配置阈值',
    compliant: {
      name: 'level-2-records-within-interval',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0011',
        '    kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
        '  - id: REC-0012',
        '    kind: general',
        '    recordedAt: "2026-03-15 18:00"',
        '    nurseId: N10231',
      ].join('\n'),
    },
    unsafe: {
      name: 'level-2-records-gap',
      body: [
        yamlEpisode(),
        'records:',
        '  - id: REC-0011',
        '    kind: general',
        '    recordedAt: "2026-03-15 09:00"',
        '    nurseId: N10231',
        '  - id: REC-0012',
        '    kind: general',
        '    recordedAt: "2026-03-16 06:00"',
        '    nurseId: N10231',
      ].join('\n'),
    },
  },
]

for (const entry of caselist) {
  const dir = join(root, entry.ruleId)
  await mkdir(dir, { recursive: true })
  const cases = {
    ruleId: entry.ruleId,
    purpose: entry.purpose,
    pairs: [
      {
        name: entry.compliant.name,
        material: `${entry.ruleId}-compliant.yaml`,
        expect: { ruleId: entry.ruleId, count: 0 },
      },
      {
        name: entry.unsafe.name,
        material: `${entry.ruleId}-unsafe.yaml`,
        expect: { ruleId: entry.ruleId, count: 1 },
      },
    ],
  }
  await writeFile(join(dir, 'cases.json'), `${JSON.stringify(cases, null, 2)}\n`, 'utf8')
  await writeFile(
    join(dir, `${entry.ruleId}-compliant.yaml`),
    `target: 内科三病区 2026-03-15 护理记录（${entry.ruleId} 合规样本）\n${entry.compliant.body}\n`,
    'utf8',
  )
  await writeFile(
    join(dir, `${entry.ruleId}-unsafe.yaml`),
    `target: 内科三病区 2026-03-15 护理记录（${entry.ruleId} 违规样本）\n${entry.unsafe.body}\n`,
    'utf8',
  )
  process.stdout.write(`wrote fixtures for ${entry.ruleId}\n`)
}
