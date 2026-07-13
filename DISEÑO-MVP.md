# JueguitoFru 🌿 — Diseño del MVP viral

> Documento de diseño de producto. **No es código de implementación**: define concepto, arquitectura, UX, monetización, validación y hoja de ruta. Pensado para construirse sobre lo que ya existe en el repo (PWA en un `index.html`, Three.js por CDN, GitHub Pages, modal de "shop" ya presente).

Fecha: 2026-07-09 · Alcance: MVP para lanzar en pocas semanas · Mercado inicial: CABA.

---

## 0. Resumen ejecutivo (TL;DR)

Un juego de **votación masiva de una sola pulsación**. El usuario abre la app y en menos de 2 segundos ya está viendo una foto de una calle de Buenos Aires con un vehículo, y dos botones enormes:

> **¿POSTA o FRUTA?** — ¿ese auto está prestando servicio de transporte, o es fruta?

Vota, ve al instante el porcentaje de la comunidad, gana **$FRU** (tokens virtuales) y comparte una tarjeta. Las fotos son "mercados" que **cierran** a una hora fija y quedan **selladas como contratos** con consenso verificable (inspirado en mercados de predicción tipo Polymarket, pero sin blockchain ni dinero real).

- **Cero fricción**: sin login, sin onboarding, sin suscripción. Identidad anónima por dispositivo.
- **Monetización sin recurrencia**: banner arriba desde el segundo cero + upsells de compra única (revelar resultado, packs de $FRU, imagen generada por IA, "carnet", boost, merch digital).
- **Viralidad**: mecánica binaria absurda + tarjeta compartible + ranking + rachas (el ADN de "¿otaku o peronista?").
- **Marco no acusatorio y con privacidad por diseño**: nunca afirma que un vehículo pertenezca a una plataforma; blur obligatorio de patentes y caras; es humor sobre la duda colectiva, no una denuncia.

Los 7 entregables pedidos están cubiertos: producto (§1), arquitectura (§2), UX (§3), monetización (§4), validación (§5 + `validacion.html`), paper técnico (`PAPER-TECNICO.md`) y hoja de ruta (§6).

---

## 1. Propuesta de producto

### 1.1 El insight de viralidad

Los juegos virales argentinos extremadamente simples ("¿otaku o peronista?", "¿peronista o gorila?") comparten un patrón que vamos a copiar deliberadamente:

| Elemento viral | Cómo lo tienen los referentes | Cómo lo implementamos |
|---|---|---|
| **Decisión binaria absurda** | Otaku/Peronista, Peronista/Gorila | **Posta / Fruta** sobre una foto callejera |
| **Cero contexto, pura intuición** | Solo un fragmento de mano en V | Solo la foto, sin metadatos |
| **Feedback inmediato + puntaje** | "Acertaste", puntos | % de la comunidad + racha + $FRU |
| **Grieta / identidad / humor local** | La grieta política argentina | El folclore porteño del "trucho" y el laburante |
| **Compartible de un toque** | Screenshot del resultado | Tarjeta autogenerada lista para IG/WhatsApp |

Le sumamos una capa que los referentes no tienen y que multiplica el "engagement": **cada foto es un mercado que cierra**. No solo opinás; **apostás** (con tokens virtuales) a lo que va a decidir la comunidad. Eso convierte una opinión desechable en una **predicción con resultado**, con la tensión de "¿tenía razón?". Es el gancho de Polymarket, pero lúdico y gratis.

### 1.2 Qué es (y qué NO es)

- **Es** un juego de consenso colectivo y humor: "¿la comunidad cree que este vehículo está laburando o es fruta?".
- **No es** un sistema que afirme hechos sobre autos, personas o empresas reales. La app **nunca** dice "esto es un Uber". Dice "el 72% de la gente votó *posta*". La verdad del juego es **la percepción agregada**, no un hecho del mundo.
- **No es** apuestas: los $FRU no se retiran ni se convierten en plata. Sin cash-out ⇒ no es juego de azar regulado.

### 1.3 Nombre y marca

- **Marca paraguas**: JueguitoFru 🌿 (ya existente).
- **Slogan de la mecánica**: *"¿Posta o Fruta?"* — encaja con el "Fru" (fruta = trucho/verso en lunfardo) y es no acusatorio.
- **Token virtual**: **$FRU** 🍏 (o "Frutas"). Puramente virtual.
- **Personaje**: reutilizamos el avatar con cara mapeada desde foto que ya existe en el repo (`assets/face.jpg`) como mascota/host que narra las rondas.

### 1.4 El activo que ya tenés y hay que aprovechar

El repo ya trae una **escena 3D de una cuadra de CABA** (autos al cordón, edificio, reja, personaje). En vez de tirarla, es el **"modo inmersivo"**: la portada y el share card salen de esa escena, y las fotos a votar pueden mostrarse como carteles/pantallas dentro de la cuadra. Diferenciador visual fuerte frente a un juego 2D plano.

---

## 2. Arquitectura técnica

### 2.1 Principios

1. **Edge-first y cacheable**: el 95% del tráfico es "dame una foto / recibí un voto". Debe servirse desde caché/CDN, no desde una base transaccional.
2. **Serverless**: nada de servidores que mantener; escala a cero cuando no hay tráfico y absorbe picos virales.
3. **Anónimo por defecto**: identidad = ID de dispositivo firmado, no cuenta.
4. **Privacy & safety por diseño**: blur obligatorio, moderación, sin geolocalización fina publicada.
5. **Consenso verificable sin blockchain**: hash-chain / Merkle root público de resultados cerrados.

### 2.2 Diagrama de alto nivel

```
                 ┌───────────────────────────┐
   iPhone/Android│   PWA (index.html + SW)   │  ← Add to Home Screen, offline shell
   navegador     │  Three.js escena + UI 1-tap│
                 └─────────────┬─────────────┘
                               │ HTTPS (fetch /api/*)
                 ┌─────────────▼─────────────┐
                 │   Edge Functions (Workers /│  stateless, geodistribuidas
                 │   Vercel Edge)             │
                 └───┬───────────┬────────┬───┘
        lectura caché│           │escritura│  media
             ┌───────▼──┐  ┌─────▼────┐ ┌─▼──────────┐
             │ Redis     │  │ Postgres │ │ Object store│
             │ (Upstash) │  │ (Neon/   │ │ (R2/S3)     │
             │ tallies,  │  │ Supabase)│ │ fotos+blur  │
             │ feed, hot │  │ votos,   │ └─────────────┘
             │ markets   │  │ mercados,│
             └───────────┘  │ ledger   │
                            └──────────┘
        ┌───────────────┐   ┌───────────────┐   ┌──────────────┐
        │ Cron: cierre  │   │ Cola: pipeline │   │ Pagos:        │
        │ de rondas +   │   │ de imagen      │   │ Mercado Pago  │
        │ Merkle root   │   │ (blur, thumbs, │   │ (compra única)│
        │ (settlement)  │   │ moderación)    │   │ + entitlements│
        └───────────────┘   └───────────────┘   └──────────────┘
```

### 2.3 Componentes

| Capa | Elección recomendada | Por qué |
|---|---|---|
| **Frontend** | Mantener PWA en `index.html`; sumar `manifest.webmanifest` + Service Worker. UI de votación en vanilla JS/Three.js. | Cero build, ya funciona en GitHub Pages, instalable en iPhone. |
| **Hosting estático** | GitHub Pages (hoy) → Cloudflare Pages/Vercel al crecer | CDN global, HTTPS, gratis. |
| **API** | Cloudflare Workers **o** Vercel Edge Functions | Escala a cero, baja latencia en LATAM, buen free tier. |
| **Datos calientes** | Redis (Upstash) | Tallies de votos, feed de "próxima foto", mercados abiertos. Ver paper §caché. |
| **Datos duraderos** | Postgres (Neon o Supabase) | Votos crudos, mercados, reputación, ledger de resultados. |
| **Media** | Cloudflare R2 / S3 + CDN | Fotos originales (privadas) y versiones blureadas (públicas). |
| **Pipeline imagen** | Cola + worker (detección de caras/patentes → blur) | Privacidad obligatoria antes de publicar. |
| **Pagos** | Mercado Pago (checkout único) | Estándar en Argentina, soporta pago único sin suscripción. |
| **Ads** | Ad network (banner) + house ads propias al arranque | Ingreso desde el minuto uno. |
| **IA imagen** | API de generación (server-side, con budget por compra) | Upsell de "carnet"/auto generado. |

### 2.4 Modelo de datos (mínimo)

```
device(id, created_at, reputation, seguidores...)          -- identidad anónima
market(id, photo_id, question, opens_at, closes_at,
       status[open|closed], consensus_pct, settle_hash)
vote(id, market_id, device_id, side[posta|fruta],
     stake_fru, weight, created_at)                        -- 1 voto por device/market
photo(id, uploader_device, blurred_url, status[queue|live|rejected], is_honeypot, truth)
ledger(round_id, closed_at, markets_json, merkle_root, prev_root)  -- cadena de hashes
wallet(device_id, fru_balance, lifetime_earned)
purchase(id, device_id, sku, amount, mp_payment_id, granted_at)    -- upsells
```

### 2.5 Notas sobre distribución en iPhone sin cuentas (respuesta a "¿PWA u otra cosa?")

Recomendación: **PWA web-first**, y sólo si más adelante querés estar en la App Store, envolver con **Capacitor**. Comparación:

| Opción | Sin registro | iPhone | Fricción | Push | Costo | Veredicto |
|---|---|---|---|---|---|---|
| **PWA (recomendada)** | ✅ | ✅ Safari + "Agregar a inicio" | Mínima (una URL) | ✅ desde iOS 16.4 (sólo si se instala en inicio) | $0 | **Elegida para el MVP** |
| Web pura sin instalar | ✅ | ✅ | Cero | ❌ | $0 | Fallback siempre disponible |
| Capacitor (wrapper nativo) | ✅ (sin login) | ✅ App Store | Alta (revisión Apple, $99/año) | ✅ | $99/año | Fase 2 si querés push confiable/ASO |
| React Native / nativo | ✅ | ✅ | Muy alta | ✅ | Alto | Sobredimensionado para esto |

**Limitaciones de PWA en iOS a mitigar**: (a) push sólo si el usuario "Agrega a inicio" → mostrar un prompt suave tras la 2ª partida; (b) el almacenamiento se puede desalojar → los $FRU y la racha viven en el server ligado al device-id, no sólo en `localStorage`; (c) no hay pantalla de "instalación" nativa → una animación breve enseñando "Compartir → Agregar a inicio".

La distribución real es **el share card**: el 90% del crecimiento viene de WhatsApp/IG/TikTok, no de una store.

---

## 3. Experiencia de usuario

### 3.1 Primer minuto (el que define todo)

```
[0.0s]  Abre la URL. Se ve el banner arriba + una foto + dos botones gigantes.
        No hay splash de login. No hay "aceptar cookies" invasivo.
[0.5s]  Lee la pregunta: "¿POSTA o FRUTA?"
[2.0s]  Toca POSTA.
        → Animación: se revela el % de la comunidad (ej. "68% dijo POSTA").
        → "+5 🍏 $FRU"  ·  "Racha: 1 🔥"
[3.0s]  Aparece automáticamente la SIGUIENTE foto. Loop infinito y adictivo.
[~5 fotos] Aparece de forma no intrusiva: "¿La compartís?" (tarjeta) y
        "Agregá a inicio para no perder tu racha".
```

Regla de oro: **nunca** interrumpir el loop votar→revelar→siguiente en los primeros 60 segundos. Todo upsell y todo pedido de instalación llega **después** del primer subidón de dopamina.

### 3.2 Pantallas (MVP)

1. **Jugar** (home): banner, foto, Posta/Fruta, contador de racha y $FRU, feed infinito.
2. **Revelar/Resultado**: % en vivo del mercado abierto; si ya cerró, muestra el "contrato sellado".
3. **Rondas / Contratos**: lista de mercados cerrados con su consenso final y hash (link a `validacion.html`). Es la vitrina de "seriedad/confianza".
4. **Subir foto**: cámara → auto-blur previsualizado → enviar a moderación. Con aviso de reglas (sin caras/patentes, sin datos personales).
5. **Mi cuenta (anónima)**: balance $FRU, racha, aciertos, cosméticos comprados, "seguir mi progreso" (opcional, generar código de respaldo).
6. **Tienda** (reusar el modal shop existente): upsells.

### 3.3 Bucles de retención

- **Racha diaria**: "Volvé mañana, cerró la ronda de anoche, mirá si acertaste" → notificación (si instaló) o al reabrir.
- **Mercados que cierran**: crea cita ("a las 21 cierra la ronda"), como Wordle diario.
- **Ranking semanal** por aciertos y por $FRU ganados.
- **Earn-by-playing (fase 2)**: los $FRU se gastan en cosméticos, boosts y generaciones de IA. Nunca en plata.

### 3.4 Accesibilidad y confianza

- Botón **Reportar** en cada foto (doxxing, dato personal, contenido indebido).
- Aviso permanente y liviano: *"Es un juego. Los porcentajes son opinión de la comunidad, no afirman hechos."*
- Idioma: español rioplatense.

---

## 4. Modelo de monetización (sin suscripción)

### 4.1 Banner desde el segundo cero

Franja superior fija con anuncio. Arranca con **house ads** propias (auto-promo de packs $FRU / merch) mientras se aprueba una red de anuncios; luego red programática. KPI: eCPM y viewability; no tapar nunca los botones de voto.

### 4.2 Catálogo de upsells (todos de compra ÚNICA)

| SKU | Qué es | Gancho psicológico | ARPU esperado |
|---|---|---|---|
| **Revelar ya** 👁️ | Ver el consenso antes del cierre de la ronda | Impaciencia / FOMO | Micro ($) alto volumen |
| **Pack $FRU** 🍏 | Comprás tokens virtuales para stakear más fuerte | Progresión de juego (tipo monedas de Candy Crush) | Micro-medio |
| **Carnet / credencial generada por IA** 🪪 | Genera una imagen humorística tuya ("Inspector Anti-Fruta nivel Oro") lista para compartir | Identidad + estatus + viralidad | **Alto** (one-off premium) |
| **Auto trucho generado** 🚗 | Imagen IA de "tu" vehículo de fantasía | Creatividad, compartible | Alto |
| **Boost de foto** 🚀 | Tu foto subida arranca arriba en la ronda | Competitividad del que sube | Medio |
| **Cosméticos** 🎨 | Skins del avatar (reusa el face-mapping existente), sellos, marcos del contrato | Personalización | Medio |
| **Marco NFT-like (no cripto)** 🖼️ | Descargás tu "contrato cerrado" como estampa firmada/hasheada | Coleccionismo | Medio |
| **Merch digital → físico (fase 2)** 🏷️ | Stickers/print-on-demand | Fandom | Variable |

Estrategia de **ARPU sin recurrencia**: mezclar muchos micropagos consumibles (revelar, packs, boost) con **uno o dos productos premium de alto valor y alta compartibilidad** (carnet/imagen IA). El premium compartible es a la vez ingreso **y** motor viral (cada carnet compartido trae usuarios).

### 4.3 Reglas para no cruzar líneas legales

- **Sin cash-out** de $FRU jamás → no es juego de azar.
- Compra de $FRU = compra de bien virtual de consumo (como monedas de un free-to-play), no inversión.
- Publicidad y compras separadas del contenido sensible; nada de segmentar por datos personales de terceros.

### 4.4 Pagos

Mercado Pago checkout de pago único → webhook → `purchase` + `entitlement` server-side ligado al device-id. Nunca confiar en el cliente para conceder beneficios.

---

## 5. Sistema de validación (consenso tipo mercado de predicción, sin blockchain)

> La página pública que explica esto está en `docs/validacion.html` (autocontenida, lista para publicar).

### 5.1 Ciclo de vida de un mercado

```
   ABIERTO ──votos + stakes $FRU──►  se acumula consenso en caché (Redis)
      │
      │  llega closes_at (hora fija de la ronda)
      ▼
   CIERRE (settlement por el cron):
      1. Se congela el tally: consensus_pct = posta/(posta+fruta) ponderado.
      2. Se marca el resultado (POSTA / FRUTA / EMPATE) según umbral.
      3. Se paga $FRU a quienes apostaron al lado ganador (payout ∝ stake · rareza del acierto).
      4. Se escribe una fila inmutable en `ledger` con:
         market_id, consenso, nº de votos, timestamp, y un HASH que encadena
         con el resultado anterior (hash-chain) + Merkle root de la ronda.
      ▼
   CERRADO ("contrato sellado"): ya no se puede votar; queda público y verificable.
```

### 5.2 Por qué es "verificable" sin blockchain

- Cada ronda cerrada produce un **Merkle root** de todos sus mercados, y cada root **encadena con el anterior** (`prev_root`). Publicamos la cadena de roots.
- Cualquiera puede recomputar el hash de un resultado y verificar que no se alteró a posteriori (misma propiedad de integridad que una blockchain, sin el costo/energía de una).
- Transparencia = **append-only + hashes públicos**, no un ledger distribuido.
- Se puede migrar a anclar el root en una blockchain pública más adelante si se quiere "notarización" externa, pero no es necesario para transmitir confianza.

### 5.3 Consenso ponderado (inspiración CAPTCHA + anti-fraude)

El voto no es "1 persona = 1 voto ciego". Está **ponderado por reputación**, y la reputación se calibra con **honeypots** (fotos de respuesta conocida mezcladas en el feed, igual que reCAPTCHA mezcla imágenes ya etiquetadas):

- Cada tanto aparece un honeypot con verdad conocida. Quien vota bien sube reputación/peso; quien vota mal (o como bot) baja.
- El consenso final pondera por reputación → resistente a brigadeo y bots.
- Además: rate-limit por device, proof-of-work liviano ante sospecha, detección de patrones (mismos tiempos de respuesta, IPs, etc.).

Todo el detalle técnico (CAPTCHA, caché, antifraude, escalabilidad, ventajas/limitaciones) está desarrollado en **`docs/PAPER-TECNICO.md`**.

### 5.4 Tokens virtuales

- $FRU es **contable en el server** (tabla `wallet`), no on-chain.
- Se ganan votando bien y se gastan en cosméticos/boosts/IA.
- Fase 2 "earn-by-playing": economía cerrada, sin conversión a dinero, con sumideros (sinks) para controlar inflación (cosméticos, generaciones IA, boosts). Se detalla como arquitectura escalable, sin fijar aún los números económicos.

---

## 6. Hoja de ruta del MVP (pocas semanas)

Supuesto: 1–2 devs. Cada semana termina en algo **desplegado y jugable**.

### Semana 0 — Definición y blindaje (2–3 días)
- Cerrar naming, reglas del juego y **política de privacidad/moderación** (blur obligatorio, sin caras/patentes, marco no acusatorio). **Consultar a un abogado** por ley 25.326 (datos personales) y derechos de imagen.
- Wireframes de las 6 pantallas. Set semilla de ~50 fotos curadas y anonimizadas para arrancar sin depender de subidas.

### Semana 1 — Núcleo jugable (el gancho)
- PWA: `manifest` + service worker + "agregar a inicio".
- Loop votar→revelar→siguiente con el set semilla. % en vivo (Redis).
- $FRU y racha ligados al device-id. **Banner** (house ads) arriba.
- **Share card** autogenerado (usa la escena 3D existente para el fondo).
- Deploy en GitHub Pages + Edge Functions.
- ✅ *Entregable: se puede jugar y compartir. Ya podría volverse viral.*

### Semana 2 — Rondas, contratos y contenido de la comunidad
- Mercados que **cierran** por cron + página de **Contratos cerrados** + `validacion.html` con la cadena de hashes.
- **Subida de fotos** con **auto-blur** (caras/patentes) + cola de **moderación** + botón Reportar.
- Reputación + honeypots v1.
- ✅ *Entregable: consenso verificable y contenido generado por usuarios, seguro.*

### Semana 3 — Monetización
- Integración **Mercado Pago** (compra única) + entitlements server-side.
- Upsells: **Revelar ya**, **Pack $FRU**, **Boost**, y el premium **Carnet/imagen IA**.
- Reusar el modal `shop` existente como tienda.
- Analítica de conversión y de viralidad (coef. de invitación).
- ✅ *Entregable: ingresos reales (ads + upsells) sin suscripción.*

### Semana 4 — Pulido, antifraude y lanzamiento beta
- Antifraude v1 (rate-limit, proof-of-work liviano, detección de brigadeo).
- Prueba de carga y validación de la estrategia de **caché** (feed y tallies).
- Ranking semanal, notificaciones de cierre de ronda (para instalados).
- Lanzamiento beta + campaña de siembra viral (micro-influencers locales, WhatsApp).
- ✅ *Entregable: producto lanzable y medible.*

### Post-MVP (fase 2)
- Earn-by-playing con economía cerrada balanceada (sinks/sources).
- Capacitor para App Store + push confiable si los números lo justifican.
- Merch físico print-on-demand.
- Notarización externa opcional del Merkle root.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Privacidad/legal** (caras, patentes, señalar personas reales) | Blur obligatorio, moderación, sin geolocalización fina, marco no acusatorio, revisión legal, botón Reportar. **Bloqueante para lanzar.** |
| Percepción de "denuncia/persecución" | Copy siempre humorístico; la app mide *opinión*, no *hechos*; sin nombrar plataformas ni personas. |
| Bots/brigadeo distorsionan el consenso | Voto ponderado por reputación + honeypots + antifraude (ver paper). |
| Costos de IA/imágenes en el upsell | Presupuesto por compra; se genera sólo tras pago. |
| Dependencia de subidas de usuarios | Set semilla curado + gamificar la subida. |
| Fatiga del loop | Rondas diarias tipo Wordle + ranking + cosméticos. |

---

## 8. Mapa a los 7 entregables pedidos

1. **Propuesta de producto** → §1
2. **Arquitectura técnica** → §2
3. **Experiencia de usuario** → §3
4. **Modelo de monetización** → §4
5. **Sistema de validación** → §5 + `docs/validacion.html`
6. **Paper técnico** → `docs/PAPER-TECNICO.md`
7. **Hoja de ruta del MVP** → §6
