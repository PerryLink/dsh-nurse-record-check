# dsh-nurse-record-check — 护理记录时限、签名与评估表完整性校验

`dsh-nurse-record-check` 读取一次住院过程的机器可读导出材料——护理记录、医嘱与已完成的评估表——核对这份护理记录的时限、签名与评估表留存，逐条报出与所引条款的字面差异：每条护理记录是否留下可追溯的记录人与时间、日期与时间是否按 24 小时制书写且可解析、抢救记录的时间是否精确到分钟且是否在抢救结束后 6 小时内补记、临时医嘱是否记录执行时间与执行护士签名、取消的医嘱是否记录取消信息、首次护理评估与护理记录书写频次是否满足本机构配置的阈值、跌倒与压力性损伤风险评估表是否留存、巡视间隔是否与该记录所载护理级别对应的分级护理指导原则相符。无法执行的检查计入 `skipped`，不会静默通过。

## 它回答什么问题

| 你会问 | 它怎么答 |
|---|---|
| 有一条护理记录导出时没有签名护士，会被报出吗？ | 会。`NR-001` 会报出没有留下记录人标识的护理记录，也会报出不符合所配置工号格式的 `nurseId`。它只核对材料是否留下记录人标识与时间，不校验电子签名的技术实现。 |
| 导出文件里有一个时间值解析不了，这条规则怎么处理？ | `NR-002` 会报出该值，并要求时间按 24 小时制书写、可解析为 `YYYY-MM-DD HH:mm`。解析不了时间的记录随后不参与各条时限比对，所以它只在这里出现，不会变成一条时限差异——本条核对的是时间能否读出，不是时间是否真实。 |
| 抢救记录只写了抢救日期，没有具体时刻。 | `NR-003` 会报出只精确到日的 `rescue` 记录，因为抢救时间应当具体到分钟。规则库说明：它引用的两份文件要求的对象并不相同——一份要求「抢救时间」具体到分钟，另一份要求的是「记录时间」——故合并呈现并分别标注出处。 |
| 抢救记录第二天早上才补记，算超时吗？ | `NR-004` 拿记录时间与 `rescueEndedAt` 相比，间隔超过 6 小时即报出；书写时间早于抢救结束时间也会报出。没有 `rescueEndedAt` 时无从比对，本条会报告无法执行，而不是通过。 |
| 一条临时医嘱执行了，但执行护士签名栏是空的。 | `NR-005` 会报出执行记录缺执行时间或执行护士签名的临时医嘱。它只针对临时医嘱——长期医嘱单的内容项不同，不得互相套用——也不检查执行后多久签名，因为国家规范没有规定签名时限。 |
| 有些规则的结果是 `skipped` 而不是通过，说明什么？ | 说明该检查没有执行，不等于通过。`NR-008` 与 `NR-012` 的阈值（`maxAfterAdmission`、`intervalHours`）出厂为空，因为规则库没有找到可适用于护理记录的国家层面阈值——它同时写明：找到的 24 小时针对的是医师书写的入院记录，不得套用到首次护理评估上——`NR-011` 在特级护理下同样报告 `skipped`，因为指导原则未给出具体间隔，可比的 `rounds` 记录少于两条时也不执行。 |

## 依据的标准

| 文件 | 文号 | 引用它的规则 |
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

| 项目 | 状态 |
|---|---|
| Harness | 对等版本范围 `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` —— 已实测同时接受 `0.2.0-rc.2` 与 `0.2.1-alpha.1`。**刻意不声明 `engines.dsh`**：它没有任何读取者，也无法拒装任何宿主 |
| Node | `^22.19.0 || >=24.0.0` |
| 平台 | 全平台（纯 ESM；无原生代码、无联网、不调用模型） |
| 工具模式 | `native` / `ptc` / `both` 均可；批量校验整个目录时建议 `ptc`，schema 成本只付一次 |

## What it does

规则表、字段说明与行为细节见 [README.md](README.md#what-it-does)（英文主版本）。本插件只列出材料与所引条款之间的字面差异，并对无法执行的检查在 `skipped` 中逐项说明。

## Install

```sh
dsh plugin --profile <name> add dsh-nurse-record-check
dsh --profile <name> --dump-config | grep 'dsh-nurse-record-check'
```

## Configuration

全部可调参数都在 `src/config.ts` 的 Schemastery schema 中，只改 `cordis.yml` 即可生效，无需改代码；逐条阈值在 `rules/` 下的规则库文件里。

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `rulesFile` | string | `rules/nurse-record.yaml` | 规则库文件路径，相对插件包根目录 |
| `disabledRules` | string[] | `[]` | 要停用的规则 id 列表；每条都会出现在 `skipped` 中 |
| `onlyRules` | string[] | `[]` | 只执行这些规则 id；留空表示执行全部规则 |
| `skipNotes` | string | `""` | 附加到每条 `skipped` 说明后的备注 |
| `timeoutMs` | number | `120000` | 工具协作式超时预算（毫秒） |

## Material format

支持 JSON 与 YAML。完整字段示例见 [README.md](README.md#material-format)（英文主版本）。字段在读取层是可选的，由检查引擎校验，因此部分导出的材料会产生"缺项"类差异，而不是让程序崩溃。

## Rule sources

规则数据与代码分离，每条规则都带文件名、文号、按原文自身编号体系的条款号、逐字摘录与来源地址。加载期强制：摘录必须是真实引文且不少于八个字符；依据仅为原则性条款（`kind: derived-from-principle`，严重级上限 `warn`）或本机构配置（`kind: institutional-configuration`，上限 `info`）的检查不得标为 `error`。夸大依据的规则库会在加载期失败，而不会产出一份看起来很有底气的报告。

核验中确认的边界与"刻意没有作出的结论"见 [README.md](README.md#rule-sources)（英文主版本）与随包的 `rules/evidence/` 目录。

## Troubleshooting

- **插件装上了但工具不出现**：确认 `main` 指向 `lib/index.mjs` 且 `pnpm run build` 已生成该文件；`main` 写错会让加载器静默跳过该条目。
- **`dsh plugin add` 报版本不兼容**：peer 范围覆盖 `0.1.x` 与 `0.2.x`；若运行时在其之外，可显式豁免：`dsh plugin --profile <name> allow-version <包名@版本> --dsh-version <runtime> --accept-risk`
- **某条规则没有执行**：查看 `skipped` 数组，其中写明了规则 id 与原因。
- **`check` 报 `manifest-peers` 失败**：静态检查器比对的是一份早于 0.2 世代的硬编码 peer 范围；安装期的 peer 校验以运行时为准。这是 `dsh-plugin-dev` 的已知上游问题。
- **时间看起来偏移**：全部计算都是对输入字符串做墙上时钟运算，不做时区换算。

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
node ../scripts/sync-shared.mjs dsh-nurse-record-check
```

第 4 项把 `../_shared` 的共享件同步进 `src/shared/`；每次改动共享件后都要重跑。

## License

[Apache License 2.0](LICENSE) © 2026 dsh-nurse-record-check contributors.
