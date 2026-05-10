# Backlog SEO / GEO — Casa Museo Laureles

> Backlog vivo del sistema automatizado SEO/GEO de `casamuseolaureles.com`.
> **Owner técnico:** Claude (vía PR al repo `juanda89/casamuseolaureles41byrobinhouse`).
> **Owner producto:** JD (Robin House).
> **Última actualización:** 2026-05-09

---

## Decisiones vigentes (mayo 2026)

- **Nombre canónico del proyecto y NAP:** **Casa Museo Laureles by HOUSY** (matchea dominio + GBP a renombrar). NAP exacto en TODOS los directorios (carácter por carácter):
  ```
  Casa Museo Laureles by HOUSY
  Tv. 41 #73-42, Laureles - Estadio
  Medellín, Antioquia
  +57 311 7337110
  https://casamuseolaureles.com
  ```
- **Email pro a habilitar:** `hello@casamuseolaureles.com` cuando se necesite mailbox real (ImprovMX free para forwarding). Email transaccional ya activo: `agente@reportes.casamuseolaureles.com` vía Resend.
- **Citation tracking en LLMs:** vía **Otterly.AI** (no build propio).
- **Keyword research:** extender más allá de las keywords definidas — buscar oportunidades nuevas con **Ahrefs API** semanalmente.
- **Reporte semanal:** por **email**, no solo GitHub Issue. Incluye link al kanban de Notion.
- **Kanban humano:** en **Notion**. El brain crea/actualiza tarjetas vía Notion API. Status "Review" significa: humano hizo algo, falta verificación. Feedback tracker corre diario y captura comments + body + adjuntos al log para que el brain aprenda.
- **NO se construye:** mention-monitor genérico de Reddit/Quora. **Sí se construye:** tracker de conversaciones donde valga la pena mencionar a Robin House / Casa Museo orgánicamente, que abre tarea humana en Notion para que lo haga el equipo.
- **Estrategia de imágenes (decidida 2026-05-09):**
  - **Fotos del producto/propiedad** → las toma el equipo con celular (iPhone, calidad decente). NO se contrata sesión profesional pagada.
  - **Fotos genéricas** (blogs sobre Laureles, Medellín, viajes, etc.) → se generan con **OpenAI Image API 2.0 (gpt-image-1)**. El skill `image-pipeline` decide automáticamente: si la skill content-draft pide foto del producto → tarea humana en Notion; si pide foto genérica/conceptual → llama a OpenAI Image API.
- **Aprobación humana siempre:** el agente abre PRs y crea tareas; nunca publica directo.

---

## Sprint actual

**Bloque A — Infra del loop semanal (esta semana)**

Foco: que toda extensión futura entre por email + Notion. Sin esto, el resto vuela ciego.

| ID | Tarea | Status |
|----|-------|--------|
| A1 | Email pro `hello@casamuseolaureles.com` (mailbox real, opcional inmediato) | 🟡 Diferido · stack decidido: ImprovMX free para inbound. Setup cuando JD lo ejecute. |
| A2 | Email transaccional Resend para reporte semanal | 🟢 Done 2026-05-09 · subdomain `reportes.casamuseolaureles.com` verificado, sender `agente@reportes.casamuseolaureles.com`, test enviado OK (Resend id 3c151afc...) |
| A3 | Notion DB del kanban + token API en GitHub Secrets | 🟢 Done 2026-05-09 · DB "Casa Museo · Kanban" creada vía API en page "Kanban RH - SEO". 4 tareas iniciales seedeadas (3 humanas pendientes + 1 ejemplo brain). NOTION_TOKEN + NOTION_DB_ID en .secrets.local + GH Secrets. |
| A4 | Reporte semanal por email + link a Notion | 🔵 In progress · A2 + A3 done. Toca extender `weekly-agent.mjs` para enviar email + crear tareas en Notion. |
| A5 | Notion feedback tracker (loop humano → agente) | 🟢 Done 2026-05-09 · skill `scripts/skills/notion-feedback-tracker.mjs` + workflow diario `notion-feedback.yml` (06:00 Bogotá). Captura comments, body y adjuntos cada vez que cambia status, append a `data/human-feedback-log.md`. El weekly-agent lo cargará como contexto en el system prompt al generar nuevas tareas. |

---

## Backlog priorizado

### P0 — esta semana (Bloque A: infra)
- [ ] **A1** — Configurar email pro `hello@casamuseolaureles.com`. Decidir Google Workspace ($6/u/mes, mejor deliverability) o Zoho Mail (free 5 usuarios). Crear MX, SPF, DKIM, DMARC en GoDaddy DNS. Verificar deliverability con mail-tester.com.
- [ ] **A2** — Configurar Mailgun (ya está como SPF) o Resend para envío transaccional. Crear API key. Guardar en GitHub Secrets como `EMAIL_API_KEY` + `EMAIL_FROM`. Endpoint: `noreply@casamuseolaureles.com`. Destinatario inicial: JD.
- [ ] **A3** — Notion: crear DB "Casa Museo — Kanban" con properties: Title, Status (To do / In progress / Done / Discarded), Priority (P0/P1/P2), Type (Content asset / Citation / Photo / Video / Outreach / Other), Created by (Brain / Human), Created at, Deadline, Acceptance criteria, Linked PR. Generar integration token + share DB con la integration. Guardar `NOTION_TOKEN` y `NOTION_DB_ID` en GitHub Secrets.
- [ ] **A4** — Modificar `scripts/weekly-agent.mjs` para: (1) generar reporte HTML del Issue actual, (2) enviarlo por email a JD, (3) incluir link al Notion DB, (4) crear/actualizar tareas en Notion en lugar de (o además de) Issues de GitHub. Respeta la cadencia actual lunes 8am Bogotá.

### P0 — siguiente (Bloque B: medición LLM + research expandido)
- [ ] **B1** — Crear cuenta en Otterly.AI (starter ~$29/mes). Cargar 30 queries seed de los anexos del doc de estrategia. Conectar API. Skill `scripts/skills/otterly-fetcher.mjs` que pull data semanal. Bloque "Citas LLM" en el reporte.
- [ ] **B2** — Skill `scripts/skills/keyword-research-expander.mjs`: vía Ahrefs API consulta cada lunes (a) posiciones actuales de keywords trackeadas, (b) **keyword ideas nuevas** (related queries, questions, competitor gap). Filtrar por: volumen >50/mes, KD <30, intención comercial o informacional alta. Devolver top 10 oportunidades nuevas que NO tenemos contenido. Bloque "Nuevas oportunidades" en el reporte.
- [ ] **B3** — Skill `scripts/skills/lighthouse-audit.mjs`: ping a PageSpeed Insights API (gratis, sin auth básica) para `/es` y `/en`. Comparar con run anterior persistido en `data/lighthouse-history.json`. Alertar en el reporte si Performance baja >5pts o CLS sube. 30 min de implementación.

### P1 — próximas 2-3 semanas (Bloque C: contenido)
- [ ] **C1** — Skill `scripts/skills/content-draft-generator.mjs`: toma top oportunidad de B2, genera draft ES + EN con Claude API (Sonnet 4.6) aplicando reglas paper Princeton (≥3 datos cuantitativos, ≥2 fuentes externas, headings tipo pregunta, schema FAQ). Abre PR con preview deploy de Vercel.
- [ ] **C2** — Skill `scripts/skills/internal-linker.mjs`: cuando se publica post nuevo, sugiere 3-5 links internos contextuales. Inserta en el frontmatter del .md. Run en cada PR del C1.
- [ ] **C3** — Skill `scripts/skills/gbp-poster.mjs`: Google Business Profile API. Genera 1 post/semana basado en último artículo publicado o evento del barrio. Auto-publica (NO requiere PR humano — bajo riesgo, alta frecuencia).

### P1 — operación (Bloque D: reseñas y reputación)
- [ ] **D1** — Skill `scripts/skills/review-monitor.mjs`: pull reseñas nuevas vía Hostaway API (Booking + Airbnb consolidados) + GBP API. Bloque "Reseñas semana" en el reporte con SLA: GBP ≤24h, TripAdvisor ≤48h. Crea tarea Notion para cada reseña sin responder.
- [ ] **D2** — Skill `scripts/skills/conversation-opportunity-finder.mjs`: identifica conversaciones (Reddit, Quora, Twitter/X, foros de viajes) donde valdría la pena mencionar Casa Museo / Robin House orgánicamente. NO automatiza la respuesta — crea tarea Notion para que un humano responda con criterio. Filtros: relevancia alta, intención comercial, tono respetuoso.

### P1 — assets (Bloque E: imágenes)
- [ ] **E1** — Cuenta Cloudinary + estructura `/casamuseolaureles/units/standar/`, `.../familiar/`, `.../deluxe/`, `.../neighborhood/`, `.../blog/`, `.../og/`.
- [ ] **E2** — Skill `scripts/skills/image-pipeline.mjs` con dos modos:
  - Modo **product** (fotos reales de la propiedad): cuando el humano sube foto a folder compartido (Drive/Dropbox), procesa AVIF/WebP, sube a Cloudinary, genera alt text con Claude Vision, abre PR reemplazando referencia al CDN Hostaway.
  - Modo **generic** (fotos para blogs, no del producto): llama a OpenAI Image API 2.0 (`gpt-image-1`) con prompt generado automáticamente desde el contexto del post. Sube a Cloudinary subfolder `/blog/<slug>/`. Marca el archivo con metadata `source: ai-generated` para auditoría futura.
  - El skill content-draft decide qué modo activar según el contexto: foto de unidad/jacuzzi/lobby/staff → product (tarea humana); foto de barrio/cafetería genérica/concepto/ilustrativa → generic (auto AI).
- [ ] **E3** — OG images dinámicas con `@vercel/og` para cada página + cada post del blog.

### P2 — mes 2-3 (Bloque F: estratégico)
- [ ] **F1** — Brain trimestral con Opus 4.7 que toma 13 reportes semanales y produce plan estratégico de Q.
- [ ] **F2** — Detector de canibalización (2+ URLs propias compitiendo por misma query).
- [ ] **F3** — Refresh engine: prioriza refrescar artículos que pierden posición sobre crear nuevos.
- [ ] **F4** — A/B testing del booking widget: redirect Housy Host vs iframe Hostaway. Métrica: booking_intent → confirmación real.

### P3 — futuro (Bloque G: amplificación)
- [ ] **G1** — Lead magnet: PDF "Guía de Laureles para nómadas digitales" (ES + EN). MailerLite o Buttondown.
- [ ] **G2** — Newsletter mensual automatizado.
- [ ] **G3** — Email post-checkout pidiendo review (vía Hostaway o MailerLite).
- [ ] **G4** — Outreach automation lite: pitch a publicaciones detectadas como gap.

---

## Pendientes humanos (no automatizables)

**Todos están como tarjetas P0 en el [Notion kanban](https://www.notion.so/35c4539979ca81c1ba2ed72007c32487)** con NAP exacto y criterio de aceptación. El feedback tracker captura cualquier comentario/cambio que JD haga.

Estado al 2026-05-09:
- 🟡 Bio Instagram (en `Review` — testeado, pendiente acción real)
- ⚪ Renombrar GBP a "Casa Museo Laureles by HOUSY"
- ⚪ Reservar @casamuseolaureles en TikTok + X
- ⚪ Request indexing GSC para URLs core
- ⚪ Citation TripAdvisor
- ⚪ Citation Apple Maps Connect
- ⚪ Citation Bing Places
- ⚪ Crear cuenta Otterly.AI + pasar API key
- ⚪ Crear cuenta Ahrefs Lite + pasar API token
- ⚪ Backlink footer robinhouse.co
- ⚫ Sesión de fotografía profesional pagada (DESCARTADA — el equipo toma fotos del producto con celular; fotos genéricas vía OpenAI Image API)

- [ ] Decidir si renombrar IG @casalaureles41 → @casamuseolaureles (riesgo: pierde menciones etiquetadas viejas).

---

## Done

_(vacío — se irá llenando a medida que se completen items con fecha de completion)_

---

## Ideas / parking lot

- Multi-currency display en booking widget (mostrar precio aprox en USD junto a COP).
- Sub-skill que detecta datos obsoletos en posts viejos (años, precios) y abre PR de refresh.
- Multilingual expansion brain: decidir cuándo abrir versión PT-BR basado en datos de tráfico desde Brasil.
- Slack alternative para notificaciones críticas (caída de ranking, GBP suspendido) — ahora va por email + Issue, ¿agregar Slack/Telegram?
- Webhook desde Hostaway: cuando entra reserva, disparar evento de conversión real en GA4 (no solo intent).
- Schema review individual por unidad (cuando haya volumen de reseñas embeddable).
- Páginas programáticas long-tail: `/es/laureles/cafes`, `/es/laureles/coworking`, `/es/laureles/restaurantes`.

---

## Cómo se actualiza este backlog

1. **El agente** puede agregar items en "Ideas / parking lot" cuando detecte algo durante una corrida semanal.
2. **El humano (JD)** marca items como done con fecha y mueve a sección Done. Cualquier ajuste de prioridad va aquí.
3. **Claude (en sesión)** edita este archivo cuando se decide ejecutar un nuevo item, marcando status y agregando notas técnicas si aplica.
4. Convención de status: `⚪ Pending` · `🔵 In progress` · `🟢 Done` · `🟡 Blocked` · `⚫ Discarded`.
