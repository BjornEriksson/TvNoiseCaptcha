# TvNoiseCaptcha — Widescreen CRT Static Noise CAPTCHA (v0.5.1-beta)

**Author:** [@BjornEriksson](https://github.com)  
**Version:** `0.5.1-beta`  
**License:** MIT

**`TvNoiseCaptcha`** is a zero-dependency HTML5 Canvas CAPTCHA inspired by an untuned analog widescreen CRT television. Instead of distorted static images, characters emerge organically from animated TV snow—using **only illuminated white pixels** on a shared logical pixel grid.

---

## Live Preview

https://github.com

---

## How It Works (Human-Friendly, Bot-Resistant)

* **Shared Logical Pixel Grid (`160 × 90` 16:9 Widescreen):** Both the static snow and the character masks share the exact same coarse pixel resolution (`3×` scaled to `480 × 270 px` by default).
* **Lit-Pixel Color Modulation Only:** Dark CRT background pixels never change color. Only active white noise pixels inside a fading character adopt soft pastel tones, while feathered 2-pass blurred edges let background snow bleed smoothly through.
* **Asynchronous Staggered Fades:** Characters fade in and out independently (up to `maxVisibleChars` at once) in non-linear order, shifting X/Y position, font family, and pastel color on every fade cycle—defeating single-frame OCR and multi-frame pixel averaging.
* **Classic CRT Power-Off Reset:** When the challenge timer expires (`timeoutMs`), the screen collapses vertically into a bright horizontal beam, goes dark gray, and powers back on with a freshly randomized code.

---

## Quick Start

1. Include `tv-captcha-config.js` and `tv-noise-captcha.js` in your HTML `<head>`:
   ```html
   <script src="tv-captcha-config.js" defer></script>
   <script src="tv-noise-captcha.js" defer></script>
   ```
2. Add a `<canvas>` element and initialize `TvNoiseCaptcha`:
   ```html
   <canvas id="tv-captcha-canvas"></canvas>
   <input type="text" id="captcha-input" placeholder="TYPE CODE...">
   <button type="button" id="btn-verify">Verify</button>

   <script>
     window.addEventListener('DOMContentLoaded', () => {
       const captcha = new TvNoiseCaptcha('#tv-captcha-canvas');

       document.getElementById('btn-verify').onclick = () => {
         const code = document.getElementById('captcha-input').value;
         alert(captcha.verify(code) ? 'Human confirmed!' : 'Try again.');
       };
     });
   </script>
   ```

---

## Developer Configuration (`tv-captcha-config.js`)

All visual and timing parameters live in `TV_CAPTCHA_CONFIG` (or can be passed directly into `new TvNoiseCaptcha(canvas, options)`):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `gridWidth` / `gridHeight` | `160` / `90` | Logical 16:9 widescreen pixel resolution |
| `pixelScale` | `3` | Canvas pixel multiplier (`480 × 270 px` output) |
| `codeLength` | `5` | Number of characters in the verification code |
| `maxVisibleChars` | `3` | Maximum characters fading concurrently |
| `fadeDurationMinMs` / `MaxMs` | `2200` / `3100` | Single-character fade-in + fade-out duration range |
| `fontSize` / `fontSizeJitter` | `34` / `3` | Base character size and per-fade `±px` variation |
| `fontFamilies` | `['monospace', ...]` | Pool of fonts randomized per character fade |
| `textColor` / `textPalette` | `'random'` | Soft pastel colors applied strictly to lit pixels |
| `timeoutMs` | `22000` | Round timeout before CRT collapse & reset |

---

## Project Structure

```text
tv-noise-captcha/
├── index.html              # Widescreen CRT television demo page
├── tv-captcha-config.js    # Developer configuration variables
├── tv-noise-captcha.js     # Standalone zero-dependency CAPTCHA engine
├── README.md               # Documentation and integration guide
└── LICENSE                 # MIT License
```

---

## License

This project is licensed under the [MIT License](LICENSE).
