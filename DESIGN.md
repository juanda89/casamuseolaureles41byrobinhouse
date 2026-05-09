---
version: alpha
name: Casa Museo · Casa Laureles 41
description: Sistema de diseño tropical-editorial para Casa Laureles 41 by Robin House. Lujo orgánico paisa, vibe museo curado, calidez de selva colombiana.
colors:
  # Primarios — verde selva profundo, alma del lugar
  primary: "#2C4A3E"
  primary-soft: "#3F5F52"
  primary-deep: "#1A2E25"
  on-primary: "#F5EFE6"

  # Acento — terracota colombiano, único impulsor de acción
  # accent ajustado a #A04A2E (5.46:1 con surface) tras audit Lighthouse —
  # el #B85C3C original (4.0:1) fallaba WCAG AA para texto pequeño.
  accent: "#A04A2E"
  accent-soft: "#D17A5A"
  accent-deep: "#7A3A22"
  on-accent: "#F5EFE6"

  # Dorado curado — galería, hairlines, detalles editoriales
  gold: "#C9A96E"
  gold-soft: "#DDC093"

  # Tierras y maderas — texto y profundidad
  ink: "#2A1F18"
  ink-soft: "#5C4A3D"
  ink-mute: "#8B7866"

  # Lienzos crema — la página respira
  surface: "#F5EFE6"
  surface-warm: "#EDE3D2"
  surface-sand: "#E8DCC8"
  surface-deep: "#1A2E25"
  on-surface: "#2A1F18"
  on-surface-mute: "#5C4A3D"

  # Verdes claros — estados, badges, micro-confirmaciones
  leaf: "#8FA88E"
  leaf-pale: "#C8D4C5"

  # Semánticos
  success: "#5C8A6E"
  warning: "#D4A24A"
  error: "#A8412E"
  on-error: "#F5EFE6"

  # Línea
  outline: "#C8B79C"
  outline-soft: "#DDD0BB"

  # Fijo — WhatsApp brand (no negociable)
  whatsapp: "#25D366"

typography:
  display-xl:
    fontFamily: Fraunces
    fontSize: 5.5rem
    fontWeight: 300
    lineHeight: 0.95
    letterSpacing: -0.035em
    fontFeature: '"ss01", "ss02"'
  display-lg:
    fontFamily: Fraunces
    fontSize: 3.75rem
    fontWeight: 300
    lineHeight: 1
    letterSpacing: -0.03em
    fontFeature: '"ss01"'
  headline-lg:
    fontFamily: Fraunces
    fontSize: 2.5rem
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Fraunces
    fontSize: 1.75rem
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Fraunces
    fontSize: 1.375rem
    fontWeight: 500
    lineHeight: 1.25
  body-lg:
    fontFamily: DM Sans
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.65
  body-md:
    fontFamily: DM Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: DM Sans
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.55
  label-lg:
    fontFamily: DM Sans
    fontSize: 0.9375rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.005em
  label-caps:
    fontFamily: DM Sans
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.18em
  numeric:
    fontFamily: JetBrains Mono
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.01em
  numeric-display:
    fontFamily: JetBrains Mono
    fontSize: 1.875rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.02em

rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 8px
  lg: 14px
  xl: 22px
  pill: 9999px

spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 96px
  4xl: 144px
  gutter: 24px
  container: 1200px
  reading: 68ch
  margin-mobile: 20px
  margin-desktop: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.pill}"
    height: 52px
    padding: 0 32px
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
  button-secondary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.pill}"
    height: 52px
    padding: 0 28px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.pill}"
    height: 44px
    padding: 0 20px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: 52px
    padding: 0 18px
  unit-card:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 0px
  unit-card-hover:
    backgroundColor: "{colors.surface-sand}"
  badge-amenity:
    backgroundColor: "{colors.leaf-pale}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: 6px 14px
  badge-gold:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: 6px 14px
  whatsapp-float:
    backgroundColor: "{colors.whatsapp}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    size: 64px
  hero-overlay:
    backgroundColor: rgba(26, 46, 37, 0.45)
    textColor: "{colors.on-primary}"
  booking-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
  faq-item:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 20px 24px
  divider-gold:
    backgroundColor: "{colors.gold}"
    height: 1px
  testimonial-card:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 32px
  cookie-banner:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 20px 24px
---

# Casa Museo — Sistema de diseño

## Overview

Casa Museo no es un hotel. Es **una galería habitada** en el corazón de Laureles, donde el huésped despierta dentro de una pieza curada. El sistema de diseño nace de tres tensiones productivas:

- **Editorial × tropical.** La precisión de una revista de arte se cruza con la calidez de la luz paisa de las 4 PM. Tipografía serif refinada, negro-tierra para texto, fondos color crema que respiran.
- **Museo × hogar.** Hay rigor de espacios curados (mucho whitespace, pasos de ritmo en 8 px) pero también materialidad orgánica: piedra tallada, madera flotante, terracota cocida.
- **Robin House × Casa Laureles 41.** La marca matriz aporta autoridad de diseño contemporáneo; Casa Laureles 41 aporta el carácter local. La paleta favorece el verde selva y el terracota colombiano antes que neutros internacionales.

La emoción objetivo: **calma deliberada**. El usuario debería sentir que está hojeando un catálogo, no navegando un sitio comercial — y a la vez, debe poder reservar en dos clics.

Audiencia primaria: viajeros boutique 28-50, nómadas digitales internacionales, parejas en escapada. La página habla con voz Housy Host: cálida, profesional, concisa, con emojis muy moderados (nunca decorativos, solo funcionales en CTAs y FAQ corto).

## Colors

La paleta es **tropical-editorial**: verdes profundos de selva, terracota cocido, cremas de página y dorados de marquesina. El blanco puro está prohibido — todos los fondos cálidos vienen de la familia crema.

- **Primary — Verde selva (#2C4A3E):** alma del lugar. Nav, footer, fondos profundos cuando el contenido lo pide. Evoca patio interior, sombra fresca, hoja de plátano envejecida.
- **Accent — Terracota (#B85C3C):** **único impulsor de acción.** CTAs principales (Reservar, Book now), íconos clave, links de alta jerarquía. Una sola dosis por viewport. Es el equivalente visual del barro cocido de los muros coloniales reinterpretados.
- **Gold — Dorado curado (#C9A96E):** detalles de galería. Hairlines de sección, números de unidad, marcos de cards destacados. Nunca para texto largo; máximo 3 elementos por pantalla.
- **Ink — Tierra oscura (#2A1F18):** texto principal. No es negro; es madera-tinta. La diferencia es perceptible en pantallas calibradas y aporta calidez al cuerpo de texto.
- **Surface — Crema (#F5EFE6):** lienzo base. La página entera respira sobre crema; las superficies secundarias (`surface-warm` #EDE3D2, `surface-sand` #E8DCC8) crean profundidad sin sombras.
- **Leaf — Verde claro (#8FA88E):** badges de amenidades, estados positivos, micro-confirmaciones. Hereda del primary pero con luz.

Contraste mínimo WCAG AA: ink (#2A1F18) sobre surface (#F5EFE6) = 13.5:1. Texto blanco sobre primary (#2C4A3E) = 9.4:1. Accent (#B85C3C) sobre surface = 4.7:1 (apto para texto ≥18px y CTAs). Nunca usar `gold` ni `leaf` para texto sobre crema sin verificar contraste por caso.

## Typography

Tres familias, ninguna genérica:

- **Fraunces** (display, serif variable). La voz museo. Optical-size variable activa en `display-xl` y `display-lg`. Pesos 300-500. Es una serif moderna con personalidad editorial — alterna entre rigor de revista de arquitectura y suavidad orgánica según el optical size. **Prohibido usar Inter, Roboto, Arial, Helvetica.**
- **DM Sans** (body, sans humanista). Cuerpo de texto, labels, UI. Diseñada por Colophon para ser legible en pantalla con una calidez geométrica que pega con el material crema.
- **JetBrains Mono** (numérico). Solo precios, fechas, IDs de unidad y código. Aporta precisión técnica sin frialdad.

**Reglas de aplicación:**

- `display-xl` y `display-lg` solo aparecen una vez por página (típicamente el H1 del hero). Nunca dos display en el mismo viewport.
- Headlines (`headline-*`) en Fraunces 400-500. Body en DM Sans 400. Labels en mayúsculas tipo `label-caps` con tracking 0.18em — son las marquesinas de sección.
- Máximo dos pesos de Fraunces y dos pesos de DM Sans por página. Si necesitas más jerarquía, ajusta tamaño o color, no peso.
- Evitar justificación; siempre alineación a la izquierda. Líneas de cuerpo entre 60-75 caracteres (`max-width: 68ch`).
- Subset latin + latin-ext con `font-display: swap`. Preload solo de los pesos del above-the-fold (typ. Fraunces 400 + DM Sans 400).

## Layout

**Modelo:** grid fijo de 12 columnas con max-width 1200px en desktop, fluido con margen 20px en móvil. Ritmo vertical en escala de 8px (`spacing.unit`).

- **Secciones:** separación de 96px entre secciones en desktop (`spacing.section`); 56px en móvil. Las secciones nunca se tocan visualmente sin un `divider-gold` o un cambio de fondo.
- **Containers:** `max-width: 1200px` con padding lateral 48px desktop / 20px móvil. Texto largo (FAQ, blog, legales) capado a 68ch.
- **Asimetría editorial:** las cards de unidades NO están centradas perfectamente. La grid de 3 unidades introduce un offset de 16px en la unidad central para romper la cuadrícula y forzar lectura tipo catálogo. Foto principal del hero ocupa 7 columnas + 5 columnas de respiración, no full-bleed perfecto.
- **Mobile-first:** se diseña primero el viewport 375px. Desktop hereda y abre, no al revés. 70%+ del tráfico de hospitality boutique es móvil.
- **Booking bar sticky:** hero ocupa primer viewport completo; la booking bar se "despega" del hero al scrollear y se vuelve sticky-top con backdrop-blur sutil (10px) y fondo `surface` con 92% alpha.

## Elevation & Depth

Sin sombras pesadas. La profundidad viene de **capas tonales** (variantes de crema y verde) y bordes de 1px en `outline` u `outline-soft`. Cuando se necesita realmente elevación:

- **Reposo:** card sobre surface, sin sombra. Solo cambio de fondo a `surface-warm`.
- **Hover (cards interactivas):** translación 2px arriba + sombra `0 12px 32px -16px rgba(42, 31, 24, 0.18)`. Transición 240ms ease-out.
- **Booking bar sticky:** `0 8px 24px -16px rgba(26, 46, 37, 0.25)`.
- **Modales / drawers:** `0 24px 64px -32px rgba(26, 46, 37, 0.4)` + `backdrop-filter: blur(8px)` sobre overlay primary-deep al 35%.

Los hairlines dorados (`divider-gold`, 1px de `gold`) marcan separaciones editoriales clave: nunca para todo, solo para entrar a una nueva "sala" de la galería (entre Hero y Concepto, entre Unidades y Laureles).

## Shapes

Esquinas redondeadas medias-suaves. Nada totalmente cuadrado (se sentiría brutalist), nada totalmente redondo (se sentiría infantil). El lenguaje de forma evoca cantos curados a mano:

- Cards de unidad y secciones: `rounded.lg` (14px).
- Inputs y FAQ items: `rounded.md` (8px).
- Buttons y badges: `rounded.pill` (capsule completa). Las CTAs de pill terracota son la firma visual del sitio.
- Imágenes en galería: `rounded.lg`. Hero image full-bleed sin bordes redondeados (es la "ventana" abierta a Medellín).
- Iconos: línea de 1.75px stroke, `stroke-linecap: round`, `stroke-linejoin: round`. Lucide como base.

## Components

### Hero

Imagen full-bleed (AVIF <250KB) con `hero-overlay` al 45% en verde-deep para legibilidad. H1 en `display-xl` color `on-primary`, alineado a la izquierda con padding desde el margen del container, no centrado. El subtítulo en `body-lg` color `surface-sand` queda 24px debajo. Booking bar embebida 56px más abajo.

### BookingBar

Componente crítico. Fondo `surface` (#F5EFE6) con padding 16px, border-radius `rounded.lg`, sin borde exterior (la card flota sobre el overlay del hero por contraste tonal). Inputs internos con altura 52px, fondo `surface-warm`. CTA "Reservar" en `button-primary` (terracota pill). En móvil: stack vertical full-width. En desktop: barra horizontal con 4 inputs + botón a la derecha. Lógica de auto-selección por capacity vive en `src/lib/booking.ts`.

### UnitCard

Foto cuadrada arriba (1:1, AVIF, 800px), nombre en `headline-md`, capacidad en `numeric` con badge `leaf-pale`, lista de 3 amenidades clave como `badge-amenity`, CTA "Reservar →" en `button-primary` ancho 100%. La unidad central de la grid lleva un `badge-gold` discreto ("Más reservada" o "Edición jacuzzi"). Hover: translación 2px + cambio a `unit-card-hover`.

### WhatsAppFloat

Bottom-right fijo. 64×64 desktop / 56×56 móvil. Fondo `whatsapp` (#25D366 — color de marca, NO negociable). Icono SVG blanco. Aparece tras 800ms para no penalizar LCP. Sombra pronunciada `0 12px 32px -8px rgba(37, 211, 102, 0.4)` para que destaque sobre cualquier sección. Tooltip al hover en desktop con `body-sm` sobre `primary-deep`.

### Footer

Fondo `primary-deep` (#1A2E25) con texto `surface-sand`. NAP completo, link a robinhouse.co, redes, mapa estático con pin de Casa Laureles 41, repetición del CTA "Reservar". `divider-gold` a 1px separa columnas en desktop.

### CookieBanner

Fondo `cookie-banner` (#1A2E25), texto `surface-sand`. Aparece desde la base con animación 320ms ease-out. Solo primera visita. <5KB de JS.

### LanguageToggle

ES / EN como toggle de píldora en el nav. Estado activo: fondo `primary`, texto `on-primary`. Estado inactivo: transparente con borde `outline-soft`. Persiste en `localStorage` y respeta `Accept-Language` en primera visita.

### Gallery

Embla-carousel horizontal en móvil (snap-mandatory), grid masonry 3 columnas en desktop. Imágenes con `rounded.lg`, lazy load, alt descriptivo obligatorio (la skill image-pipeline lo genera, humano valida).

### FAQItem

Accordion. Pregunta en `headline-sm` color `ink`. Respuesta en `body-md` color `ink-soft`. Icono chevron 16px terracota a la derecha que rota 180° al expandir. Transición de altura con `framer-motion` o CSS pure (`grid-template-rows: 0fr ↔ 1fr`).

### Testimonial

`testimonial-card` con padding 32px. Cita en `headline-sm` con comilla francesa abierta `«` en `display-lg` color `gold`. Nombre en `label-caps` color `accent`. Foto opcional 56px circle con borde 1px `gold`.

## Do's and Don'ts

**Hacer:**

- Usar `accent` (terracota) máximo una vez por viewport, siempre para la acción más importante.
- Mantener máximo dos familias visibles por sección (Fraunces + DM Sans). JetBrains Mono solo aparece donde hay números.
- Respetar el ritmo vertical de 8px. Cada padding, gap y margen es múltiplo de 8.
- Asignar alt descriptivo a TODA imagen — incluso decorativas reciben `alt=""` explícito.
- Validar contraste WCAG AA (4.5:1 normal, 3:1 large) en toda combinación de tokens nueva.
- Mostrar precios con `numeric` y unidad clara ("USD 142 / noche", no "$142").
- Variar fotos entre interior, detalle (textura piedra/madera), exterior (Laureles), gente — para no saturar el ojo de un solo registro.

**No hacer:**

- Usar Inter, Roboto, Arial, Helvetica, system-ui, ni Space Grotesk en NINGÚN componente. Si una fuente no carga, fallback a `serif` o `sans-serif` genérico, nunca a esas familias.
- Mezclar terracota + dorado + verde-claro como acentos en el mismo viewport. Jerarquía: primero terracota, luego dorado para el detalle editorial, verde-claro solo para badges de estado.
- Usar `box-shadow` decorativo en cards en reposo. La profundidad viene del fondo, no de la sombra.
- Aplicar `border-radius` mayor a `rounded.xl` (22px) excepto en pills.
- Inventar tokens nuevos sin pasarlos por DESIGN.md primero. Los colores hardcoded se rechazan en review.
- Dejar texto sobre imagen sin overlay del 35% mínimo en `primary-deep`.
- Usar emojis decorativos en headlines o body. Solo en FAQs y CTAs (✨🙌📍 según voz Housy Host).
- Introducir blanco puro (#FFFFFF) en fondos de página. Si el blanco aparece, es solo en iconografía sobre `primary` o `accent`.
