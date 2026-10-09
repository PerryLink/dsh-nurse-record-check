# dsh-nurse-record-check — Nursing record timeliness, sign-off and assessment-form completeness check

[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)

`dsh-nurse-record-check` reads a machine-readable export of one inpatient episode — nursing entries, medical orders and completed assessment forms — and checks the timeliness, sign-off and assessment-form record of that nursing documentation (护理记录), reporting literal mismatches against cited clauses: that every nursing entry leaves a traceable recorder and a time, that every date and time is written in 24-hour form and can be read, that a rescue record's time is precise to the minute and its note is written up within 6 hours of the rescue ending, that a temporary order carries an execution time and the executing nurse's signature and that a cancelled order records its cancellation, that the first nursing assessment and the documentation frequency meet the thresholds the institution configures, that fall-risk and pressure-injury assessment forms are on file, and that the rounds interval matches the graded-nursing guidance for the care level the record states. A check that cannot run is listed in `skipped` instead of passing.

## What it looks like

![Terminal demo of dsh-nurse-record-check: real output over its NR-007 fixture](https://raw.githubusercontent.com/PerryLink/dsh-nurse-record-check/main/docs/assets/dsh-nurse-record-check-demo.png)

Real output from this plugin over its own `NR-007` test fixture — not a mock-up. The rule pack ships no invented quotations, so a finding names both the clause it applied and the fact that the clause text was not obtained.

## What it answers

| You ask | What it answers |
|---|---|
| A nursing entry came out of the ward system with no signing nurse. Is that reported? | Yes. `NR-001` reports every nursing entry that leaves no recorder identifier, and also a `nurseId` that does not match the configured staff-number pattern. It checks that the material leaves a recorder mark and a time, not how the electronic signature is technically implemented. |
| One time value in the export will not parse. What does the rule do with it? | `NR-002` reports the value and expects a time written in 24-hour form and readable as `YYYY-MM-DD HH:mm`. A record whose time cannot be parsed is then left out of the later time-window comparisons, so it surfaces here rather than as a deadline finding — the rule checks that the time can be read, not that it is the true time. |
| Our rescue record gives the date of the rescue but no clock time. | `NR-003` reports a `rescue` record whose time is precise only to the day, because the time of a rescue must be precise to the minute. The pack notes that the two documents it cites do not require the same thing — one requires 抢救时间 to the minute, the other the 记录时间 — and presents them together with each source marked separately. |
| The rescue note was written up the next morning. Is that late? | `NR-004` compares the recorded time with `rescueEndedAt` and reports a gap longer than 6 hours; a note written before the rescue ended is reported too. With no `rescueEndedAt` there is nothing to compare, and the check reports that it could not run instead of passing. |
| A temporary order was carried out, but the executing nurse's signature column is blank. | `NR-005` reports a temporary order whose execution record is missing the execution time or the executing nurse's signature. It applies to 临时医嘱 only — the long-term order sheet carries different content items and must not be read alike — and it does not check how long after execution the signature was made, because the pack found no signature deadline. |
| Some rules come back as `skipped` rather than passing. What does that mean? | It means the check did not run, not that it passed. `NR-008` and `NR-012` ship with their thresholds empty (`maxAfterAdmission`, `intervalHours`), because the pack found no national threshold it could apply to nursing records — and it records that the 24 hours it did find belongs to the 入院记录 written by a physician and must not be carried over to the first nursing assessment — while `NR-011` likewise reports itself in `skipped` for 特级护理, where the guidance states no interval, and when there are fewer than two `rounds` entries to compare. |

## Standards it follows

| Document | Number | Cited by rules |
|---|---|---|
| 《电子病历应用管理规范（试行）》 | 国卫办医发〔2017〕8号 | NR-001, NR-006, NR-010 |
| 《病历书写基本规范》 | 卫医政发〔2010〕11号 | NR-002, NR-003, NR-004, NR-005, NR-007, NR-010, NR-012 |
| 《医疗质量安全核心制度要点》 | 国卫医发〔2018〕8号 | NR-003, NR-004 |
| 《卫生部办公厅关于在医疗机构推行表格式护理文书的通知》 | 卫办医政发〔2010〕125号 | NR-005 |
| 《护理分级标准》 | WS/T 431—2023（全部代替 WS/T 431—2013；推荐性卫生行业标准，2024-02-01 施行） | NR-008 |
| 《进一步改善护理服务行动计划（2023—2025年）》 | 国卫医政发〔2023〕16号 | NR-009 |
| 《三级医院评审标准（2020年版）》 | 国卫医发〔2020〕26号 | NR-009 |
| 《综合医院分级护理指导原则（试行）》 | 卫医政发〔2009〕49号 | NR-011 |

**Boundary:** this plugin checks the timeliness, sign-off and assessment-form record of **nursing**
documentation (护理记录) in an **inpatient** episode. It is not `dsh-medrec-qc` (which checks the
front sheet of the medical record and its internal contradictions), not a nursing-quality
scorecard, and not a clinical decision aid. It reads a machine-readable export and reports literal
mismatches against cited clauses; it never decides whether an episode of care was appropriate.

## Compatibility

| Surface | Status |
|---|---|
| Harness | Peer range `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` — verified to accept both `0.2.0-rc.2` and `0.2.1-alpha.1`. `engines.dsh` is deliberately not declared: it has no reader and cannot reject a host |
| Node | `^22.19.0 || >=24.0.0` |
| Platforms | All (plain ESM; no native code, no network, no model call) |
| Tool mode | Works in `native`, `ptc` and `both`; for a directory of episodes use `ptc` to pay schema cost once |

## What it does

Registers the `nurse_record_check` tool. It reads one patient episode — nursing entries, medical
orders and assessment forms — applies a versioned rule pack, and returns a report whose every
finding names the clause it came from.

| Rule | Check | Severity |
|---|---|---|
| `NR-001` | every nursing entry carries a traceable recorder (id and time) | error |
| `NR-002` | every date/time in the material is written in 24-hour form and is readable | error |
| `NR-003` | rescue-note times are precise to the minute | error |
| `NR-004` | a rescue note is written up within 6 hours of the rescue ending | error |
| `NR-005` | a temporary order carries an execution time and the executing nurse's signature | error |
| `NR-006` | an execution time is not earlier than the order's placement time | info |
| `NR-007` | a cancelled order records its cancellation and signature | error |
| `NR-008` | the first nursing assessment meets the **locally configured** window | info |
| `NR-009` | fall-risk and pressure-injury forms are on file | warn |
| `NR-010` | a record's timestamp is not earlier than the event it documents | info |
| `NR-011` | the rounds interval matches the graded-nursing guidance for the care level | error |
| `NR-012` | documentation frequency meets the **locally configured** policy | info |

Two rules ship unconfigured on purpose, because no national threshold exists for them. They report
themselves in `skipped` and never silently pass.

## Install

```sh
dsh plugin --profile <name> add dsh-nurse-record-check
dsh --profile <name> --dump-config | grep 'dsh-nurse-record-check'
```

## Configuration

Every tunable lives in the Schemastery schema in `src/config.ts`, so it can be changed from
`cordis.yml` without editing code.

| Key | Type | Default | Description |
|---|---|---|---|
| `rulesFile` | string | `rules/nurse-record.yaml` | Rule-pack path, relative to the package root |
| `disabledRules` | string[] | `[]` | Rule ids to stop running; each appears in `skipped` |
| `onlyRules` | string[] | `[]` | Run only these rule ids; empty runs every rule |
| `skipNotes` | string | `""` | Note appended to every `skipped` reason |
| `timeoutMs` | number | `120000` | Cooperative tool timeout budget |

## Material format

The tool accepts JSON or YAML. A docx or xlsx binary is not parsed: ward systems export either a
JSON payload or a flat table, and the contract below is what a caller (or your own converter) fills
in. Fields are optional at the reader level and validated by the check engine, so a partial export
produces findings about the missing parts instead of a crash.

```yaml
target: 内科三病区 2026-03-15 护理记录
episode:
  admittedAt: "2026-03-15 08:00"   # drives NR-008
  careLevel: level-2               # drives NR-011 / NR-012
  patientLabel: 样本患者甲
records:
  - id: REC-0001
    kind: rescue                   # rescue | general | rounds | handover | discharge | other
    recordedAt: "2026-03-15 14:20"
    rescueEndedAt: "2026-03-15 13:50"
    nurseId: N10231
    orderId: ORD-1001              # links a record to an order for NR-010
orders:
  - id: ORD-1001
    type: temporary                # temporary | long-term
    orderedAt: "2026-03-15 10:00"
    execution: { executedAt: "2026-03-15 10:20", nurseId: N10231, outcome: executed }
    cancellation: { cancelledAt: "2026-03-15 10:10", reason: 患者外出检查 }
assessments:
  - kind: 跌倒坠床风险评估          # matched through the shared synonym map
    completedAt: "2026-03-15 09:40"
```

## Rule sources

Rule data lives in `rules/nurse-record.yaml` and is separate from code. Every rule carries a
document, a document number, a clause in the source's own numbering, a verbatim excerpt and the URL
the excerpt was read from. The loader enforces three things: an excerpt must be a real quotation, an
excerpt under eight characters is rejected, and a check whose basis is only a general principle
(`kind: derived-from-principle`, capped at `warn`) or a local policy
(`kind: institutional-configuration`, capped at `info`) may never be declared `error`. A pack that
overstates its basis fails to load instead of producing a confident-looking report.

Clause numbers were checked against full texts of: 《病历书写基本规范》（卫医政发〔2010〕11号）,
《综合医院分级护理指导原则（试行）》（卫医政发〔2009〕49号）, 《电子病历应用管理规范（试行）》
（国卫办医发〔2017〕8号）, 《医疗质量安全核心制度要点》（国卫医发〔2018〕8号）,
《进一步改善护理服务行动计划（2023—2025年）》（国卫医政发〔2023〕16号） and
《护理分级标准》（WS/T 431—2023）.

Three findings from that verification shaped the pack, and are recorded here so a reviewer can see
what was deliberately **not** claimed:

1. **No national documentation-frequency rule exists.** WS/T 431—2023 deleted the "implementation
   requirements" chapter of its 2013 edition, and the graded-nursing guidance states a *rounds*
   interval, never a *documentation* frequency. `NR-012` therefore ships with an empty threshold.
2. **No national deadline exists for the first nursing assessment.** The 24-hour rule in Article 17
   of 卫医政发〔2010〕11号 governs the physician's admission note, not a nursing assessment; applying
   it here would be a mis-citation. `NR-008` therefore ships with an empty threshold.
3. **No clause forbids a record time earlier than an execution time.** `NR-010` rests on the
   general duty in Article 3 and is capped at `info` for that reason.

## Troubleshooting

- **The plugin installs but the tool never appears.** Check `main` resolves to `lib/index.mjs` and
  that `pnpm run build` produced it; a wrong `main` makes the loader skip the entry silently.
- **`dsh plugin add` refuses the package as incompatible.** The peer range covers `0.1.x` and
  `0.2.x`; if your runtime sits outside it, grant an explicit exemption:
  `dsh plugin --profile <name> allow-version dsh-nurse-record-check@0.1.0 --dsh-version <runtime> --accept-risk`
- **A rule you expected did not run.** Read the `skipped` array; it names the rule and why. Rules
  `NR-008` and `NR-012` stay skipped until their thresholds are configured.
- **`check` reports `manifest-peers` as failed.** The static checker compares against a hard-coded
  peer range that predates the 0.2 line. The runtime enforces peer compatibility at install time, so
  the declared range is the correct one; this is a known upstream issue in `dsh-plugin-dev`.
- **Times look shifted.** All arithmetic is wall-clock on the strings you supply, with no time-zone
  conversion: a record means the local time that was written down.

## Development

```sh
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm test            # vitest, paired fixtures per rule
pnpm run build       # tsdown -> lib/index.mjs + lib/index.d.mts
node ../scripts/sync-shared.mjs dsh-nurse-record-check   # refresh src/shared from ../_shared
```

## License

[Apache License 2.0](LICENSE) © 2026 dsh-nurse-record-check contributors.
