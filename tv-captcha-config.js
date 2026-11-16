/**
 * TvNoiseCaptcha - Developer Configuration Variables
 * Edit the variables below to customize screen size, character fonts, sizes,
 * soft pastel lit-pixel colors, asynchronous fade speed, and timeout duration.
 *
 * @file tv-captcha-config.js
 * @author BjornEriksson (https://github.com)
 * @version 0.5.1-beta
 * @license MIT
 */
const TV_CAPTCHA_CONFIG = {
  // Logical 16:9 widescreen pixel grid & scale
  gridWidth: 160,
  gridHeight: 90,
  pixelScale: 3,                 // 160x90 @ 3x = 480x270 px widescreen TV

  // Challenge & asynchronous visibility rules
  codeLength: 5,                 // Number of characters to solve
  maxVisibleChars: 2,            // Max simultaneously visible characters (asynchronous)
  fadeDurationMinMs: 200,       // Slower, gentle fade-in + fade-out cycle (ms)
  fadeDurationMaxMs: 1400,       // Longest single-character fade cycle (ms)
  charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  timeoutMs: 22000,              // Max time (ms) before CRT shuts off & tunes new channel

  // Typography (each character picks randomly from fontFamilies when array is provided)
  fontSize: 34,                  // Base character height in logical grid pixels
  fontSizeJitter: 8,             // Subtle +/- pixel size variation per character (0 = uniform)
  fontFamilies: ['monospace', 'sans-serif', 'serif', 'Courier New', 'Arial Black'],
  fontWeight: 'bold',

  // TV screen & pixel colors (ONLY lit white pixels adopt soft pastel character colors)
  screenBgColor: '#1c1d21',      // Dark gray CRT glass color when unlit/off
  noiseDarkColor: '#25272d',     // Subtle dark noise grain
  noiseLightColor: '#cfd3da',    // Neutral TV static snow
  textColor: 'random',           // 'random' for soft pastel colors, or fixed hex e.g. '#86efac'
  textPalette: [                 // Soft, pleasant light colors (no harsh neon or pure white)
    '#86efac', // Soft Mint Green
    '#7dd3fc', // Soft Sky Blue
    '#fcd34d', // Warm Soft Amber
    '#f9a8d4', // Soft Pastel Rose
    '#c4b5fd', // Soft Lavender
    '#5eead4', // Soft Aqua Teal
    '#fb923c', // Warm Soft Coral
    '#bef264', // Soft Chartreuse Lime
    '#93c5fd', // Soft Periwinkle Blue
    '#fda4af', // Soft Blushing Salmon
    '#e879f9'  // Soft Orchid Magenta
  ],
  beamColor: '#f8fafc',          // Horizontal CRT collapse line color

  // Static snow density & frame rate
  baseNoiseDensity: 0.42,        // Ratio of lit white pixels in empty static (0.0 - 1.0)
  letterBoostDensity: 0.52,      // Extra lit-pixel density inside active letters
  targetFps: 24                  // Analog TV static refresh rate
};
