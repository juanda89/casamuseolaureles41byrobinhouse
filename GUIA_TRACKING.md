# Guía: Search Console + Bing + GA4 + GTM

Pasos para que el sitio empiece a indexarse en Google y midamos el tráfico. Todo gratuito.

---

## 1. Google Search Console (15 min)

**Para qué:** que Google indexe el sitio, ver qué keywords te encuentran, monitorear errores de SEO.

1. Entra a https://search.google.com/search-console con tu cuenta Google.
2. Click **"Agregar propiedad"** → elige **"Dominio"** (no URL prefix).
3. Pega `casamuseolaureles.com` → continúa.
4. Google te muestra un registro **TXT** que tienes que pegar en GoDaddy DNS:
   - Type: `TXT`
   - Name: `@`
   - Value: `google-site-verification=AaBbCc...` (te lo da Google)
   - TTL: 600 seconds
5. Vuelves a Search Console y click **Verify**. Tarda 1-5 min.
6. Una vez verificado:
   - **Sitemaps** (menú izquierdo) → pegar `https://casamuseolaureles.com/sitemap-index.xml` → submit.
   - **URL Inspection** → pegar `https://casamuseolaureles.com/es` → "Request indexing".
7. Repite el "Request indexing" para `/en`, `/es/laureles`, `/es/faq`, y las 3 unidades. Esto fuerza a Google a indexar antes.

📌 Pásame el ID de verificación o el código si quieres que lo agregue a tu DNS — solo es leer y agregar el TXT.

## 2. Bing Webmaster Tools (5 min)

**Para qué:** Bing alimenta Copilot y ChatGPT (cuando responde sobre lugares). 10% del tráfico SEO viene de aquí.

1. Entra a https://www.bing.com/webmasters con tu cuenta Microsoft (o crea una).
2. Click **"Import from Google Search Console"** — Bing copia todo automáticamente. ✨ Esto te ahorra repetir verificación.
3. Submit sitemap: `https://casamuseolaureles.com/sitemap-index.xml`.

## 3. Google Analytics 4 (10 min)

**Para qué:** medir tráfico, de dónde vienen, qué buscan, cuántos clicks al booking de Housy.

1. Entra a https://analytics.google.com con tu cuenta Google.
2. Click **"Admin"** → **"Crear cuenta"** → nombra "Casa Laureles 41".
3. **Crear propiedad** → "Casa Museo Web" → zona horaria America/Bogotá → moneda COP.
4. **Crear flujo de datos** → "Web" → URL `https://casamuseolaureles.com` → nombre "Sitio principal".
5. Te da un **Measurement ID** del tipo `G-XXXXXXXXXX`. **Cópialo.**
6. En Vercel: Settings → Environment Variables → agregar:
   - **Key:** `PUBLIC_GA4_ID`
   - **Value:** `G-XXXXXXXXXX` (el que copiaste)
   - **Environment:** Production, Preview, Development (todas)
7. Click **Save** y luego en Deployments → último deploy → "Redeploy".
8. Listo. 10-15 min después GA4 empieza a recibir datos.

## 4. Google Tag Manager (opcional, 10 min)

GTM es un contenedor donde metes GA4 + cualquier otro pixel (Meta, TikTok, Hotjar) sin tocar código. Si planeas agregar más cosas, vale la pena. Si solo es GA4, salta este paso.

1. https://tagmanager.google.com → crear cuenta → contenedor "Casa Museo Web".
2. Te da un ID `GTM-XXXXXXX`.
3. En GTM: agregar tag de GA4 con el Measurement ID del paso 3.
4. En Vercel: agrega `PUBLIC_GTM_ID=GTM-XXXXXXX` y **borra** `PUBLIC_GA4_ID` (GTM ya carga GA4 por dentro).

## 5. Eventos personalizados que ya están listos en el código

Cuando GA4 esté conectado, vas a ver automáticamente estos eventos:

| Evento | Cuándo se dispara | Para qué sirve |
|---|---|---|
| `booking_intent` | Click en "Reservar" del booking widget | **El más importante** — mide intención de reserva. Lo correlacionas con reservas confirmadas en Housy para sacar conversión. |
| `whatsapp_click` | Click en el botón flotante de WhatsApp | Mide leads warm (gente que prefiere chat). |
| `page_view` | Cada página que se visita | Tráfico básico. |

En GA4 vas a "Reports → Events" y los ves filtrar.

## 6. Configurar conversiones en GA4

1. Admin → Eventos → marca `booking_intent` y `whatsapp_click` como **Conversiones** (toggle).
2. En Reports → Engagement → Conversions vas a ver el funnel.

## 7. Dashboard recomendado en Looker Studio

Lookerstudio.google.com → "Crear" → conecta tu propiedad GA4 + Search Console.
Plantilla de hospitality: filtra por idioma (es/en), por unit (`booking_intent` parameter), por canal (organic / direct / referral).

---

## Cuando termines — pásame:

1. **GA4 Measurement ID** (`G-XXXXXXXXXX`) → lo agrego al `.env` y al `CUENTAS.md`.
2. (Opcional) **GTM ID** (`GTM-XXXXXXX`) si vas por la ruta de Tag Manager.
3. **Confirmación** que ya verificaste GSC + Bing.

Y disparamos el redeploy.
