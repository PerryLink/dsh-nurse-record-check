<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/dsh-nurse-record-check-hero-en-dark.webp">
  <img src="docs/assets/dsh-nurse-record-check-hero-en-light.webp" width="100%" alt="Banner do dsh-nurse-record-check: à esquerda, o nome e o valor; à direita, uma folha de registo de enfermagem onde REC-0002 não tem profissional que assine e é marcado como NR-001 error, e faltam os formulários de risco de queda e de úlcera por pressão (NR-009 warn ×2); abaixo, o cartão de ocorrência NR-001 (found / expected / basis, com o artigo 14 citado) e a gaveta skipped (NR-008 maxAfterAdmission e NR-012 intervalHours não configurados, 10 omitidas); a execução de exemplo dá 3 diferenças (1 error / 2 warn); uma lista de diferenças vazia não é uma aprovação e a decisão fica com quem revê.">
</picture>

# dsh-nurse-record-check

**Transforma o registo de enfermagem de um internamento numa lista de diferenças revisáveis linha a linha, cada uma com a cláusula que a sustenta.**

Um verificador local para serviços de enfermagem e enfermeiras-chefes: lê uma exportação estruturada de registos de enfermagem, ordens médicas e formulários de avaliação, verifica prazos, assinaturas e conservação de formulários contra um pacote de regras versionado, e apenas lista diferenças — nunca um veredicto de conformidade.

[Instalar](#instalação-em-três-passos) · [Configuração](#configuração) · [FAQ](#faq) · [简体中文](README.md) · [English](README.en.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache--2.0-3366CC?style=flat-square&labelColor=2B3245)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.1%20%3C0.3.0-4B67B4?style=flat-square&labelColor=2B3245)](#compatibilidade)
[![npm](https://img.shields.io/npm/v/dsh-nurse-record-check?style=flat-square&labelColor=2B3245&color=CB3837)](https://www.npmjs.com/package/dsh-nurse-record-check)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-nurse-record-check/ci.yml?branch=main&label=CI&style=flat-square&labelColor=2B3245)](https://github.com/PerryLink/dsh-nurse-record-check/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-339933?style=flat-square&labelColor=2B3245)](#compatibilidade)

[![Stars](https://img.shields.io/github/stars/PerryLink/dsh-nurse-record-check?style=flat-square&labelColor=2B3245)](https://github.com/PerryLink/dsh-nurse-record-check/stargazers)
[![npm downloads](https://img.shields.io/npm/dm/dsh-nurse-record-check?style=flat-square&labelColor=2B3245&color=CB3837)](https://www.npmjs.com/package/dsh-nurse-record-check)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-nurse-record-check?metric=downloads)](https://dshfind.com/en/plugins/PerryLink/dsh-nurse-record-check?ref=badge)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-nurse-record-check/badge)](https://securityscorecards.dev/viewer/?uri=github.com/PerryLink/dsh-nurse-record-check)
[![DSH Market](https://img.shields.io/badge/DSH_Market-listed-4B67B4?style=flat-square&labelColor=2B3245)](https://dsh.market/)

```sh
dsh plugin --profile <name> add dsh-nurse-record-check
```

</div>

<sub>Plugin da comunidade, não afiliado à DeepSeek. Repositório canónico: <https://github.com/PerryLink/dsh-nurse-record-check>.</sub>

## O que é

O `dsh-nurse-record-check` lê uma exportação legível por máquina de um episódio de internamento — registos de enfermagem, ordens médicas e formulários de avaliação preenchidos — e verifica os prazos, as assinaturas e a conservação de formulários dessa documentação de enfermagem, assinalando as diferenças literais face às cláusulas citadas: que cada registo de enfermagem deixe um responsável e uma hora rastreáveis, que toda a data e hora esteja escrita em formato de 24 horas e possa ser lida, que a hora de um registo de reanimação seja precisa ao minuto e a sua nota seja escrita nas 6 horas seguintes ao fim da reanimação, que uma ordem temporária traga hora de execução e a assinatura da enfermeira que a executou e que uma ordem anulada registe o seu cancelamento, que a primeira avaliação de enfermagem e a frequência de documentação cumpram os limiares que a instituição configurar, que os formulários de risco de queda e de lesão por pressão estejam arquivados, e que o intervalo entre rondas de vigilância corresponda à orientação de cuidados graduados do nível de cuidados indicado no registo. Uma verificação que não pode ser executada é listada em `skipped` em vez de passar. O pacote de regras é dado, não código: substituir `rules/nurse-record.yaml` muda o conjunto de regras, e o carregador rejeita um pacote cujos trechos não sejam literais ou cuja severidade exagere a sua base. O núcleo da verificação é uma função pura — sem rede, sem chamada ao modelo: você entrega o material e o original nunca é modificado. A verificação diária não exige linha de comandos: entregue o material à ferramenta `nurse_record_check` numa sessão.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/dsh-nurse-record-check-flow-v5-dark.svg">
  <img src="docs/assets/dsh-nurse-record-check-flow-v5-light.svg" width="100%" alt="Estrutura do dsh-nurse-record-check: doze regras numa matriz contra quatro superfícies de entrada (registos, ordens, avaliações, episódio), com um barramento vertical por superfície e um ponto onde a regra realmente lê essa coleção; a barra direita fixa o teto conforme o tipo de fundamento (direto ≤ error, princípio ≤ warn, configuração local ≤ info), os dois limiares que saem vazios (NR-008 maxAfterAdmission, NR-012 intervalHours) e a base de citações (8 documentos, 20 excertos literais); a barra inferior é o contrato do relatório: as diferenças levam ruleId / severity / locator / found / expected / basis, as verificações omitidas levam motivo, e uma lista vazia não é uma aprovação.">
</picture>

## Instalação em três passos

1. **Instalar** (escolha um canal):

   ```sh
   # canal git (último main; equivalente a git+https://github.com/PerryLink/dsh-nurse-record-check.git)
   dsh plugin --profile <name> add github:PerryLink/dsh-nurse-record-check
   # canal npm (versões publicadas)
   dsh plugin --profile <name> add dsh-nurse-record-check
   # canal tarball: pnpm pack neste repo e depois
   dsh plugin --profile <name> add ./dsh-nurse-record-check-<version>.tgz
   ```

2. **Configuração mínima** (o pacote de regras e os limiares padrão funcionam de fábrica):

   ```yaml
   - insert:
       - id: dsh-nurse-record-check
         name: dsh-nurse-record-check
   ```

   Acrescente `config` só para restringir a superfície de verificação; por exemplo, executar apenas as cinco primeiras regras:

   ```yaml
   - insert:
       - id: dsh-nurse-record-check
         name: dsh-nurse-record-check
         config:
           onlyRules: [NR-001, NR-002, NR-003, NR-004, NR-005]
   ```

3. **Verificar que monta**:

   ```sh
   dsh --profile <name> --dump-config | grep 'dsh-nurse-record-check'
   ```

   Depois execute o exemplo incluído sem rede (a saída deve coincidir com `samples/quickstart/expected/result.json`):

   ```sh
   pnpm run build
   node samples/quickstart/run.mjs --check
   ```

   ```text
   nurse_record_check: 3 issue(s) — error 1, warn 2, info 0
   skipped: 10
   ```

**Desinstalar**: `dsh plugin --profile <name> remove dsh-nurse-record-check` (ou remova a linha do patch do perfil).

<details>
<summary>Instalar pelo WorkBuddy / Coze</summary>

Procure o Medical Record QC Suite no WorkBuddy / Coze: esta verificação é uma das suas partes; a disponibilidade é a que constar na loja.

</details>

## Capacidades principais

O `dsh-nurse-record-check` transforma o material de enfermagem de um episódio numa lista de diferenças revisáveis, cada uma com id de regra, severidade, localizador e a cláusula citada:

- **Uma leitura, doze regras** — os registos, as ordens e os formulários de avaliação são lidos uma vez; depois `NR-001` a `NR-012` verificam prazos, assinaturas e conservação de formulários por ordem. A tabela de regras vem a seguir.
- **O pacote de regras é dado** — documento, número, cláusula, trecho literal e URL de origem vivem em `rules/nurse-record.yaml`; substitua esse ficheiro para mudar o conjunto de regras sem tocar no código.
- **Não poder executar não é passar** — toda a verificação que não pôde ser executada aparece em `skipped` com o motivo; uma lista de problemas vazia nunca é lida como «não falta nada».
- **Só diferenças, sem veredicto** — o relatório nomeia divergências literais face às cláusulas citadas; não decide conformidade, responsabilidade nem decisão clínica, e o guarda de redação bloqueia essa linguagem.
- **Núcleo local e de função pura** — `src/check.ts` é `(input, ruleset, options) => Report`, sem E/S, sem relógio e sem acesso ao modelo, pelo que todo o conjunto de regras é testável sem credenciais.

| Regra | O que verifica | Severidade |
|---|---|---|
| `NR-001` | cada registo de enfermagem deixa um responsável rastreável (id e hora) | error |
| `NR-002` | toda a data e hora do material está em formato de 24 horas e pode ser lida | error |
| `NR-003` | a hora da nota de reanimação é precisa ao minuto | error |
| `NR-004` | a nota de reanimação é escrita nas 6 horas seguintes ao fim da reanimação | error |
| `NR-005` | uma ordem temporária traz hora de execução e a assinatura da enfermeira que a executou | error |
| `NR-006` | a hora de execução não é anterior à hora de prescrição da ordem | info |
| `NR-007` | uma ordem anulada regista o seu cancelamento e assinatura | error |
| `NR-008` | a primeira avaliação de enfermagem cumpre a janela **configurada localmente** | info |
| `NR-009` | os formulários de risco de queda e de lesão por pressão estão arquivados | warn |
| `NR-010` | a marca temporal de um registo não é anterior ao evento que documenta | info |
| `NR-011` | o intervalo de rondas coincide com a orientação de cuidados graduados do nível de cuidados | error |
| `NR-012` | a frequência de documentação cumpre a política **configurada localmente** | info |

`NR-008` e `NR-012` saem de fábrica com os limiares vazios de propósito, porque o pacote não encontrou qualquer limiar nacional aplicável aos registos de enfermagem; informam-se a si mesmas em `skipped` e nunca passam em silêncio.

## Exemplos

O conjunto abaixo é o conjunto de exemplos: o primeiro bloco é o caso detalhado e a tabela cobre perguntas frequentes. Os exemplos vêm dos próprios fixtures de teste do plugin — não são simulações.

**Saída detalhada** — ferramenta `nurse_record_check`, entrada:

```yaml
records:
  - id: REC-0001
    kind: general
    recordedAt: "2026-03-15 09:00"
    nurseId: N10231
  - id: REC-0002
    kind: general
    recordedAt: "2026-03-15 11:00"
    nurseName: 李护士
```

Saída:

```json
{
  "id": "dsh-nurse-record-check.NR-001.185cc700",
  "ruleId": "NR-001",
  "severity": "error",
  "locator": {
    "cell": "REC-0002"
  },
  "found": "记录无签名护士标识",
  "expected": "每条护理记录均应有签名"
}
```

*Observado em `dsh-nurse-record-check/tests/fixtures/NR-001/NR-001-unsafe.yaml`*

| Você pergunta | O que ele responde |
|---|---|
| Um registo de enfermagem saiu do sistema da enfermaria sem enfermeira que o assine. Isso é assinalado? | Sim. `NR-001` assinala todo o registo de enfermagem que não deixa um identificador de responsável e também um `nurseId` que não corresponda ao formato de número profissional configurado. Verifica que o material deixa uma marca de responsável e uma hora, não como a assinatura eletrónica está tecnicamente implementada. |
| Um valor de hora da exportação não é analisável. O que a regra faz com ele? | `NR-002` assinala o valor e exige uma hora escrita em formato de 24 horas e legível como `YYYY-MM-DD HH:mm`. O registo cuja hora não é analisável fica de fora das comparações de prazo seguintes, pelo que aparece aqui e não como uma diferença de prazo — a regra verifica que a hora pode ser lida, não que seja a hora verdadeira. |
| O nosso registo de reanimação indica a data, mas nenhuma hora. | `NR-003` assinala um registo do tipo `rescue` cuja hora só é precisa ao dia, porque a hora da reanimação deve ser precisa ao minuto. O pacote indica que as duas disposições que cita não pedem o mesmo — uma exige a hora de reanimação ao minuto e a outra a hora de registo — e apresenta-as em conjunto, com cada fonte assinalada em separado. |
| A nota de reanimação foi escrita na manhã seguinte. É tarde? | `NR-004` compara a hora registada com `rescueEndedAt` e assinala um intervalo superior a 6 horas; também assinala uma nota escrita antes de a reanimação terminar. Sem `rescueEndedAt` não há nada a comparar, e a verificação informa que não pôde ser executada em vez de passar. |
| Uma ordem temporária foi executada, mas o campo de assinatura da enfermeira que a executou está vazio. | `NR-005` assinala uma ordem temporária cujo registo de execução não tem a hora de execução nem a assinatura da enfermeira que a executou. Aplica-se apenas às ordens temporárias — a folha de ordens de longo prazo tem outros elementos e não pode ser lida da mesma forma — e não verifica quanto tempo depois da execução a assinatura foi feita, porque o pacote não encontrou qualquer prazo de assinatura. |
| Algumas regras aparecem como `skipped` em vez de passar. O que significa? | Significa que a verificação não foi executada, não que tenha passado. `NR-008` e `NR-012` trazem os seus limiares vazios (`maxAfterAdmission`, `intervalHours`), porque o pacote não encontrou qualquer limiar nacional aplicável aos registos de enfermagem — e regista que as 24 horas que encontrou são do registo de admissão escrito pelo médico e não podem ser transportas para a primeira avaliação de enfermagem —; `NR-011` também se assinala como `skipped` em cuidados especiais, onde a orientação não fixa intervalo, e quando há menos de dois registos de `rounds` a comparar. |

## Configuração

Todos os parâmetros ajustáveis ficam no esquema Schemastery de `src/config.ts`, portanto mudam pelo `cordis.yml` sem editar código.

| Chave | Tipo | Padrão | Descrição |
|---|---|---|---|
| `rulesFile` | string | `rules/nurse-record.yaml` | Caminho do pacote de regras, relativo à raiz do pacote |
| `disabledRules` | string[] | `[]` | Ids de regras a desativar; cada uma aparece em `skipped` |
| `onlyRules` | string[] | `[]` | Executar apenas estas regras; vazio executa todas |
| `skipNotes` | string | `""` | Nota acrescentada a cada motivo de `skipped` |
| `timeoutMs` | number | `120000` | Orçamento de tempo limite cooperativo da ferramenta |

<details>
<summary>Os limiares vivem no pacote de regras, não na Config</summary>

A `Config` tem exatamente as cinco chaves acima. Os limiares por regra vivem em `params` dentro de `rules/nurse-record.yaml`, por exemplo `maxAfterAdmission` para `NR-008`, `intervalHours` para `NR-012` e `maxHours` para `NR-004`; ajuste-os ao substituir ou editar o pacote de regras.

</details>

Exemplo de substituição no patch do perfil:

```yaml
- insert:
    - id: dsh-nurse-record-check
      name: dsh-nurse-record-check
      config:
        disabledRules: [NR-011]
        skipNotes: a instituição ainda não adotou a verificação de rondas
        timeoutMs: 60000
```

## Formato do material

Aceita JSON e YAML. **Um binário docx ou xlsx não é analisado**: os sistemas de enfermaria exportam uma carga JSON ou uma tabela plana, e o contrato abaixo é o que quem chama (ou o seu próprio conversor) preenche. O Excel pode ser convertido primeiro para JSON/YAML, também no chat quando a plataforma o permitir. Os campos são opcionais na camada de leitura e validados pelo motor, de modo que uma exportação parcial gera achados sobre o que falta em vez de falhar.

```yaml
target: 内科三病区 2026-03-15 护理记录
episode:
  admittedAt: "2026-03-15 08:00"   # alimenta NR-008
  careLevel: level-2               # alimenta NR-011 / NR-012
  patientLabel: 样本患者甲
records:
  - id: REC-0001
    kind: rescue                   # rescue | general | rounds | handover | discharge | other
    recordedAt: "2026-03-15 14:20"
    rescueEndedAt: "2026-03-15 13:50"
    nurseId: N10231
    orderId: ORD-1001              # liga um registo a uma ordem para NR-010
orders:
  - id: ORD-1001
    type: temporary                # temporary | long-term
    orderedAt: "2026-03-15 10:00"
    execution: { executedAt: "2026-03-15 10:20", nurseId: N10231, outcome: executed }
    cancellation: { cancelledAt: "2026-03-15 10:10", reason: 患者外出检查 }
assessments:
  - kind: 跌倒坠床风险评估          # emparelhado pelo mapa de sinónimos partilhado
    completedAt: "2026-03-15 09:40"
```

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

**Limite:** este plugin verifica a pontualidade, a assinatura e o registo de formulários de avaliação da documentação de **enfermagem** num episódio de **internamento**. Não é o `dsh-medrec-qc` (que verifica a folha de rosto do processo clínico e as suas contradições internas), não é um cartão de pontuação de qualidade de enfermagem nem um auxiliar de decisão clínica. Lê uma exportação legível por máquina e assinala divergências literais face às cláusulas citadas; nunca decide se um episódio de cuidados foi adequado.

## Fontes das regras

Os dados das regras ficam separados do código: cada regra traz documento, número, cláusula na numeração própria da fonte, trecho literal e URL de origem. O carregador impõe três coisas: o trecho deve ser uma citação real, um trecho com menos de oito caracteres é rejeitado, e uma verificação baseada apenas em princípio geral (`kind: derived-from-principle`, teto `warn`) ou em política local (`kind: institutional-configuration`, teto `info`) nunca pode ser declarada `error`. Um pacote que exagera a sua base falha ao carregar em vez de produzir um relatório que pareça sólido.

Os números de cláusula foram verificados contra os textos completos dos oito documentos enumerados acima. Os registos de verificação por cláusula estão em `rules/evidence/`, com índice em [`rules/evidence/clause-verification.md`](rules/evidence/clause-verification.md).

Três achados dessa verificação moldaram o pacote e ficam registados aqui para que um revisor veja o que deliberadamente **não** foi afirmado:

1. **Não existe regra nacional de frequência de documentação.** A WS/T 431—2023 eliminou o capítulo de «requisitos de implementação» da edição de 2013, e a orientação de cuidados graduados fixa um intervalo de *rondas*, nunca uma frequência de *documentação*. Por isso `NR-012` sai com o limiar vazio.
2. **Não existe prazo nacional para a primeira avaliação de enfermagem.** A regra das 24 horas do artigo 17 das Normas básicas regula a nota de admissão do médico, não uma avaliação de enfermagem; aplicá-la aqui seria uma citação errada. Por isso `NR-008` sai com o limiar vazio.
3. **Nenhuma cláusula proíbe que a hora de registo seja anterior à de execução.** `NR-010` apoia-se no dever geral do artigo 3 e por isso tem o teto `info`.

## FAQ

<details>
<summary>O material é enviado ou conservado?</summary>

Não. É um verificador local: lê apenas o material que você entrega à ferramenta, não faz pedidos de rede nem chamadas ao modelo, e não inclui telemetria nem relatórios em segundo plano. Não escreve dados fora do resultado da ferramenta e do armazenamento de sessão/registos do próprio host DSH. O host controla esse armazenamento e a sua retenção; este pacote não acrescenta uma segunda cópia. Desinstalar o pacote remove o seu código; não apaga os registos de sessão do host nem os documentos que você já criou.

</details>

<details>
<summary>Uma lista de problemas vazia significa que o registo de enfermagem está conforme?</summary>

Não. Uma lista vazia nunca pode ser lida como «não falta nada»: toda a verificação que não pôde ser executada aparece em `skipped` com o motivo, o relatório leva sempre um aviso de responsabilidade e o guarda de redação bloqueia veredictos de conformidade, responsabilidade e correção. Apenas enumera diferenças literais entre o material e as cláusulas citadas; um revisor humano decide o que fazer.

</details>

<details>
<summary>Porque é que algumas regras aparecem sempre como skipped?</summary>

Porque não têm um limiar nacional executável e o verificador recusa passá-las em silêncio. `NR-008` (`maxAfterAdmission`) e `NR-012` (`intervalHours`) saem vazias e têm de ser configuradas pela instituição; `NR-011` informa `skipped` em cuidados especiais (a orientação não dá intervalo para esse nível) e quando há menos de dois registos de `rounds` comparáveis.

</details>

<details>
<summary>Entra em conflito com outros plugins DSH?</summary>

O plugin regista exatamente uma ferramenta, `nurse_record_check`, e depende do serviço tools através de `inject: ['tools']`. Não fornece qualquer chave de serviço, não regista slots de cliente nem rotas `webServer`, e não altera globais. O registo da ferramenta é um efeito Cordis, pelo que descarregar ou recarregar a quente o remove. Não faz pedidos de rede nem troca dados com outros plugins.

</details>

<details>
<summary>Qual é o custo de desempenho?</summary>

O núcleo é uma função pura: ler JSON/YAML, executar 12 regras e construir um relatório, sem rede, sem chamada ao modelo e sem escrita em base de dados. `timeoutMs` vale 120000 ms por padrão e é apenas um orçamento de tempo limite cooperativo. O tempo real depende do tamanho do material e do número de regras; para um diretório inteiro de episódios use o modo de ferramenta `ptc` e pague o custo de esquema uma só vez.

</details>

## Limites de segurança e dados

- **Material só de leitura.** O verificador lê o ficheiro ou o texto em linha que você passa à ferramenta; não modifica o original nem escreve ficheiros no diretório do material.
- **Sem veredicto.** O relatório nunca diz que um episódio é conforme, não conforme ou adequado; o guarda de redação de `src/shared/wording.ts` bloqueia essa linguagem e o relatório leva sempre o aviso.
- **Validação do pacote ao carregar.** O trecho deve ser uma citação literal de pelo menos oito caracteres; `derived-from-principle` tem teto `warn` e `institutional-configuration` teto `info`; um pacote que exagera a sua base falha ao carregar em vez de produzir um relatório que pareça sólido.
- **Funcionamento local.** Sem pedidos de rede, sem chamadas ao modelo, sem telemetria, sem leitura de credenciais; nada é escrito fora do resultado da ferramenta e do armazenamento de sessão/registos do host (ver `PRIVACY.md`).
- **O registo é um efeito.** O registo da ferramenta é removido pelo disposer devolvido por `ctx.tools.register`, pelo que parar ou recarregar o plugin não deixa ferramentas penduradas.

## Limitações conhecidas

- **Apenas JSON / YAML.** Os binários docx e xlsx não são analisados; converta primeiro a exportação da enfermaria para o contrato de material acima; o conversor é da sua responsabilidade.
- **Aritmética de relógio de parede.** Toda a matemática temporal compara as cadeias fornecidas como hora local, sem conversão de fuso horário; um registo significa a hora local que foi escrita.
- **Duas regras saem por configurar.** `NR-008` e `NR-012` permanecem em `skipped` até os seus limiares serem configurados; `NR-011` também fica em `skipped` em cuidados especiais ou quando há menos de dois registos de `rounds` comparáveis.
- **Um trecho ausente é reportado como lacuna.** Quando não foi possível obter o texto literal de uma citação, o achado fica em `warn` / `info` e di-lo no seu `excerpt`; isso é uma lacuna de verificação, não uma prova de que o material cumpra.
- **Não substitui a revisão.** O relatório apenas enumera diferenças; não decide se um episódio de cuidados foi adequado nem atribui responsabilidade. O revisor decide o que fazer a seguir.

## Compatibilidade

| Superfície | Estado |
|---|---|
| Harness | Faixa de peers `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` — verificada para aceitar tanto `0.2.0-rc.2` quanto `0.2.1-rc.2`. `engines.dsh` é declarado como `>=0.2.1-0 <0.3.0` e o host aplica-o desde 0.2.1 |
| Node | `^22.19.0 || >=24.0.0` |
| Plataformas | Todas (ESM puro; sem código nativo, sem rede, sem chamada ao modelo) |
| Modo de ferramenta | Funciona em `native` e `ptc`; para um diretório inteiro use `ptc` e pague o custo de esquema uma só vez |

## Ecossistema e qualidade

- [Página do plugin no dshfind](https://dshfind.com/en/plugins/PerryLink/dsh-nurse-record-check?ref=badge) (instalações e ranking)
- [Relatório do OpenSSF Scorecard](https://securityscorecards.dev/viewer/?uri=github.com/PerryLink/dsh-nurse-record-check) (impulsionado por [.github/workflows/scorecard.yml](.github/workflows/scorecard.yml))
- [DSH Market](https://dsh.market/) (listado)
- [Página do pacote npm](https://www.npmjs.com/package/dsh-nurse-record-check) (versões publicadas e downloads)
- [Família de plugins PerryLink](https://github.com/PerryLink) e [escolher um verificador por material](https://perrylink.github.io/zh/checkers/choose/) (62 verificadores + plugins gerais)

## Solução de problemas

- **O plugin instala mas a ferramenta não aparece.** Confirme que `main` resolve para `lib/index.mjs` e que `pnpm run build` o gerou; um `main` errado faz o carregador ignorar a entrada em silêncio.
- **`dsh plugin add` recusa o pacote como incompatível.** A faixa de peers cobre `0.1.x` e `0.2.x`; se o seu runtime estiver fora dela, conceda isenção explícita: `dsh plugin --profile <name> allow-version <pacote@versão> --dsh-version <runtime> --accept-risk`.
- **Uma regra que esperava não executou.** Leia o arranjo `skipped`, que nomeia a regra e o motivo. `NR-008` e `NR-012` ficam em `skipped` até os seus limiares serem configurados.
- **`check` informa `manifest-peers` como falha.** O verificador estático compara com uma faixa de peers fixa anterior à linha 0.2; o runtime aplica a compatibilidade na instalação. É um problema conhecido do `dsh-plugin-dev`.
- **Os horários parecem deslocados.** Toda a aritmética é de hora local sobre as cadeias fornecidas, sem conversão de fuso horário.
- **O relatório não mostra problemas.** Veja primeiro `skippedCount`; uma lista vazia não é conformidade, ver o FAQ.

## Desenvolvimento

```sh
pnpm install
pnpm run typecheck                # tsc --noEmit
pnpm test                         # vitest, fixtures emparelhados conforme/infrator por regra
pnpm run build                    # tsdown -> lib/index.mjs + lib/index.d.mts
pnpm run verify:self-contained    # as specs de dependências resolvem-se pelo registry
pnpm run check:lockfile           # verificação de deriva do lockfile
pnpm run check:readmes            # consistência dos README em cinco idiomas
pnpm run check:citations          # verificação de citações do pacote de regras
pnpm pack                         # o tarball publicado
```

Para atualizar o kit partilhado quando necessário: `node ../scripts/sync-shared.mjs dsh-nurse-record-check`, que copia `../_shared` para `src/shared/`; volte a executá-lo após cada alteração partilhada.

| Caminho | Conteúdo |
|---|---|
| `src/index.ts` | entrada do plugin de função: `name`/`inject`/`Config`/`apply`, registra a ferramenta `nurse_record_check` |
| `src/check.ts` | núcleo puro de verificação, `(input, ruleset, options) => Report` |
| `src/config.ts` | esquema Schemastery; todos os parâmetros ajustáveis vivem aqui |
| `src/parse.ts` / `src/view.ts` | leitor JSON/YAML e projeção do relatório para o modelo |
| `rules/nurse-record.yaml` | o pacote de regras (12 regras) |
| `rules/evidence/` | registo de verificação de cada citação |
| `tests/fixtures/<RULE>/` | fixtures emparelhados conforme/infrator por regra |
| `samples/quickstart/` | exemplo offline de um minuto |

As imagens do README são geradas por [`scripts/gen-readme-assets.py`](scripts/gen-readme-assets.py) (Pillow para o hero localizado e SVG escrito à mão para o diagrama de estrutura) e podem ser reexecutadas sem risco. O plugin não tem UI; o diagrama usa tokens da superfície de comandos, identificadores de regras/campos e anotações breves em inglês. O script deteta a fonte CJK e aborta em vez de desenhar caixas vazias.

Topics: `deepseek-harness`, `dsh`, `dsh-plugin`, `cordis`, `nurse`, `record`

## Família e agradecimentos

Este projeto faz parte da família de plugins de DeepSeek Harness da [PerryLink](https://github.com/PerryLink) (todos Apache-2.0). Se lhe for útil, **uma estrela ajuda a que a próxima pessoa o encontre** — nada fica bloqueado por isso.

- [@PerryLink](https://github.com/PerryLink) — criador e mantenedor: o pacote de regras, o núcleo de verificação, o leitor de material e a documentação em cinco idiomas.

<details>
<summary>Expandir todos os plugins</summary>

| Plugin | Estado |
|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** |  |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** |  |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** |  |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | 🚫 APOSENTADO (repo arquivado) |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | 🚫 APOSENTADO (repo arquivado) |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | 🚫 APOSENTADO (repo arquivado) |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** |  |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** |  |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | 🚫 APOSENTADO (repo arquivado) |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | 🧊 CONGELADO — ver o README do repo |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | 🚫 APOSENTADO (repo arquivado) |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | 🚫 APOSENTADO (repo arquivado) |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | 🚫 APOSENTADO (repo arquivado) |

</details>

## Licença

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-nurse-record-check contributors

<p align="center"><sub>Apache-2.0 · Plugin da comunidade, não afiliado à DeepSeek.</sub></p>
