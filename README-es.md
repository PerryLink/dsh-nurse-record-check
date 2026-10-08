# dsh-nurse-record-check — Verificación de plazos, firmas y formularios de evaluación en el registro de enfermería

`dsh-nurse-record-check` lee una exportación legible por máquina de un episodio de hospitalización —registros de enfermería, órdenes médicas y formularios de evaluación completados— y comprueba los plazos, las firmas y la conservación de formularios de esa documentación de enfermería (护理记录), informando de las diferencias literales frente a las cláusulas citadas: que cada registro de enfermería deje un responsable y una hora trazables, que toda fecha y hora esté escrita en formato de 24 horas y se pueda leer, que la hora de un registro de reanimación sea precisa al minuto y su nota se escriba dentro de las 6 horas siguientes al final de la reanimación, que una orden temporal lleve hora de ejecución y la firma de la enfermera que la ejecutó y que una orden anulada registre su anulación, que la primera evaluación de enfermería y la frecuencia de documentación cumplan los umbrales que configure la institución, que los formularios de riesgo de caídas y de lesión por presión estén archivados, y que el intervalo entre rondas de vigilancia corresponda a la guía de cuidados graduados del nivel de cuidados que el registro indica. Una comprobación que no puede ejecutarse se lista en `skipped` en lugar de pasar.

## Qué responde

| Usted pregunta | Qué responde |
|---|---|
| Un registro de enfermería salió del sistema de planta sin enfermera firmante. ¿Se informa de ello? | Sí. `NR-001` informa de todo registro de enfermería que no deja un identificador de responsable y también de un `nurseId` que no coincide con el formato de número de personal configurado. Comprueba que el material deje una marca de responsable y una hora, no cómo se implementa técnicamente la firma electrónica. |
| Un valor de hora de la exportación no se puede analizar. ¿Qué hace la regla con él? | `NR-002` informa del valor y exige una hora escrita en formato de 24 horas y legible como `YYYY-MM-DD HH:mm`. El registro cuya hora no se puede analizar queda fuera de las comparaciones de plazo posteriores, así que aparece aquí y no como una diferencia de plazo: la regla comprueba que la hora se pueda leer, no que sea la hora real. |
| Nuestro registro de reanimación indica la fecha, pero ninguna hora. | `NR-003` informa de un registro de tipo `rescue` cuya hora solo es precisa al día, porque la hora de la reanimación debe ser precisa al minuto. El paquete señala que las dos disposiciones que cita no piden lo mismo —una exige la 「抢救时间」 al minuto y la otra el 「记录时间」— y las presenta juntas indicando cada fuente por separado. |
| La nota de reanimación se escribió a la mañana siguiente. ¿Es tarde? | `NR-004` compara la hora registrada con `rescueEndedAt` e informa de un intervalo superior a 6 horas; también informa de una nota escrita antes de que terminara la reanimación. Si falta `rescueEndedAt` no hay nada que comparar, y la comprobación informa de que no pudo ejecutarse en lugar de pasar. |
| Se ejecutó una orden temporal, pero la casilla de firma de la enfermera que la ejecutó está vacía. | `NR-005` informa de una orden temporal cuyo registro de ejecución carece de la hora de ejecución o de la firma de la enfermera que la ejecutó. Se aplica solo a las órdenes temporales —la hoja de órdenes de largo plazo contiene otros elementos y no debe leerse igual— y no comprueba cuánto después de la ejecución se firmó, porque el paquete no encontró ningún plazo de firma. |
| Algunas reglas aparecen como `skipped` en lugar de pasar. ¿Qué significa? | Significa que la comprobación no se ejecutó, no que haya pasado. `NR-008` y `NR-012` traen sus umbrales vacíos (`maxAfterAdmission`, `intervalHours`), porque el paquete no encontró ningún umbral nacional aplicable a los registros de enfermería —y deja constancia de que las 24 horas que sí encontró corresponden al 「入院记录」 que escribe el médico y no deben trasladarse a la primera evaluación de enfermería—; `NR-011` también se informa como `skipped` en cuidados especiales (特级护理), donde la guía no fija intervalo, y cuando hay menos de dos registros de `rounds` que comparar. |

## Normas que sigue

| Documento | Número | Reglas que lo citan |
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

| Superficie | Estado |
|---|---|
| Harness | Rango de peers `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` — verificado para aceptar tanto `0.2.0-rc.2` como `0.2.1-alpha.1`. **No se declara `engines.dsh`**: no tiene lector y no puede rechazar ningún host |
| Node | `^22.19.0 || >=24.0.0` |
| Plataformas | Todas (ESM puro; sin código nativo, sin red, sin llamada al modelo) |
| Modo de herramienta | Funciona en `native`, `ptc` y `both`; para un directorio completo use `ptc` |

## What it does

La tabla de reglas, los campos y el comportamiento detallado están en [README.md](README.md#what-it-does) (versión principal en inglés). El plugin sólo enumera divergencias literales frente a las cláusulas citadas e indica en `skipped` cada comprobación que no pudo ejecutarse.

## Install

```sh
dsh plugin --profile <name> add dsh-nurse-record-check
dsh --profile <name> --dump-config | grep 'dsh-nurse-record-check'
```

## Configuration

Todos los parámetros ajustables viven en el esquema Schemastery de `src/config.ts`, por lo que se cambian desde `cordis.yml` sin tocar el código; los umbrales por regla están en el paquete de reglas bajo `rules/`.

| Clave | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `rulesFile` | string | `rules/nurse-record.yaml` | Ruta del paquete de reglas, relativa a la raíz del paquete |
| `disabledRules` | string[] | `[]` | Ids de reglas que se dejan de ejecutar; cada una aparece en `skipped` |
| `onlyRules` | string[] | `[]` | Ejecutar solo estas reglas; vacío ejecuta todas |
| `skipNotes` | string | `""` | Nota añadida a cada motivo de `skipped` |
| `timeoutMs` | number | `120000` | Presupuesto de tiempo de espera cooperativo de la herramienta |

## Material format

Acepta JSON o YAML. El ejemplo completo de campos está en [README.md](README.md#material-format) (versión principal en inglés). Los campos son opcionales en la capa de lectura y los valida el motor, de modo que una exportación parcial produce hallazgos sobre lo que falta en lugar de un fallo.

## Rule sources

Los datos de las reglas están separados del código: cada regla lleva documento, número, cláusula en la numeración propia de la fuente, extracto literal y URL de origen. El cargador impone que el extracto sea una cita real de al menos ocho caracteres y que una comprobación basada sólo en un principio general (`kind: derived-from-principle`, tope `warn`) o en una política local (`kind: institutional-configuration`, tope `info`) nunca se declare `error`.

Los límites verificados y las conclusiones deliberadamente **no** afirmadas están en [README.md](README.md#rule-sources) (versión principal en inglés) y en `rules/evidence/`.

## Troubleshooting

- **El plugin se instala pero la herramienta no aparece**: compruebe que `main` resuelve a `lib/index.mjs` y que `pnpm run build` lo generó.
- **`dsh plugin add` rechaza el paquete**: la faixa de peers cubre `0.1.x` y `0.2.x`; fuera de ella, conceda una exención explícita con `dsh plugin --profile <name> allow-version <pkg@ver> --dsh-version <runtime> --accept-risk`.
- **Una regla no se ejecutó**: lea el arreglo `skipped`.
- **`check` informa `manifest-peers` como fallo**: es un problema conocido de `dsh-plugin-dev`; el runtime aplica la compatibilidad al instalar.
- **Los horarios parecen desplazados**: toda la aritmética es de hora local sobre las cadenas entregadas.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
node ../scripts/sync-shared.mjs dsh-nurse-record-check
```

El último comando copia el kit compartido de `../_shared` a `src/shared/`; vuelva a ejecutarlo tras cada cambio compartido.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-nurse-record-check contributors.
