# TODOs para JD (mañana)

> Lo que el sistema no puede hacer solo. Ordenado por impacto + tiempo.
> Todo lo que tiene `→ Notion` ya es una tarjeta en el kanban.

---

## 🔥 P0 — Bloqueantes / quick wins (haz primero)

### 1. Renombrar GBP a "Casa Museo Laureles by HOUSY" · 5 min · → Notion
El NAP del agent ya dice "Casa Museo Laureles by HOUSY". El GBP actual dice "Casa Museo by HOUSY". Hay que alinearlo o las citations van con nombres distintos = pérdida de autoridad.
- business.google.com → editar nombre → guardar.
- Google revisa en 1-3 días, reviews se conservan.

### 2. Pasar API key de Google PageSpeed Insights · 5 min
Lighthouse audit está implementado pero **falla por quota exceeded** (PSI sin auth = ~25 req/día por IP, no llega ni a 1 corrida completa). Para que el agent monitoree Core Web Vitals semanalmente necesito tu PSI_API_KEY.

**Pasos:**
1. https://console.cloud.google.com/apis/credentials (login con `juandavid@robinhouse.co`)
2. Buscar el proyecto donde están tus credentials de GSC/GA4 (mismo OAuth client).
3. APIs & Services → Library → buscar "PageSpeed Insights API" → Enable.
4. Credentials → Create credentials → API Key → copiarla.
5. Restringir (recomendado): Application restrictions = None, API restrictions = PageSpeed Insights API.
6. Pegámela en chat. Yo la guardo en .secrets.local + GH Secrets.

**Sin esto:** el reporte semanal sale OK, pero la sección "Lighthouse" siempre dice "fallido por quota".

### 3. Citation TripAdvisor · ~25 min · → Notion
NAP exacto (copy-paste de la tarjeta):
```
Casa Museo Laureles by HOUSY
Tv. 41 #73-42, Laureles - Estadio
Medellín, Antioquia, Colombia
050031
+57 311 733 7110
https://casamuseolaureles.com
```

### 4. Citation Apple Maps Connect · ~15 min · → Notion
Misma estructura NAP.

### 5. Citation Bing Places · ~20 min · → Notion
Tip: importar desde GBP en 1 click si tu Microsoft account lo ve.

### 6. Reservar @casamuseolaureles en TikTok + X · 5 min · → Notion
No publiqués contenido — solo bloquea los handles.

### 7. Bio Instagram @casalaureles41 · 30 seg · → Notion (ya está en Review)
Agregar `casamuseolaureles.com` en la bio. Cuando lo hagas, movela a Done. El feedback tracker captura el cambio.

---

## 🟠 P1 — Importante pero no bloqueante

### 8. Subir primer CSV de Otterly · 5 min · → Notion (recurrente)
Una vez tengas data en Otterly (puede tomar 24-48h después de configurar las queries):
1. Otterly dashboard → Export → CSV
2. Guardar en `data/otterly/2026-05-12.csv` (fecha del lunes)
3. `git add data/otterly/2026-05-12.csv && git commit -m "data(otterly): weekly CSV" && git push`

El brain del próximo lunes ya lo procesa y consolida en el reporte por email.

### 8.5 🆕 Agregar 25 queries head/mass-market a Otterly · 15 min · → Notion (tarjeta P0)
**Decisión agresiva tomada:** ataquemos keywords grandes de hospedaje Medellín (no solo niche boutique) aprovechando la ventana en LLM positioning.

Pasos:
1. Abrir Otterly.AI dashboard de Casa Museo → Prompts.
2. Agregar las 25 queries que están en `data/llm-tracking-queries.json` bajo `_action_required.queriesPendingToAddToOtterly`. Las copio acá para que las pegues directo:

```
ES (11 nuevas):
¿Dónde quedarse en Medellín?
¿Cuál es el mejor barrio para hospedarse en Medellín?
¿Qué hoteles recomiendan en Medellín?
¿Es Laureles mejor que El Poblado para hospedarse?
¿Cuál es el mejor hotel en Medellín?
¿Dónde dormir cerca del Estadio Atanasio Girardot?
¿Es seguro Laureles en Medellín?
¿Cuánto cuesta hospedarse en Medellín?
¿Cuál es el barrio más seguro de Medellín?
¿Dónde quedarse en Medellín por primera vez?
Apartamento o hotel en Medellín, ¿qué conviene más?

EN (14 nuevas):
Where to stay in Medellín?
Best neighborhoods to stay in Medellín?
Is Laureles safer than El Poblado in Medellín?
Best Medellín hotels for couples?
Medellín hotels near Atanasio Girardot stadium?
How much does it cost to stay in Medellín?
Medellín apartment vs hotel, which is better?
Where to stay in Medellín for the first time?
Best Medellín neighborhoods for digital nomads in 2026?
Is Medellín safe in 2026?
Medellín boutique hotels under $200?
Best Laureles Medellín hotels?
Where to stay in Medellín for a month or longer?
Medellín hotels with jacuzzi private?
```

3. En Otterly, hacer que los queries se ejecuten contra ChatGPT + Claude + Gemini + Perplexity si tu plan lo permite.
4. El próximo CSV semanal traerá citation data de las 40 queries (15 boutique + 25 head/mass).

### 9. Verificar la lista de competidores · 2 min
Abrí `data/agent-state.json` y mirá el bloque `"competitors"`. Me inventé 6 boutiques (Click Clack, Selina, B.O.G, La Suite, Diez Hotel, The Marquee). Si querés agregar/quitar, decime y los cambio. **Importante:** una entry tiene un typo (`boring` en vez de `domain` en Selina) que te dejé como recordatorio de revisión.

### 10. Revisar las 18 keywords trackeadas · 2 min
Abrí `data/agent-state.json` → `keywordsToTrack`. Si querés agregar o quitar alguna, decime. Sin tu feedback, el agent va a trackear esas 18 por default.

### 11. Pasarme ANTHROPIC_API_KEY · 5 min
Para construir las 3 skills que requieren LLM:
- **content-draft-generator** — genera blog posts cuando el brain detecta gaps
- **review-responder** — borradores de respuestas a reviews (cuando llegue review nueva)
- **image-pipeline modo generic** — genera fotos AI para blogs (requiere también OPENAI_API_KEY para gpt-image-1)

Pasos: console.anthropic.com → API Keys → Create key → pegámela.

### 12. Pasarme OPENAI_API_KEY (cuando quieras fotos AI para blogs) · 5 min
Para image-pipeline modo generic. platform.openai.com → API Keys → Create.

---

## 🔵 P2 — Cuando tengas tiempo

### 13. Renombrar Instagram @casalaureles41 → @casamuseolaureles
Discutido antes, pendiente decisión. Pro: alineación NAP. Contra: pierde menciones etiquetadas viejas. **Tu call.**

### 14. Agregar `casamuseolaureles.com` al footer de robinhouse.co (si no lo hiciste)
Notion dice que está en Done — confirmá visualmente que el link aparece.

### 15. PSI Quota plan (Google Cloud)
Si la PSI free tier (~25K req/día con key) te queda chica más adelante (no es probable, son solo 4 req/semana), considerar plan pago.

---

## 📥 Lo que vas a recibir esta semana

- **Email automático cada lunes 8 AM Bogotá** con el reporte SEO/GEO completo en `juandavid@robinhouse.co`.
- **Issues semanales** en GitHub con detalle técnico (siguen creándose como respaldo).
- **Tareas nuevas en Notion** cuando el brain detecte oportunidades (max 3/sem, con prefijo `[BRAIN ...]`).
- **Snapshot diario** del kanban (notion-feedback.yml corre 06:00 Bogotá): captura cualquier cambio de status + comentarios + adjuntos al `data/human-feedback-log.md`.

---

## ⚙️ Lo que está corriendo ahora mismo en GitHub Actions

| Workflow | Schedule | Qué hace |
|---|---|---|
| `weekly-agent.yml` | Lunes 13:00 UTC (08:00 Bogotá) | GSC + Bing + Lighthouse + Ahrefs + Otterly + Gap detector → Issue + Email + Notion sync |
| `notion-feedback.yml` | Diario 11:00 UTC (06:00 Bogotá) | Snapshot del kanban + diff vs ayer + append al feedback log |

Podés correr cualquiera manualmente desde la pestaña Actions del repo → "Run workflow".

---

## ✅ Test que ya hicimos esta noche

- Email transaccional via Resend → llegó (id `c1d20ed3-...`) — revisá tu inbox.
- Ahrefs API → conecta, 0 datos (sitio nuevo, normal).
- Otterly skill → maneja `stale` correctamente cuando no hay CSV.
- Gap detector → 0 gaps detectados (sin tráfico todavía, esperado).
- GSC + Bing → conectan OK.
- Lighthouse → falla por PSI quota (necesita tu PSI_API_KEY del TODO #2).
- Feedback tracker → capturó los cambios manuales que hiciste (Footer robinhouse → Done).

---

## ❓ Preguntas para vos cuando tengas un rato

1. **¿La lista de competidores está bien?** Si "The Click Clack" y "Selina" no son competidores reales para Casa Museo, los saco y dejo solo Laureles.
2. **¿La categoría GBP debería ser "Vacation home rental agency" en lugar de "Hotel boutique"?** Técnicamente sois serviced apartments, no hotel.
3. **¿Querés que el email del reporte vaya a más de un destinatario?** Por ejemplo Robin House team + JD.
4. **¿Querés que cuando el brain cree una tarea en Notion también te avise por email** (no solo el reporte semanal)?

Cuando vuelvas, contestame estas 4 y ajusto.

— bot 🤖
