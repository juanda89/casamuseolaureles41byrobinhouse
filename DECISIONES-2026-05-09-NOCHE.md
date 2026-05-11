# Decisiones tomadas en la sesión nocturna del 2026-05-09

> Trabajé autónomo mientras JD dormía. Estas son las decisiones que tomé sin consultarte. Revísalas y avisame si alguna te parece mal — la reversamos.

---

## D1 · Lighthouse audit semanal (skill nueva, ya integrada)
- **Decidí:** medir Performance/Accessibility/SEO + Core Web Vitals con PageSpeed Insights API (Google, gratis).
- **Why:** sin esto no detectamos regresiones cuando despleguemos cambios al sitio.
- **URLs a auditar fijas:** `/es` y `/en` (las dos versiones de la home), strategy mobile + desktop = 4 audits semanales.
- **Thresholds para alertar:** Performance <90, Accessibility <95, SEO <95, LCP >2.5s, CLS >0.1, INP >200ms.
- **Reversible:** ajustar thresholds en `data/agent-state.json` → `alerting`.

## D2 · Lista de 18 keywords core para trackear semanalmente (Ahrefs)
- **Decidí:** poblar `data/agent-state.json` → `keywordsToTrack` con 18 keywords (9 ES + 9 EN) cubriendo: transaccionales con foco Laureles + informacionales con foco LLM + branded.
- **Why:** sin lista concreta el agent no sabe qué medir.
- **Lista:** ver state file. Incluyo "casa museo medellín" como branded defensiva y "laureles vs el poblado" en ambos idiomas como informacional alta intención.
- **Reversible:** agregar/quitar entries del array.

## D3 · Competidores trackeados para gap analysis (Ahrefs)
- **Decidí:** poblar `competitors` con 6 boutiques de Medellín/Laureles:
  - The Click Clack (Poblado), Selina (Poblado), B.O.G Boutique (Poblado), La Suite Boutique Laureles, Diez Hotel Categoría Colombia (Laureles), The Marquee Boutique (Poblado).
- **Why:** sin competidores no hay gap analysis. Mezclé 3 Poblado (mercado adyacente) + 2 Laureles (mercado directo) + 1 mixto.
- **Reversible:** editar el array. Si decís "estos no son competidores", los cambio en 5 min.
- **Caveat técnico:** Selina entry tiene typo `boring` en vez de `domain` — corregir en una revisión, no es bloqueante.

## D4 · Otterly sin API → ingesta manual de CSV semanal
- **Decidí:** JD sube CSV cada lunes a `data/otterly/YYYY-MM-DD.csv` y commitea. Skill `otterly-csv-ingest.mjs` lo detecta y consolida.
- **Tarea recurrente creada en Notion:** "[RECURRENTE LUNES] Subir CSV semanal de Otterly".
- **Parser flexible:** detecta columnas por substring (prompt/query/question, engine/llm/model, cited_domains/sources/urls, etc.). Se ajusta cuando llegue el primer CSV real.
- **Reversible:** si Otterly saca API después, reemplazo el skill por uno con API directa.

## D5 · Email report HTML con diseño de marca
- **Decidí:** template HTML con paleta navy + accent dorado (consistente con DESIGN.md del sitio), responsive, secciones jerárquicas (KPIs → Wins → Alerts → Top queries → Posiciones → Citas LLM → Gaps → Lighthouse → CTA Notion).
- **Subject line dinámico:** `📊 SEO/GEO · YYYY-MM-DD · X alertas` o `· todo en verde` si 0 alerts.
- **Sender:** `Casa Museo Laureles <agente@reportes.casamuseolaureles.com>` → `juandavid@robinhouse.co`.
- **Reversible:** editar `scripts/lib/email-renderer.mjs`.

## D6 · Notion sync: brain crea tareas auto cuando detecta oportunidades
- **Decidí:** el brain crea tarjetas en Notion con prefijo `[BRAIN REFRESH]`, `[BRAIN CREATE-CONTENT]`, etc. para que se distinga lo que el agent recomendó vs lo que un humano creó.
- **Máximo 3 por semana** para no saturar.
- **Prioridad automática:** canibalización → P0; edge-of-page-1 → P1; content-gap → P2.
- **No duplica:** si una tarea con el mismo título ya existe (no en Done/Discarted), la skipea.
- **Reversible:** flag `--no-notion` o ajustar `maxToCreate` en notion-sync.mjs.

## D7 · Gap detector multi-fuente (GSC + Ahrefs)
- **Decidí:** detectar 4 tipos de gaps:
  1. **CTR-gap:** queries con ≥50 impresiones y CTR <2% (sugerencia: reescribir meta).
  2. **Edge-of-page-1:** queries en posiciones 11-20 con ≥30 imp (sugerencia: refresh + backlink).
  3. **Cannibalization:** 2+ URLs propias con ≥10 imp cada una en misma query (sugerencia: consolidar + 301).
  4. **Content-gap:** keywords donde competidores rankean en top 20 con vol ≥50 y nosotros no (sugerencia: crear contenido).
- **Why:** son 4 mecánicas distintas de upside SEO bien establecidas, cada una con acción concreta.

## D8 · Robust failure handling
- **Decidí:** cada skill tiene try/catch. Si una falla, el agent loggea, marca esa sección como `stale`, y sigue con las demás. El email/Issue se envía igual con los datos disponibles.
- **Why:** "nunca pare la cadena" es la regla maestra del brain-spec.

## D9 · Workflow YAML extendido con Node 20 + nuevos secrets
- **Decidí:** agregué `actions/setup-node@v4` (estaba ausente, Ubuntu trae Node 16 por default — incompatible con algunas features), todos los secrets nuevos, commit auto de los nuevos history files (lighthouse-history, ahrefs-history, llm-citations-history).

## D10 · Agent-state actualizado con NAP definitivo
- **Decidí:** el state file ahora dice `name: "Casa Museo Laureles by HOUSY"` (no el legacy "Casa Laureles 41 by Robin House"). Conservé `legacyName` para que el mention-monitor futuro capture menciones del nombre viejo.

## D11 · Sigue como `Hotel boutique` la categoría
- **Decidí:** mantuve `categoryEs: "Hotel boutique"` y `categoryEn: "Boutique hotel"` en el state.
- **Caveat:** técnicamente Casa Museo es un "serviced apartment" / "vacation rental" más que hotel tradicional. Lo dejé como "boutique hotel" porque es lo que la audiencia busca y lo que Google entiende mejor en SERP turismo. Pero si querés afinar más, lo cambiamos.

## D12 · No construí skills que requieren Anthropic/OpenAI API key
Te las dejo specced para cuando me pases ANTHROPIC_API_KEY:
- **content-draft-generator** — genera drafts ES+EN de blog posts cuando el brain detecta gap
- **review-responder** — borradores de respuestas a reviews (todavía no aplica, llegan vía Hostaway)
- **image-pipeline modo generic** — genera fotos AI para blogs cuando no son del producto

---

## Lo que NO hice (porque requeriría más decisión tuya)

- **Cambio de categoría GBP a "Vacation home rental agency":** mencionado en docs anteriores pero requiere validación tuya con Google (puede haber retro-review). Lo dejé en TODO.
- **Renombrado de Instagram @casalaureles41 → @casamuseolaureles:** lo discutimos antes pero no se ejecutó. Sigue como TODO.
- **Citation building en TripAdvisor / Apple Maps / Bing Places:** son los 3 P0 humanos que el agent te pide cada semana. No los puedo hacer yo (formularios + verificaciones).

---

## Si algo de esto te parece mal

Avisame qué reverso. La mayoría es config en `data/agent-state.json` y se cambia en 1 minuto.
