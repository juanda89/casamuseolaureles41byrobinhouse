# Human Feedback Log

> Registro automático de feedback humano sobre las tareas del kanban de Notion.
> Lo escribe el skill `scripts/skills/notion-feedback-tracker.mjs` cada vez que detecta un cambio de status en una tarea, capturando comentarios, descripción y adjuntos del humano.
>
> **Para qué sirve:** este log se carga como contexto en el system prompt del weekly-agent al generar nuevas tareas. El brain "aprende" de cómo el humano edita, comenta y prioriza, y ajusta sus sugerencias futuras (formato, tono, criterios de aceptación, qué pedir y qué no).
>
> **No editar a mano** — el skill agrega entries al final. Para insights consolidados, ver sección al final.

---

## Convenciones

- Cada entry empieza con `### YYYY-MM-DD HH:MM · <task title>` (timestamp en zona Bogotá).
- Bloques estandarizados: **Cambio de status** · **Comentarios nuevos** · **Descripción/body** · **Archivos adjuntos** · **Decisiones detectadas** (auto-extraídas por el brain trimestral).
- Los archivos adjuntos se referencian por URL pública de Notion + descripción si la hay.

---

## Entries

---

### 2026-05-09 23:03 · Agregar casamuseolaureles.com en bio de @casalaureles41
- **Notion task:** [bbdc7e43](https://www.notion.so/Agregar-casamuseolaureles-com-en-bio-de-casalaureles41-35c4539979ca81378ee9dedebbdc7e43)
- **Tipo:** Other · **Prioridad:** P0 · **Created by:** Human
- **Cambio de status:** `To Do` → `Review`

**Comentarios nuevos:**
> _35c45399-79ca-8173-a8ec-0027fd5364a8 · 2026-05-10T04:03:00.000Z_
> Listo. Cambié el link en bio. Tip para próxima: cuando me pidas updates de IG, dame el copy exacto que querés que ponga, así no lo escribo a la rápida.


**Descripción / body:**
```
Bio actualizada el 9 de mayo. Quedó: "Lofts boutique en Laureles · Reservas → casamuseolaureles.com". Antes decía solo emoji + ubicación.
```

---

### 2026-05-10 23:25 · Crear cuenta Ahrefs Lite ($129/mes) + pasar API token
- **Notion task:** [b871eb50](https://www.notion.so/Crear-cuenta-Ahrefs-Lite-129-mes-pasar-API-token-35c4539979ca81a7bf5ef454b871eb50)
- **Tipo:** Other · **Prioridad:** P0 · **Created by:** Human
- **Cambio:** tarea nueva detectada (status inicial: `Done`)

**Comentarios nuevos:**
> _35c45399-79ca-8173-a8ec-0027fd5364a8 · 2026-05-11T04:25:00.000Z_
> API key recibida y guardada en .secrets.local + GitHub Secrets. Test OK: plan Lite, 100K units/mes, 0 usados, key expira mayo 2027. Listo para skill B2 (keyword research expandido).


---

### 2026-05-10 23:25 · Crear cuenta Otterly.AI starter ($29/mes) + cargar 30 queries seed + pasar API key
- **Notion task:** [30642321](https://www.notion.so/Crear-cuenta-Otterly-AI-starter-29-mes-cargar-30-queries-seed-pasar-API-key-35c4539979ca81b29efce02630642321)
- **Tipo:** Other · **Prioridad:** P0 · **Created by:** Human
- **Cambio:** tarea nueva detectada (status inicial: `Done`)

**Comentarios nuevos:**
> _35c45399-79ca-8173-a8ec-0027fd5364a8 · 2026-05-11T04:25:00.000Z_
> Cuenta activa. Otterly NO tiene API pública - ingesta semanal vía CSV manual. 15 prompts seed guardados en data/llm-tracking-queries.json. JD descarga CSV cada lunes y lo guarda en data/otterly/YYYY-MM-DD.csv (instrucciones en data/otterly/README.md). Tarea recurrente creada para no olvidar.


---

### 2026-05-10 23:25 · Agregar Casa Museo al footer de robinhouse.co
- **Notion task:** [e98b19af](https://www.notion.so/Agregar-Casa-Museo-al-footer-de-robinhouse-co-35c4539979ca81e182c1f951e98b19af)
- **Tipo:** Outreach · **Prioridad:** P0 · **Created by:** Human
- **Cambio de status:** `To Do` → `Done`

---

## Insights consolidados

_(El brain trimestral con Opus 4.7 procesa este log y extrae patrones recurrentes acá. Por ejemplo: "El humano consistentemente pide cambiar 'tono profesional' por 'tono cercano' en respuestas de reviews → ajustar prompt del review-responder")_
