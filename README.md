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
El código (`index.html`) todavía usa `rueda-de-tambor.mp3` (ritmo «Rueda de Tambor»), así que ese ritmo no sonará si se abre esta copia.
`trombone-mambo` ya no aparece en el código; solo queda su portada en `img/`.

`web/au/cumbia-de-la-calle.mp3` está en el repositorio pero ningún ritmo lo usa todavía.

## Estado: demo

Lo publicado es una demo sin servidor: las cuentas no se guardan, la grabación se simula con un sonido de ejemplo
y los llameos, tomas y publicaciones se borran al recargar la página.

## Convenciones del proyecto

- A las pistas se les llama **ritmos** (no "pistas").
- Los ritmos muestran solo el **BPM**, sin tonalidad.
- La web y el prototipo deben mantenerse con el mismo diseño.
