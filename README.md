# dsh-nurse-record-check

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
pnpm pack
dsh plugin --profile <name> add ./dsh-nurse-record-check-0.1.0.tgz
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
