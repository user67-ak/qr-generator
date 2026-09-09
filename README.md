# QR Code Generator

A single-page web app that turns a link into a QR code. No backend, no build
step, no data leaves the browser.

## Run it

https://user67-ak.github.io/qr-generator/

(The one thing that needs internet is the QR library, loaded from a CDN.)

## Files

| File | What it does |
|---|---|
| `index.html` | The structure — input, logo picker, download buttons, preview box |
| `style.css`  | The look. All colors/sizes live in the `:root` block at the top |
| `app.js`     | The logic — reads the input, redraws the QR, handles downloads |

## How it actually works

1. **You type a link.** `input` fires on every keystroke, so `app.js` waits
   250ms after you stop typing before redrawing (a *debounce*).
2. **The text gets normalized.** `example.com` becomes `https://example.com`,
   because a QR pointing at a bare domain often opens a search instead of the site.
3. **The library encodes it.** `qr-code-styling` turns the string into a grid of
   black/white modules and draws it on a `<canvas>`.
4. **Download** re-renders that same code as a PNG or as an SVG and hands it to
   the browser as a file.

### Why the logo doesn't break the code

QR codes carry redundant data so they still scan when partly damaged. The
*error correction level* sets how much:


A center logo **covers** part of the code, which is the same as damage. So
`app.js` switches to `H` the moment you add a logo, and keeps the logo at 35%
of the width. Push the logo much bigger than that and scanners start failing.

### PNG vs SVG

- **PNG** — pixels. Fine for screens, gets blurry if scaled up a lot.
- **SVG** — math. Scales to any size with no quality loss. Use this for print,
  posters, stickers.

## Things to try next

- Custom foreground/background colors (`dotsOptions.color`, `backgroundOptions.color`)
- Rounded dots (`dotsOptions.type: "rounded"` / `"dots"` / `"classy"`)
- Encode other things: WiFi, plain text, phone numbers — they're just specially
  formatted strings, e.g. `WIFI:T:WPA;S:MyNetwork;P:mypassword;;`
