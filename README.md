# Casa Laureles 41 by Robin House — sitio web

Landing del hotel boutique **Casa Museo / Casa Laureles 41 by Robin House**, en Laureles, Medellín.

- Brand: Casa Laureles 41 by Robin House (concepto: Casa Museo)
- Dominio: `casamuseolaureles.com`
- Operado por Housy Host. Diseñado por Robin House.

## Stack

- **Astro 5** + **Tailwind 4** (CSS-based theme), SSG estático.
- **i18n nativo** (`/es/*` por defecto, `/en/*`).
- **Sistema de diseño:** [`DESIGN.md`](./DESIGN.md) en formato Google Labs `design.md` (v alpha).
- **Skills:** `frontend-design` (Anthropic) + `casa-museo-design-review` (custom).
- **Booking:** redirect a Housy Host con params verificados.
- **WhatsApp float:** `+573117337110` con mensaje preset por idioma.
- **Cookies:** banner ligero con GTM consent mode v2.

## Estructura

```
.
├── DESIGN.md                          # Sistema visual (formato Google design.md)
├── Landing_CasaLaureles41.docx        # Especificación — fuente de verdad
├── PREGUNTAS AGENTE00RH.docx          # Voz de marca / FAQs
├── tailwind.tokens.json               # Generado por design.md CLI
├── vendor/google-design-md/           # Clon de github.com/google-labs-code/design.md
└── site/                              # Astro app
    ├── src/
    │   ├── lib/             # constants, booking, i18n, photos
    │   ├── components/      # Hero, BookingBar, UnitCard, …
    │   ├── components/schema/  # JSON-LD (LodgingBusiness, Apartment, FAQPage)
    │   ├── content/         # FAQs y unidades (Content Collections)
    │   ├── i18n/            # es.json, en.json
    │   ├── layouts/Base.astro
    │   ├── pages/es/        # ES por defecto
    │   └── pages/en/        # EN
    └── public/              # robots.txt, llms.txt, manifest, favicon
```

## Comandos

```bash
cd site
npm install            # primera vez
npm run dev            # http://localhost:4321
npm run build          # genera dist/ estático
npm run preview        # sirve dist/
```

## Validar el sistema de diseño

```bash
# Lint del DESIGN.md (desde la raíz del proyecto)
npx -y @google/design.md@latest lint DESIGN.md

# Re-exportar tokens a Tailwind si DESIGN.md cambia
npx -y @google/design.md@latest export DESIGN.md --format tailwind > tailwind.tokens.json
```

Y antes de mergear cualquier cambio en `site/src/components/`, invoca el skill custom:

```
/skill casa-museo-design-review
```

## Booking — datos verificados (mayo 2026)

| Unidad | ID Housy Host | Capacidad |
|---|---|---|
| Standar | 485562 | 2 |
| Familiar | 486242 | 4 |
| Deluxe Jacuzzi | 489587 | 2 |

URL: `https://booking.housyhost.com/listings/<id>?start=YYYY-MM-DD&end=YYYY-MM-DD&numberOfGuests=N`

CDN de imágenes (bootstrap): `https://bookingenginecdn.hostaway.com/listing/43085-<id>-<hash>?width=1280&quality=70&format=webp&v=2`

## Deploy a Vercel

```bash
cd site
vercel --prod
```

`vercel.json` ya configura headers de seguridad (HSTS, X-Content-Type-Options, Referrer-Policy) y redirects útiles.

Antes del go-live:
1. Configurar variables `.env.example` → Vercel project settings.
2. Conectar dominio `casamuseolaureles.com` (DNS en Cloudflare).
3. Submit `https://casamuseolaureles.com/sitemap-index.xml` a Search Console y Bing.
4. Backlinks: footer de robinhouse.co + Instagram bio.
5. Citation building: TripAdvisor, Apple Maps, Bing Places.

## Pendientes con stakeholders

- Sesión de fotografía profesional (mientras: bootstrap con CDN Hostaway).
- Permisos firmados de testimoniales.
- Confirmar parqueadero, IVA, handle Instagram (`@casalaureles41` o `@casamuseo`).
- Migrar imágenes a Cloudinary del dominio (control de Core Web Vitals + watermark).
- Generar OG images por página (`/og/<slug>.jpg`).
