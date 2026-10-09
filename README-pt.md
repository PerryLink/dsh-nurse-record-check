# dsh-nurse-record-check — Verificação de prazos, assinaturas e formulários de avaliação no registo de enfermagem

[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)

`dsh-nurse-record-check` lê uma exportação legível por máquina de um episódio de internamento —registos de enfermagem, ordens médicas e formulários de avaliação preenchidos— e verifica os prazos, as assinaturas e a conservação de formulários dessa documentação de enfermagem (护理记录), assinalando as diferenças literais face às cláusulas citadas: que cada registo de enfermagem deixe um responsável e uma hora rastreáveis, que toda a data e hora esteja escrita em formato de 24 horas e possa ser lida, que a hora de um registo de reanimação seja precisa ao minuto e a sua nota seja escrita nas 6 horas seguintes ao fim da reanimação, que uma ordem temporária traga hora de execução e a assinatura da enfermeira que a executou e que uma ordem anulada registe o seu cancelamento, que a primeira avaliação de enfermagem e a frequência de documentação cumpram os limiares que a instituição configurar, que os formulários de risco de queda e de lesão por pressão estejam arquivados, e que o intervalo entre rondas de vigilância corresponda à orientação de cuidados graduados do nível de cuidados indicado no registo. Uma verificação que não pode ser executada é listada em `skipped` em vez de passar.

## Como é a saída

![Terminal demo of dsh-nurse-record-check: real output over its NR-007 fixture](https://raw.githubusercontent.com/PerryLink/dsh-nurse-record-check/main/docs/assets/dsh-nurse-record-check-demo.png)

Saída real deste plugin sobre o seu próprio fixture de teste `NR-007` — não é uma simulação. O pacote de regras não inventa citações, por isso cada achado nomeia a cláusula aplicada e avisa que o seu texto não foi obtido.

## O que ele responde

| Você pergunta | O que ele responde |
|---|---|
| Um registo de enfermagem saiu do sistema da enfermaria sem enfermeira que o assine. Isso é assinalado? | Sim. `NR-001` assinala todo o registo de enfermagem que não deixa um identificador de responsável e também um `nurseId` que não corresponda ao formato de número profissional configurado. Verifica que o material deixa uma marca de responsável e uma hora, não como a assinatura eletrónica está tecnicamente implementada. |
| Um valor de hora da exportação não é analisável. O que a regra faz com ele? | `NR-002` assinala o valor e exige uma hora escrita em formato de 24 horas e legível como `YYYY-MM-DD HH:mm`. O registo cuja hora não é analisável fica de fora das comparações de prazo seguintes, pelo que aparece aqui e não como uma diferença de prazo — a regra verifica que a hora pode ser lida, não que seja a hora verdadeira. |
| O nosso registo de reanimação indica a data, mas nenhuma hora. | `NR-003` assinala um registo do tipo `rescue` cuja hora só é precisa ao dia, porque a hora da reanimação deve ser precisa ao minuto. O pacote de regras indica que as duas disposições que cita não pedem o mesmo — uma exige a 「抢救时间」 ao minuto e a outra o 「记录时间」 — e apresenta-as em conjunto, com cada fonte assinalada em separado. |
| A nota de reanimação foi escrita na manhã seguinte. É tarde? | `NR-004` compara a hora registada com `rescueEndedAt` e assinala um intervalo superior a 6 horas; também assinala uma nota escrita antes de a reanimação terminar. Sem `rescueEndedAt` não há nada a comparar, e a verificação informa que não pôde ser executada em vez de passar. |
| Uma ordem temporária foi executada, mas o campo de assinatura da enfermeira que a executou está vazio. | `NR-005` assinala uma ordem temporária cujo registo de execução não tem a hora de execução nem a assinatura da enfermeira que a executou. Aplica-se apenas às ordens temporárias — a folha de ordens de longo prazo tem outros elementos e não pode ser lida da mesma forma — e não verifica quanto tempo depois da execução a assinatura foi feita, porque o pacote não encontrou qualquer prazo de assinatura. |
| Algumas regras aparecem como `skipped` em vez de passar. O que significa? | Significa que a verificação não foi executada, não que tenha passado. `NR-008` e `NR-012` trazem os seus limiares vazios (`maxAfterAdmission`, `intervalHours`), porque o pacote não encontrou qualquer limiar nacional aplicável aos registos de enfermagem — e regista que as 24 horas que encontrou são do 「入院记录」 escrito pelo médico e não podem ser transportas para a primeira avaliação de enfermagem —; `NR-011` também se assinala como `skipped` em cuidados especiais (特级护理), onde a orientação não fixa intervalo, e quando há menos de dois registos de `rounds` a comparar. |

## Normas que segue

| Documento | Número | Regras que o citam |
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

| Superfície | Estado |
|---|---|
| Harness | Faixa de peers `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` — verificada para aceitar tanto `0.2.0-rc.2` quanto `0.2.1-alpha.1`. **`engines.dsh` não é declarado**: não tem leitor e não pode recusar nenhum host |
| Node | `^22.19.0 || >=24.0.0` |
| Plataformas | Todas (ESM puro; sem código nativo, sem rede, sem chamada ao modelo) |
| Modo de ferramenta | Funciona em `native`, `ptc` e `both`; para um diretório inteiro use `ptc` |

## What it does

A tabela de regras, os campos e o comportamento detalhado estão em [README.md](README.md#what-it-does) (versão principal em inglês). O plugin apenas lista divergências literais frente às cláusulas citadas e indica em `skipped` cada verificação que não pôde ser executada.

## Install

```sh
dsh plugin --profile <name> add dsh-nurse-record-check
dsh --profile <name> --dump-config | grep 'dsh-nurse-record-check'
```

## Configuration

Todos os parâmetros ajustáveis ficam no esquema Schemastery de `src/config.ts`, portanto mudam pelo `cordis.yml` sem editar código; os limites por regra ficam no pacote de regras sob `rules/`.

| Chave | Tipo | Padrão | Descrição |
|---|---|---|---|
| `rulesFile` | string | `rules/nurse-record.yaml` | Caminho do pacote de regras, relativo à raiz do pacote |
| `disabledRules` | string[] | `[]` | Ids de regras a desativar; cada uma aparece em `skipped` |
| `onlyRules` | string[] | `[]` | Executar apenas estas regras; vazio executa todas |
| `skipNotes` | string | `""` | Nota acrescentada a cada motivo de `skipped` |
| `timeoutMs` | number | `120000` | Orçamento de tempo limite cooperativo da ferramenta |

## Material format

Aceita JSON ou YAML. O exemplo completo de campos está em [README.md](README.md#material-format) (versão principal em inglês). Os campos são opcionais na camada de leitura e validados pelo motor, de modo que uma exportação parcial gera achados sobre o que falta em vez de falhar.

## Rule sources

Os dados das regras ficam separados do código: cada regra traz documento, número, cláusula na numeração própria da fonte, trecho literal e URL de origem. O carregador impõe que o trecho seja citação real de pelo menos oito caracteres e que uma verificação baseada apenas em princípio geral (`kind: derived-from-principle`, teto `warn`) ou em política local (`kind: institutional-configuration`, teto `info`) nunca seja declarada `error`.

Os limites verificados e as conclusões deliberadamente **não** afirmadas estão em [README.md](README.md#rule-sources) (versão principal em inglês) e em `rules/evidence/`.

## Troubleshooting

- **O plugin instala mas a ferramenta não aparece**: confirme que `main` resolve para `lib/index.mjs` e que `pnpm run build` o gerou.
- **`dsh plugin add` recusa o pacote**: a faixa de peers cobre `0.1.x` e `0.2.x`; fora dela, conceda isenção explícita com `dsh plugin --profile <name> allow-version <pkg@ver> --dsh-version <runtime> --accept-risk`.
- **Uma regra não executou**: leia o arranjo `skipped`.
- **`check` informa `manifest-peers` como falha**: problema conhecido do `dsh-plugin-dev`; o runtime aplica a compatibilidade na instalação.
- **Os horários parecem deslocados**: toda a aritmética é de hora local sobre as cadeias fornecidas.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
node ../scripts/sync-shared.mjs dsh-nurse-record-check
```

O último comando copia o kit compartilhado de `../_shared` para `src/shared/`; execute-o novamente após cada alteração compartilhada.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-nurse-record-check contributors.
