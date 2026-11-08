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

Los `.mp3` (unos 100 MB entre las dos versiones) no van en este primer paquete.
`index.html` los busca en `au/` con estos nombres:

01.mp3 … 14.mp3, caliente, cumbia-de-la-calle (solo web), el-pescador, guiro-114,
ingrid-solo-plena, inspiracion, mira-el-sol, perreo-y-to, pescador-gaitas,
pescador-guia, pescador-guiro, pescador-punteador, pescador-requinto,
pescador-seguidor, pescador-voz, rap-plena, rio-noite, rueda-de-tambor,
te-equivocas, trombone-mambo

## Convenciones del proyecto

- A las pistas se les llama **ritmos** (no "pistas").
- Los ritmos muestran solo el **BPM**, sin tonalidad.
- La web y el prototipo deben mantenerse con el mismo diseño.
