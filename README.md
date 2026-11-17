# Llameo

App de ritmos (pistas de acompañamiento) para practicar música tradicional. En vivo en **llameo.com**.

Idioma principal: español, con opción de inglés y portugués (Brasil).

## Estructura

```
web/         Versión web (la publicada en llameo.com, vía Cloudflare)
  index.html   Todo el código (HTML + CSS + JS en un solo archivo)
  img/         Portadas e ilustraciones de los ritmos
  au/          Audios de los ritmos (.mp3) — ver nota abajo
prototipo/   Prototipo de la app móvil (mismo diseño, se mantienen sincronizados)
  index.html
  img/
  au/
```

## Audios

Los audios de los ritmos están en `web/au/` y `prototipo/au/`.

`rueda-de-tambor.mp3` y `trombone-mambo.mp3` se dejaron fuera del repositorio a propósito.
El código (`index.html`) todavía los menciona, así que esos dos ritmos no sonarán si se abre esta copia.

## Convenciones del proyecto

- A las pistas se les llama **ritmos** (no "pistas").
- Los ritmos muestran solo el **BPM**, sin tonalidad.
- La web y el prototipo deben mantenerse con el mismo diseño.

## Desarrollo (app nueva)

La app nueva vive junto a los prototipos, que no se tocan hasta el lanzamiento:

```
apps/web/         App web (Next.js)
packages/shared/  Código compartido entre web y la futura app móvil
supabase/         Migraciones, pruebas de la base de datos y funciones
```

Requisitos: Node 24 (ver `.nvmrc`) y Docker (para Supabase local).

```
npm install
npm test          # pruebas
npm run typecheck
npm run build
```
