# Paper técnico — JueguitoFru 🌿

### Consenso humano, caché y validación verificable para un juego de votación masiva

**Tipo:** paper conceptual de arquitectura. No pretende ser una implementación, sino **justificar técnicamente** por qué las ideas elegidas tienen sentido, sus supuestos, ventajas y límites.

**Fecha:** 2026-07-09 · **Ámbito:** MVP web/PWA · **Autor:** equipo JueguitoFru.

---

## Resumen

JueguitoFru es un juego de participación masiva donde la comunidad clasifica fotografías callejeras de la Ciudad de Buenos Aires mediante una decisión binaria (**Posta / Fruta**). El sistema no afirma hechos: produce y publica un **consenso agregado** por cada foto, que se "cierra" en momentos determinados y queda **sellado como un contrato verificable**. Este paper describe (1) el funcionamiento general, (2) el mecanismo de consenso y validación inspirado en mercados de predicción, (3) el uso del acto de votar como **CAPTCHA** de participación humana, (4) el rol de la **memoria caché** para escalar, (5) mecanismos **antifraude**, (6) la **arquitectura escalable** y (7) ventajas y limitaciones.

---

## 1. Funcionamiento general

Cada fotografía se modela como un **mercado binario** con una pregunta ("¿este vehículo presta servicio de transporte?") y dos posiciones: `POSTA` y `FRUTA`. Los usuarios —identificados de forma anónima por un **device-id** firmado, sin cuenta— emiten un voto y, opcionalmente, respaldan su posición con **tokens virtuales $FRU** (sin valor monetario ni conversión a dinero).

Un mercado transita por tres estados:

```
ABIERTO ──►  CIERRE (settlement)  ──►  CERRADO (contrato sellado)
   ▲                 │
   │                 └─ paga $FRU al lado ganador y escribe el resultado inmutable
recibe votos y stakes
```

El resultado del juego **no es la verdad del mundo físico**, sino la **percepción agregada y ponderada de la comunidad** en el momento del cierre. Esta distinción es deliberada: evita convertir la app en un instrumento de acusación y la mantiene en el terreno lúdico.

---

## 2. Sistema de consenso y validación

### 2.1 Inspiración en mercados de predicción

Tomamos de Polymarket la **idea conceptual**, no la implementación:

- Un evento con resultado binario y una **probabilidad implícita** que emerge de la participación (aquí, el % de votos ponderados en lugar de precios de órdenes).
- Un momento de **resolución** ("settlement") tras el cual el resultado queda fijo.
- Un incentivo por **acertar el consenso** (payout en $FRU), que premia la calibración y no el ruido.

Diferencias clave: no hay order-book, ni dinero real, ni oráculo externo, ni contratos on-chain. El "oráculo" es la **propia comunidad ponderada**; el activo es virtual; la resolución la ejecuta un **cron determinista**.

### 2.2 Voto ponderado por reputación

Un voto no vale "1" de forma ciega. El consenso se computa como:

```
consenso_posta = Σ (peso_i · [voto_i = POSTA])  /  Σ peso_i
```

donde `peso_i` es la reputación del votante `i`. La reputación se calibra con honeypots (§3.1). Esto da robustez frente a bots y brigadeo: mil cuentas nuevas sin reputación no mueven el consenso tanto como unos pocos votantes calibrados.

### 2.3 Cierre y sellado verificable (sin blockchain)

Al cerrar una **ronda** (conjunto de mercados que vencen a la misma hora), el settlement:

1. Congela el tally ponderado de cada mercado.
2. Determina `POSTA / FRUTA / EMPATE` según umbral.
3. Paga $FRU al lado ganador (payout proporcional al stake y a la "rareza" del acierto: acertar contra la corriente paga más).
4. Serializa el resultado y calcula, para la ronda, un **Merkle root** de todos sus mercados.
5. Encadena ese root con el de la ronda anterior: `root_n = H(prev_root ‖ merkle_n)`.

La **cadena de roots** se publica. Propiedad obtenida: **integridad append-only** —cualquiera recomputa el hash de un resultado y verifica que no fue alterado después—, que es exactamente la garantía que la gente asocia a "blockchain", pero sin ledger distribuido, sin tokens on-chain y sin costo energético. Si en el futuro se quisiera notarización externa, basta con **anclar periódicamente el último root** en una cadena pública; es un add-on, no un requisito.

> **Por qué tiene sentido:** el objetivo es *transmitir confianza y consenso verificable*, no descentralizar la custodia de valor. Para integridad y auditabilidad, un hash-chain/Merkle append-only es suficiente y órdenes de magnitud más simple y barato que una blockchain real.

---

## 3. Inspiración en CAPTCHA: la participación humana como recurso

El insight central: **el acto de jugar es, a la vez, una tarea de etiquetado humano**, igual que reCAPTCHA convirtió el "demostrá que sos humano" en digitalización de libros y etiquetado de imágenes.

### 3.1 Doble función del voto

Cada voto cumple dos roles simultáneos:

1. **Contenido del juego** (opinión que alimenta el consenso).
2. **Prueba de humanidad + etiqueta de datos.** Intercalamos **honeypots**: fotos con verdad conocida (curadas por moderación). El comportamiento del usuario ante honeypots:
   - calibra su **reputación/peso** (§2.2),
   - filtra bots (un bot random falla los honeypots),
   - y produce un **dataset etiquetado** por consenso humano como subproducto.

```
feed = [ foto_real, foto_real, HONEYPOT, foto_real, HONEYPOT, ... ]
                                  │                    │
                                  └── calibra reputación y detecta bots ──┘
```

### 3.2 Por qué tiene sentido

- **Sin fricción añadida**: no metemos un CAPTCHA aparte; la verificación humana está fundida en la mecánica, preservando la promesa de "abrir y jugar".
- **Ground truth móvil**: los honeypots resueltos por amplio consenso pueden promoverse a nuevos honeypots, expandiendo el set de control sin trabajo manual (mismo bootstrapping que reCAPTCHA con palabras conocidas/desconocidas).
- **Anti-automatización**: la señal de humanidad sale gratis del propio engagement.

---

## 4. Memoria caché para optimizar el procesamiento

El patrón de carga es **lectura-dominante y "hot"**: millones de "dame la próxima foto" y "sumá mi voto", concentrados en pocos mercados abiertos. Una base transaccional atendiendo cada request sería el cuello de botella. Estrategia:

### 4.1 Qué se cachea y por qué

| Dato | Dónde | Patrón | Razón |
|---|---|---|---|
| **Feed de próximas fotos** | Redis (lista/set) + CDN de imágenes | Lectura masiva | Servir la foto siguiente sin tocar Postgres. |
| **Tally en vivo** (posta/fruta ponderado) | Redis (contadores atómicos `INCRBY`) | Escritura+lectura alta | Actualizar el % sin una transacción por voto. |
| **Mercados cerrados** | CDN/Edge cache, TTL largo/inmutable | Sólo lectura | Un contrato sellado no cambia: cacheable "para siempre". |
| **Imágenes blureadas** | Object store + CDN | Sólo lectura | Estáticas e inmutables. |

### 4.2 Escritura desacoplada (write-behind)

Los votos se **acumulan primero en Redis** (contador atómico) y se **persisten en batch** a Postgres de forma asíncrona (cola). Así:

- El camino caliente (voto → +1 en contador → devolver % actualizado) es **O(1) en memoria**, sin latencia de disco.
- Postgres recibe escrituras agregadas, no una por voto → soporta picos virales.
- Riesgo asumido y su límite: ante caída de Redis podría perderse una ventana de votos recientes; aceptable para un juego (no es un sistema financiero). Se mitiga con append-log liviano.

### 4.3 Cache de resultados de cómputo pesado

Las **imágenes generadas por IA** (upsell) y los **thumbnails/blur** se computan una vez y se cachean por hash del input, evitando reprocesar. Los payouts de una ronda se calculan una sola vez en el settlement y quedan materializados.

> **Por qué tiene sentido:** separar "estado caliente efímero" (caché) de "verdad duradera" (DB) es el patrón estándar para cargas de lectura intensiva con picos; permite escalar horizontalmente y a costo casi cero en reposo (serverless + escala a cero).

---

## 5. Mecanismos antifraude

Amenazas: bots que votan en masa, brigadeo coordinado, sock-puppets para inflar un mercado o farmear $FRU, subida de contenido malicioso/doxxing.

| Vector | Defensa |
|---|---|
| **Bots masivos** | Reputación por honeypots (§3): sin reputación no mueven el consenso; fallan honeypots y quedan down-weighted. |
| **Rate / velocidad inhumana** | Rate-limit por device-id/IP; detección de tiempos de respuesta demasiado uniformes o rápidos. |
| **Sock-puppets / Sybil** | Voto único por device/market; peso arranca bajo y se gana con el tiempo; **proof-of-work liviano** en cliente ante señales de sospecha (encarece crear identidades a escala). |
| **Brigadeo coordinado** | Consenso ponderado + detección de anomalías (picos correlacionados en IP/tiempo/geolocalización aproximada). |
| **Farmeo de $FRU** | Payout ligado a acertar el consenso *ponderado* (no a votar mucho); economía cerrada con sinks; sin cash-out ⇒ el fraude no tiene salida a dinero. |
| **Contenido dañino / doxxing** | **Blur obligatorio** de caras y patentes en el pipeline antes de publicar; cola de moderación; botón Reportar; hashing de imágenes para bloquear reenvíos ya rechazados. |

> **Por qué tiene sentido:** ningún mecanismo aislado alcanza; la defensa es **en capas** y, crucialmente, el diseño elimina el *incentivo económico* del fraude (sin cash-out) y funde la señal antibot con la mecánica (honeypots), lo que da mucha robustez a bajo costo.

---

## 6. Arquitectura escalable

- **Frontend PWA estático** servido por CDN (escala infinita, costo marginal ~0).
- **API en Edge Functions** stateless → escala horizontal automática, cercanía geográfica (LATAM), escala a cero en reposo.
- **Redis** para estado caliente; **Postgres** para verdad duradera; **object store + CDN** para media inmutable. Cada capa escala de forma independiente.
- **Trabajo pesado en colas** (blur, moderación, generación IA, settlement) → desacoplado del request del usuario; se puede paralelizar y reintentar.
- **Settlement por cron determinista** → coste acotado y predecible por ronda.
- **Multi-región y particionable**: los mercados son independientes entre sí (sharding natural por market_id); el consenso de uno no bloquea a otro.

Resultado: la app absorbe un pico viral (que es el objetivo del negocio) sin reingeniería, y en valle cuesta casi nada.

---

## 7. Ventajas y limitaciones

### Ventajas
- **Fricción mínima**: sin login, sin onboarding; la verificación humana está fundida en el juego.
- **Confianza sin blockchain**: integridad verificable (hash-chain/Merkle) a costo y complejidad muy bajos.
- **Escala barata**: serverless + caché + media inmutable ⇒ escala a cero en reposo, absorbe picos virales.
- **Antifraude estructural**: honeypots + reputación + ausencia de cash-out quitan incentivo y capacidad al fraude.
- **Datos como subproducto**: dataset humano-etiquetado por consenso, sin costo de anotación dedicado.

### Limitaciones y supuestos
- **El consenso no es verdad objetiva**: mide percepción agregada. Es una elección de diseño (ético y legal), no un defecto, pero hay que comunicarlo con claridad.
- **Arranque en frío del ground truth**: los primeros honeypots requieren curaduría humana hasta que el consenso sea confiable.
- **Reputación explotable a largo plazo**: cuentas "durmientes" que acumulan reputación honesta y luego la usan para brigadear; se mitiga con detección de cambios bruscos de comportamiento, no se elimina.
- **Privacidad depende del pipeline**: si el blur falla, hay riesgo real de daño; por eso es bloqueante y requiere revisión humana en el MVP.
- **Consistencia eventual**: el % en vivo puede ir levemente atrasado respecto a la DB (write-behind); irrelevante para un juego, inaceptable si algún día esto tocara dinero real (no es el caso).
- **PWA en iOS**: limitaciones de push/almacenamiento (ver documento de diseño §2.5); mitigables pero no ideales frente a nativo.

---

## 8. Conclusión

La combinación —consenso humano ponderado + sellado verificable por hash-chain + participación-como-CAPTCHA + caché write-behind + antifraude en capas— permite construir un juego viral de participación masiva que es **simple para el usuario, barato de operar, difícil de defraudar y creíble en su validación**, sin recurrir a blockchain real ni a dinero de por medio. Cada pieza está elegida por una razón concreta y con sus límites explicitados; ninguna requiere infraestructura pesada para el MVP, y todas admiten evolución (notarización externa, earn-by-playing, nativo) sin rehacer el núcleo.
