/**
 * TvNoiseCaptcha - Widescreen CRT Static Noise CAPTCHA
 * Zero-dependency HTML5 Canvas CAPTCHA where characters fade in and out
 * independently with feathered/blurred alpha cores so white noise bleeds
 * softly through character edges while only the center reaches full color.
 *
 * @file tv-noise-captcha.js
 * @author BjornEriksson (https://github.com)
 * @version 0.5.1-beta
 * @license MIT
 */
class TvNoiseCaptcha {
  constructor(canvas, options = {}) {
    this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    if (!this.canvas) throw new Error('TvNoiseCaptcha: Canvas element not found');
    this.ctx = this.canvas.getContext('2d');

    const base = (typeof TV_CAPTCHA_CONFIG !== 'undefined') ? TV_CAPTCHA_CONFIG : {};
    this.config = {
      gridWidth: 160,
      gridHeight: 90,
      pixelScale: 3,
      codeLength: 5,
      maxVisibleChars: 3,
      fadeDurationMinMs: 1150,
      fadeDurationMaxMs: 1750,
      charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      timeoutMs: 16000,
      fontSize: 34,
      fontSizeJitter: 3,
      fontFamilies: ['monospace', 'sans-serif', 'serif', 'Courier New', 'Arial Black'],
      fontWeight: 'bold',
      screenBgColor: '#1c1d21',
      noiseDarkColor: '#25272d',
      noiseLightColor: '#cfd3da',
      textColor: 'random',
      textPalette: ['#86efac', '#7dd3fc', '#fcd34d', '#f9a8d4', '#c4b5fd', '#5eead4'],
      beamColor: '#f8fafc',
      baseNoiseDensity: 0.42,
      letterBoostDensity: 0.52,
      targetFps: 24,
      onReset: null,
      onTimeout: null,
      ...base,
      ...options
    };

    // Offscreen mask canvas matching the exact logical pixel grid
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    this.code = '';
    this.charData = [];
    this.nextSpawnAllowedAt = 0; // Enforces staggered, non-paired character launches
    this.state = 'running';      // 'running' | 'collapsing' | 'off'
    this.stateStartTime = performance.now();
    this.roundStartTime = performance.now();
    this.lastFrameTime = 0;
    this.rafId = null;

    this.applyDimensions();
    this.reset();
    this.startLoop();
  }

  parseHexRgb(hex) {
    const clean = String(hex || '#cfd3da').replace('#', '');
    const full = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.padEnd(6, '0');
    const num = parseInt(full, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  lerpRgb(c1, c2, t) {
    const k = Math.max(0, Math.min(1, t));
    const r = Math.round(c1.r + (c2.r - c1.r) * k);
    const g = Math.round(c1.g + (c2.g - c1.g) * k);
    const b = Math.round(c1.b + (c2.b - c1.b) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }

  updateConfig(newOptions = {}) {
    Object.assign(this.config, newOptions);
    this.applyDimensions();
    this.buildCharacterData();
  }

  applyDimensions() {
    const { gridWidth, gridHeight, pixelScale } = this.config;
    this.canvas.width = gridWidth * pixelScale;
    this.canvas.height = gridHeight * pixelScale;
    this.canvas.style.imageRendering = 'pixelated';

    this.maskCanvas.width = gridWidth;
    this.maskCanvas.height = gridHeight;
  }

  generateCode() {
    const { codeLength, charset } = this.config;
    let out = '';
    for (let i = 0; i < codeLength; i++) {
      out += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return out;
  }

  pickCharColorHex() {
    const { textColor, textPalette } = this.config;
    if (!textColor || textColor === 'random') {
      const list = Array.isArray(textPalette) && textPalette.length > 0
        ? textPalette
        : ['#86efac'];

      // Filter out the previously picked color so two consecutive letters never match
      const candidates = list.length > 1
        ? list.filter((c) => c !== this.lastPickedColor)
        : list;

      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      this.lastPickedColor = chosen;
      return chosen;
    }
    return textColor;
  }

  pickCharFont() {
    const { fontFamilies, fontFamily } = this.config;
    if (Array.isArray(fontFamilies) && fontFamilies.length > 0) {
      return fontFamilies[Math.floor(Math.random() * fontFamilies.length)];
    }
    return fontFamily || 'monospace';
  }

  randomFadeDuration() {
    const min = Math.max(500, this.config.fadeDurationMinMs || 1150);
    const max = Math.max(min, this.config.fadeDurationMaxMs || 1750);
    return min + Math.random() * (max - min);
  }

  /**
   * Apply a 2-pass 3x3 feathered blur to the character alpha mask so only the
   * inner core reaches 1.0 opacity while outer edges taper smoothly into noise.
   */
  featherAlphaMask(rawAlpha, w, h) {
    let src = rawAlpha;
    let dst = new Float32Array(w * h);

    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0;
          let weightSum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= w) continue;
              const weight = (dx === 0 && dy === 0) ? 4 : (dx === 0 || dy === 0 ? 2 : 1);
              sum += src[ny * w + nx] * weight;
              weightSum += weight;
            }
          }
          dst[y * w + x] = sum / weightSum;
        }
      }
      const tmp = src;
      src = dst;
      dst = tmp;
    }

    // Keep only the true inner center at 1.0 while outer 2-3px edges stay soft and feathered
    for (let i = 0; i < src.length; i++) {
      const v = Math.min(1, src[i] * 1.18);
      src[i] = v > 0.04 ? v : 0;
    }
    return src;
  }

  /**
   * Rasterize each character with feathered edge transparency [0..1]
   * and independent asynchronous cooldowns.
   */
  /**
   * Rasterize a single character at index `i` with subtle random X/Y position
   * jitter and randomized font so each fade appears in a slightly shifted spot.
   */
  rasterizeSingleCharacter(i) {
    const { gridWidth, gridHeight, fontSize, fontSizeJitter, fontWeight } = this.config;
    const len = this.code.length;

    const marginX = Math.round(gridWidth * 0.11);
    const usableW = gridWidth - marginX * 2;
    const stepX = usableW / Math.max(1, len);
    const baseY = Math.round(gridHeight * 0.52);

    const jitterSize = fontSizeJitter > 0
      ? Math.round((Math.random() * 2 - 1) * fontSizeJitter)
      : 0;
    const charSize = Math.max(12, fontSize + jitterSize);
    const charFont = this.pickCharFont();

    // Subtle random X and Y position shift on every fade (keeps letters inside their slot)
    const jitterX = Math.round((Math.random() * 2 - 1) * 3);
    const jitterY = Math.round((Math.random() * 2 - 1) * 4);
    const cx = Math.round(marginX + stepX * (i + 0.5) + jitterX);
    const cy = baseY + jitterY;

    this.maskCtx.clearRect(0, 0, gridWidth, gridHeight);
    this.maskCtx.fillStyle = '#ffffff';
    this.maskCtx.font = `${fontWeight} ${charSize}px "${charFont}", monospace`;
    this.maskCtx.textAlign = 'center';
    this.maskCtx.textBaseline = 'middle';
    this.maskCtx.fillText(this.code[i], cx, cy);

    const imgData = this.maskCtx.getImageData(0, 0, gridWidth, gridHeight).data;
    const rawAlpha = new Float32Array(gridWidth * gridHeight);
    for (let p = 0; p < rawAlpha.length; p++) {
      rawAlpha[p] = imgData[p * 4 + 3] / 255;
    }

    return this.featherAlphaMask(rawAlpha, gridWidth, gridHeight);
  }
   
  buildCharacterData() {
    const { gridWidth, gridHeight, fontSize, fontSizeJitter, fontWeight } = this.config;
    const len = this.code.length;
    const now = performance.now();
    this.charData = [];
    this.nextSpawnAllowedAt = now + 100;

    const marginX = Math.round(gridWidth * 0.11);
    const usableW = gridWidth - marginX * 2;
    const stepX = usableW / Math.max(1, len);
    const baseY = Math.round(gridHeight * 0.52);

    // Shuffle initial cooldown offsets so characters never start in left-to-right order
    const shuffledSlots = Array.from({ length: len }, (_, idx) => idx);
    for (let i = len - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledSlots[i], shuffledSlots[j]] = [shuffledSlots[j], shuffledSlots[i]];
    }

    for (let i = 0; i < len; i++) {
      const jitter = fontSizeJitter > 0
        ? Math.round((Math.random() * 2 - 1) * fontSizeJitter)
        : 0;
      const charSize = Math.max(12, fontSize + jitter);
      const charFont = this.pickCharFont();
      const offsetY = baseY + Math.round((Math.random() * 2 - 1) * 3);

      this.maskCtx.clearRect(0, 0, gridWidth, gridHeight);
      this.maskCtx.fillStyle = '#ffffff';
      this.maskCtx.font = `${fontWeight} ${charSize}px "${charFont}", monospace`;
      this.maskCtx.textAlign = 'center';
      this.maskCtx.textBaseline = 'middle';

      const cx = Math.round(marginX + stepX * (i + 0.5));
      this.maskCtx.fillText(this.code[i], cx, offsetY);

      const imgData = this.maskCtx.getImageData(0, 0, gridWidth, gridHeight).data;
      const rawAlpha = new Float32Array(gridWidth * gridHeight);
      for (let p = 0; p < rawAlpha.length; p++) {
        rawAlpha[p] = imgData[p * 4 + 3] / 255;
      }

      this.charData.push({
        alphaMask: this.featherAlphaMask(rawAlpha, gridWidth, gridHeight),
        rgb: this.parseHexRgb(this.pickCharColorHex()),
        active: false,
        startTime: 0,
        durationMs: this.randomFadeDuration(),
        cooldownUntil: now + shuffledSlots[i] * 420 + Math.random() * 260
      });
    }
  }

  reset() {
    this.code = this.generateCode();
    this.buildCharacterData();
    this.state = 'running';
    const now = performance.now();
    this.stateStartTime = now;
    this.roundStartTime = now;
    if (typeof this.config.onReset === 'function') this.config.onReset(this.code);
  }

  verify(userInput) {
    if (this.state !== 'running') return false;
    const clean = String(userInput || '').trim().toUpperCase();
    return clean.length > 0 && clean === this.code.toUpperCase();
  }

  getRemainingSeconds() {
    if (this.state !== 'running') return 0;
    const elapsed = performance.now() - this.roundStartTime;
    return Math.max(0, (this.config.timeoutMs - elapsed) / 1000);
  }

  /**
   * Asynchronous staggered fade scheduler:
   * Launches at most ONE new character fade at a time (separated by a random
   * interval) so characters never appear in synchronized pairs.
   */
  getCharacterVisibility(now) {
    const count = this.charData.length;
    const vis = new Float32Array(count);
    const maxVis = Math.max(1, Math.min(count, this.config.maxVisibleChars));

    let activeCount = 0;
    const readyCandidates = [];

    for (let i = 0; i < count; i++) {
      const ch = this.charData[i];
      if (ch.active) {
        const progress = (now - ch.startTime) / ch.durationMs;
        if (progress >= 1) {
          ch.active = false;
          ch.cooldownUntil = now + 380 + Math.random() * 950;
          vis[i] = 0;
        } else {
          activeCount++;
          let env = 0;
          if (progress < 0.42) {
            const t = progress / 0.42;
            env = t * t * (3 - 2 * t);
          } else if (progress <= 0.58) {
            env = 1;
          } else {
            const t = (1 - progress) / 0.42;
            env = t * t * (3 - 2 * t);
          }
          vis[i] = env;
        }
      } else if (now >= ch.cooldownUntil) {
        readyCandidates.push(i);
      }
    }

    // Trigger at most ONE character per spawn window so fades stay truly individual
    if (activeCount < maxVis && readyCandidates.length > 0 && now >= this.nextSpawnAllowedAt) {
      const pickIdx = Math.floor(Math.random() * readyCandidates.length);
      const charIdx = readyCandidates[pickIdx];
      const ch = this.charData[charIdx];

      ch.alphaMask = this.rasterizeSingleCharacter(charIdx); // Shift position & font slightly on every fade
      ch.rgb = this.parseHexRgb(this.pickCharColorHex());    // Pick a fresh non-repeating color
      ch.active = true;
      ch.startTime = now;
      ch.durationMs = this.randomFadeDuration();
      this.nextSpawnAllowedAt = now + 380 + Math.random() * 340;
    }

    return vis;
  }

  renderNoiseFrame(now) {
    const {
      gridWidth, gridHeight, pixelScale,
      screenBgColor, noiseDarkColor, noiseLightColor,
      baseNoiseDensity, letterBoostDensity
    } = this.config;

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    // Base dark-gray CRT screen background
    ctx.fillStyle = screenBgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const baseLightRgb = this.parseHexRgb(noiseLightColor);
    const charVis = this.getCharacterVisibility(now);
    const numChars = this.charData.length;

    for (let y = 0; y < gridHeight; y++) {
      const rowOffset = y * gridWidth;
      for (let x = 0; x < gridWidth; x++) {
        const idx = rowOffset + x;

        // Combine asynchronous fade envelope with feathered edge alpha [0..1]
        let glyphStrength = 0;
        let activeRgb = baseLightRgb;
        for (let c = 0; c < numChars; c++) {
          if (charVis[c] > 0.01) {
            const edgeAlpha = this.charData[c].alphaMask[idx];
            if (edgeAlpha > 0) {
              const combined = charVis[c] * edgeAlpha;
              if (combined > glyphStrength) {
                glyphStrength = combined;
                activeRgb = this.charData[c].rgb;
              }
            }
          }
        }

        // Lit white pixel probability rises smoothly inside fading character cores
        const litProbability = Math.min(0.97, baseNoiseDensity + glyphStrength * letterBoostDensity);
        const isLitPixel = Math.random() < litProbability;

        if (!isLitPixel) {
          // Dark gray CRT pixels stay dark gray (never colored as text)
          if (Math.random() < 0.45) {
            ctx.fillStyle = noiseDarkColor;
            ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale);
          }
          continue;
        }

        // ONLY lit pixels adopt the soft pastel character color; feathered edges let white noise bleed through
        if (glyphStrength > 0.04) {
          ctx.fillStyle = this.lerpRgb(baseLightRgb, activeRgb, glyphStrength);
        } else {
          ctx.fillStyle = noiseLightColor;
        }
        ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale);
      }
    }
  }

  /**
   * Classic CRT television shut-off sequence:
   * 1. Collapses vertically into a bright horizontal beam in the center (~220 ms)
   * 2. Fades to dark gray CRT screen (~380 ms)
   * 3. Powers back on with a new randomized code
   */
  renderPowerOffSequence(now) {
    const { pixelScale, screenBgColor, beamColor } = this.config;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    if (this.state === 'collapsing') {
      const elapsed = now - this.stateStartTime;
      const duration = 220;
      const t = Math.min(1, elapsed / duration);

      ctx.fillStyle = screenBgColor;
      ctx.fillRect(0, 0, w, h);

      // Vertical squeeze down to a 1-logical-pixel horizontal beam, then shrink width
      const beamH = Math.max(pixelScale, Math.round(h * (1 - t) * (1 - t)));
      const shrinkX = t > 0.55 ? (t - 0.55) / 0.45 : 0;
      const beamW = Math.max(pixelScale * 4, Math.round(w * (1 - shrinkX * 0.92)));

      const bx = Math.round((w - beamW) / 2);
      const by = Math.round((h - beamH) / 2);

      ctx.fillStyle = beamColor;
      ctx.fillRect(bx, by, beamW, beamH);

      if (t >= 1) {
        this.state = 'off';
        this.stateStartTime = now;
      }
      return;
    }

    if (this.state === 'off') {
      ctx.fillStyle = screenBgColor;
      ctx.fillRect(0, 0, w, h);

      // Brief dark-gray pause before powering back on with new characters
      if (now - this.stateStartTime >= 380) {
        this.reset();
      }
    }
  }

  startLoop() {
    const frameInterval = 1000 / Math.max(1, this.config.targetFps || 24);
    const step = (now) => {
      if (now - this.lastFrameTime >= frameInterval) {
        this.lastFrameTime = now;

        if (this.state === 'running') {
          if (now - this.roundStartTime >= this.config.timeoutMs) {
            this.state = 'collapsing';
            this.stateStartTime = now;
            if (typeof this.config.onTimeout === 'function') this.config.onTimeout();
            this.renderPowerOffSequence(now);
          } else {
            this.renderNoiseFrame(now);
          }
        } else {
          this.renderPowerOffSequence(now);
        }
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
