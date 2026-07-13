# DiDi 🌿 — Diseño del MVP viral

> Documentación de diseño de producto (no es implementación). Cubre los 7 entregables pedidos.
> El nombre del repo es interno; la app pública **no** debe marcarse ni nombrar plataformas reales de transporte (riesgo legal/imagen). El diseño es deliberadamente genérico y no acusatorio.

## Concepto en una línea

Juego de votación masiva de **una pulsación** sobre fotos callejeras de CABA: **¿Posta o Fruta?**. Cada foto es un mercado que **cierra** y queda **sellado como contrato verificable** (consenso humano ponderado + hash-chain, sin blockchain). Sin login, banner arriba desde el segundo cero, monetización por **compras únicas** (sin suscripción), tokens virtuales **$FRU**.

## Entregables

| # | Entregable | Dónde |
|---|---|---|
| 1 | Propuesta de producto | [`docs/DISEÑO-MVP.md`](./docs/DISEÑO-MVP.md) §1 |
| 2 | Arquitectura técnica | [`docs/DISEÑO-MVP.md`](./docs/DISEÑO-MVP.md) §2 |
| 3 | Experiencia de usuario | [`docs/DISEÑO-MVP.md`](./docs/DISEÑO-MVP.md) §3 |
| 4 | Modelo de monetización | [`docs/DISEÑO-MVP.md`](./docs/DISEÑO-MVP.md) §4 |
| 5 | Sistema de validación | [`docs/DISEÑO-MVP.md`](./docs/DISEÑO-MVP.md) §5 + [`docs/validacion.html`](./docs/validacion.html) |
| 6 | Paper técnico | [`docs/PAPER-TECNICO.md`](./docs/PAPER-TECNICO.md) |
| 7 | Hoja de ruta del MVP | [`docs/DISEÑO-MVP.md`](./docs/DISEÑO-MVP.md) §6 |

## Principios no negociables

- **Privacidad por diseño**: blur obligatorio de caras y patentes, moderación, sin geolocalización fina.
- **Marco no acusatorio**: la app mide *opinión agregada*, nunca afirma que un vehículo pertenezca a una plataforma.
- **Sin cash-out**: los $FRU jamás se convierten en dinero ⇒ es un juego, no una apuesta.
- **Revisión legal previa** al lanzamiento (ley 25.326 de datos personales y derechos de imagen).

La página pública [`docs/validacion.html`](./docs/validacion.html) puede publicarse tal cual en GitHub Pages.
