# Otterly.AI · CSV uploads semanales

Otterly **no tiene API pública**, así que la ingesta es manual.

## Cómo subir el reporte semanal

Cada lunes (o antes que corra el brain a las 06:00 Bogotá):

1. Entrá a Otterly.AI → Dashboard del proyecto Casa Museo Laureles by HOUSY
2. Reporte semanal → **Export → CSV**
3. Guardá el archivo acá con el nombre `YYYY-MM-DD.csv` (fecha del lunes de la semana del reporte)
   Ejemplo: `2026-05-12.csv`
4. Commit + push:
   ```
   git add data/otterly/2026-05-12.csv
   git commit -m "data(otterly): weekly CSV 2026-05-12"
   git push
   ```

El brain del lunes detecta el CSV nuevo, lo parsea, y consolida histórico en
`data/llm-citations-history.json`. Si no hay CSV nuevo, el brain marca la
sección "Citas LLM" del reporte semanal como `stale = true` y sigue.

## Formato esperado del CSV

(Por confirmar con la primera exportación de JD — el parser puede ajustarse después.)

Columnas mínimas que el brain espera:
- `prompt` o `query`
- `engine` (chatgpt / claude / gemini / perplexity)
- `cited_domains` o equivalente (lista de dominios citados)
- `date` o `timestamp`

Si Otterly entrega otra estructura, JD pega un CSV de muestra y se ajusta el parser.

## Retención

Los CSVs se conservan en git para auditoría histórica. El histórico procesado vive en `data/llm-citations-history.json` (también versionado).
