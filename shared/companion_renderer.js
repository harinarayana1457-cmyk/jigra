/**
 * Jigra Companion Renderer
 * Generates dynamic SVG vector graphics and CSS animations for the companion character,
 * equipped with interchangeable skins, hats, auras, and emotive state animations.
 */

(function (root) {
  const SKINS = {
    ember: {
      primary: '#ff5722',
      secondary: '#ff9800',
      core: '#ffeb3b',
      glow: 'rgba(255, 87, 34, 0.45)',
      name: 'Ignis Ember'
    },
    frost: {
      primary: '#00b4d8',
      secondary: '#48cae4',
      core: '#caf0f8',
      glow: 'rgba(0, 180, 216, 0.45)',
      name: 'Cryo Frost'
    },
    dragon: {
      primary: '#10b981',
      secondary: '#34d399',
      core: '#a7f3d0',
      glow: 'rgba(16, 185, 129, 0.45)',
      name: 'Jade Drake'
    },
    void: {
      primary: '#8b5cf6',
      secondary: '#c084fc',
      core: '#fae8ff',
      glow: 'rgba(139, 92, 246, 0.45)',
      name: 'Astral Void'
    }
  };

  const JigraRenderer = {
    SKINS,

    renderSVG(companion = {}, state = 'idle', size = 80) {
      const skinKey = companion.skin || 'ember';
      const skin = SKINS[skinKey] || SKINS.ember;
      const hat = companion.hat || 'none';
      const aura = companion.aura || 'none';
      const level = companion.level || 1;

      // Unique SVG ID prefix to avoid collisions
      const idPrefix = 'jigra-' + Math.random().toString(36).substring(2, 7);

      // Eye variations based on state
      let eyeMarkup = '';
      if (state === 'focusing') {
        // Concentrated happy eyes / focused look
        eyeMarkup = `
          <!-- Focused squint/happy arcs -->
          <path d="M 38 48 Q 44 44 48 48" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M 60 48 Q 64 44 70 48" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/>
        `;
      } else if (state === 'distracted') {
        // Shocked / alert wide eyes with exclamation
        eyeMarkup = `
          <circle cx="43" cy="48" r="5" fill="#1f2937" />
          <circle cx="65" cy="48" r="5" fill="#1f2937" />
          <circle cx="41" cy="46" r="1.5" fill="#ffffff" />
          <circle cx="63" cy="46" r="1.5" fill="#ffffff" />
          <!-- Alert sweat drop -->
          <path d="M 77 38 C 77 34, 82 30, 82 34 C 82 37, 77 37, 77 38 Z" fill="#60a5fa" class="jigra-anim-sweat" />
        `;
      } else if (state === 'celebrating') {
        // Starry joyful eyes
        eyeMarkup = `
          <polygon points="43,42 45,47 50,47 46,50 48,55 43,52 38,55 40,50 36,47 41,47" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
          <polygon points="65,42 67,47 72,47 68,50 70,55 65,52 60,55 62,50 58,47 63,47" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
          <path d="M 50 58 Q 54 63 58 58" stroke="#1f2937" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        `;
      } else if (state === 'paused') {
        // Expectant waiting puppy eyes (curiously tilted, waiting for user to return)
        eyeMarkup = `
          <ellipse cx="43" cy="47" rx="4.2" ry="5.8" fill="#1f2937" />
          <ellipse cx="65" cy="47" rx="4.2" ry="5.8" fill="#1f2937" />
          <circle cx="45" cy="44" r="2" fill="#ffffff" />
          <circle cx="67" cy="44" r="2" fill="#ffffff" />
          <circle cx="41" cy="49" r="1" fill="#ffffff" />
          <circle cx="63" cy="49" r="1" fill="#ffffff" />
          <!-- Expectant, curious smile -->
          <path d="M 50 56 Q 54 59 58 56" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        `;
      } else {
        // Default idle cute blinking eyes
        eyeMarkup = `
          <ellipse cx="43" cy="48" rx="3.5" ry="5.5" fill="#1f2937" class="jigra-anim-blink" />
          <ellipse cx="65" cy="48" rx="3.5" ry="5.5" fill="#1f2937" class="jigra-anim-blink" />
          <circle cx="42" cy="46" r="1.5" fill="#ffffff" />
          <circle cx="64" cy="46" r="1.5" fill="#ffffff" />
          <circle cx="44" cy="50" r="0.8" fill="#ffffff" />
          <circle cx="66" cy="50" r="0.8" fill="#ffffff" />
          <!-- Cute smile -->
          <path d="M 51 55 Q 54 58 57 55" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
        `;
      }

      // Hat accessories
      let hatMarkup = '';
      if (hat === 'glasses') {
        hatMarkup = `
          <!-- Study Specs -->
          <g class="jigra-hat-glasses">
            <circle cx="43" cy="48" r="7" stroke="#1e293b" stroke-width="2.2" fill="rgba(255,255,255,0.2)"/>
            <circle cx="65" cy="48" r="7" stroke="#1e293b" stroke-width="2.2" fill="rgba(255,255,255,0.2)"/>
            <line x1="50" y1="48" x2="58" y2="48" stroke="#1e293b" stroke-width="2"/>
            <line x1="36" y1="47" x2="28" y2="44" stroke="#1e293b" stroke-width="1.8"/>
            <line x1="72" y1="47" x2="80" y2="44" stroke="#1e293b" stroke-width="1.8"/>
          </g>
        `;
      } else if (hat === 'wizard') {
        hatMarkup = `
          <!-- Arcane Wizard Hat -->
          <g class="jigra-hat-wizard" transform="translate(0, -6)">
            <ellipse cx="54" cy="28" rx="26" ry="6" fill="#4c1d95" stroke="#2e1065" stroke-width="1.5"/>
            <polygon points="32,28 54,2 76,28" fill="#6d28d9" stroke="#4c1d95" stroke-width="1.5"/>
            <polygon points="50,14 54,6 58,14 52,10 56,10" fill="#fbbf24"/>
            <rect x="36" y="24" width="36" height="4" fill="#fbbf24" rx="2"/>
          </g>
        `;
      } else if (hat === 'crown') {
        hatMarkup = `
          <!-- Gold Monarch Crown -->
          <g class="jigra-hat-crown" transform="translate(0, -4)">
            <polygon points="36,26 36,14 45,20 54,10 63,20 72,14 72,26" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>
            <circle cx="54" cy="10" r="2.5" fill="#ef4444"/>
            <circle cx="36" cy="14" r="2" fill="#3b82f6"/>
            <circle cx="72" cy="14" r="2" fill="#10b981"/>
            <rect x="36" y="23" width="36" height="4" fill="#fbbf24"/>
          </g>
        `;
      } else if (hat === 'headphones') {
        hatMarkup = `
          <!-- Cyber Headphones -->
          <g class="jigra-hat-headphones">
            <path d="M 28 48 C 28 20, 80 20, 80 48" stroke="#0f172a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
            <rect x="23" y="40" width="7" height="16" rx="3" fill="#06b6d4" stroke="#0891b2" stroke-width="1.5"/>
            <rect x="78" y="40" width="7" height="16" rx="3" fill="#06b6d4" stroke="#0891b2" stroke-width="1.5"/>
          </g>
        `;
      }

      // Prop for study mode (little open book or quill)
      let propMarkup = '';
      if (state === 'focusing') {
        propMarkup = `
          <!-- Mini Study Book -->
          <g class="jigra-anim-book" transform="translate(38, 62)">
            <rect x="0" y="2" width="14" height="10" rx="1.5" fill="#f8fafc" stroke="#64748b" stroke-width="1"/>
            <rect x="15" y="2" width="14" height="10" rx="1.5" fill="#f8fafc" stroke="#64748b" stroke-width="1"/>
            <line x1="3" y1="5" x2="11" y2="5" stroke="#94a3b8" stroke-width="1"/>
            <line x1="3" y1="8" x2="11" y2="8" stroke="#94a3b8" stroke-width="1"/>
            <line x1="18" y1="5" x2="26" y2="5" stroke="#94a3b8" stroke-width="1"/>
            <line x1="18" y1="8" x2="26" y2="8" stroke="#94a3b8" stroke-width="1"/>
          </g>
        `;
      }

      // Aura FX
      let auraMarkup = '';
      if (aura === 'sparkle') {
        auraMarkup = `
          <g class="jigra-anim-aura-sparkle">
            <circle cx="20" cy="30" r="2" fill="#fde047" opacity="0.8" />
            <circle cx="88" cy="24" r="2.5" fill="#fde047" opacity="0.9" />
            <circle cx="82" cy="70" r="1.8" fill="#fde047" opacity="0.7" />
            <circle cx="24" cy="65" r="2" fill="#fde047" opacity="0.8" />
          </g>
        `;
      } else if (aura === 'matrix') {
        auraMarkup = `
          <g class="jigra-anim-aura-matrix" font-family="monospace" font-size="6" fill="#22c55e" opacity="0.85">
            <text x="16" y="28">01</text>
            <text x="84" y="32">10</text>
            <text x="20" y="66">0</text>
            <text x="82" y="68">1</text>
          </g>
        `;
      } else if (aura === 'zen') {
        auraMarkup = `
          <g class="jigra-anim-aura-zen">
            <path d="M 22 28 Q 26 24 30 28 Q 26 32 22 28" fill="#f472b6" opacity="0.8" />
            <path d="M 84 34 Q 88 30 92 34 Q 88 38 84 34" fill="#f472b6" opacity="0.8" />
            <path d="M 80 66 Q 84 62 88 66 Q 84 70 80 66" fill="#f472b6" opacity="0.7" />
          </g>
        `;
      }

      // Distraction exclamation bubble or Paused waiting indicator
      let alertBubble = '';
      if (state === 'distracted') {
        alertBubble = `
          <g class="jigra-anim-alert-bubble" transform="translate(68, 6)">
            <ellipse cx="14" cy="14" rx="12" ry="10" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
            <polygon points="10,22 14,28 16,22" fill="#ef4444"/>
            <text x="14" y="18" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="12" fill="#ffffff">!</text>
          </g>
        `;
      } else if (state === 'paused') {
        alertBubble = `
          <g class="jigra-anim-pause-bubble" transform="translate(68, 8)">
            <circle cx="12" cy="12" r="11" fill="#f59e0b" stroke="#d97706" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
            <rect x="8.5" y="7" width="2.5" height="10" rx="1.2" fill="#ffffff"/>
            <rect x="13" y="7" width="2.5" height="10" rx="1.2" fill="#ffffff"/>
          </g>
        `;
      }

      // Dragon horns extra for dragon skin
      let skinDecorations = '';
      if (skinKey === 'dragon') {
        skinDecorations = `
          <!-- Dragon horns & little wings -->
          <polygon points="34,30 24,18 36,22" fill="#047857"/>
          <polygon points="74,30 84,18 72,22" fill="#047857"/>
          <!-- Little tail -->
          <path d="M 72 68 Q 86 70 84 60" stroke="#047857" stroke-width="4" fill="none" stroke-linecap="round"/>
        `;
      }

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="${size}" height="${size}" class="jigra-companion-svg jigra-state-${state}">
          <defs>
            <radialGradient id="${idPrefix}-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${skin.glow}" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="${idPrefix}-body" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${skin.secondary}" />
              <stop offset="100%" stop-color="${skin.primary}" />
            </linearGradient>
            <linearGradient id="${idPrefix}-core" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${skin.core}" />
              <stop offset="100%" stop-color="${skin.secondary}" />
            </linearGradient>
          </defs>

          <!-- Outer ambient aura glow -->
          <circle cx="54" cy="54" r="46" fill="url(#${idPrefix}-glow)" class="jigra-anim-pulse" />
          
          ${auraMarkup}

          <!-- Companion Main Body (Cute Flame / Creature Shape) -->
          <g class="jigra-anim-body-group">
            ${skinDecorations}

            <!-- Outer flame coat -->
            <path d="
              M 54 18 
              C 68 34, 82 46, 82 64 
              C 82 78, 70 86, 54 86 
              C 38 86, 26 78, 26 64 
              C 26 46, 40 34, 54 18 Z" 
              fill="url(#${idPrefix}-body)" 
              stroke="${skin.primary}" 
              stroke-width="2" 
              filter="drop-shadow(0px 3px 5px rgba(0,0,0,0.25))"
            />

            <!-- Inner glowing heart core -->
            <path d="
              M 54 34 
              C 62 46, 72 56, 72 68 
              C 72 78, 64 82, 54 82 
              C 44 82, 36 78, 36 68 
              C 36 56, 46 46, 54 34 Z" 
              fill="url(#${idPrefix}-core)" 
            />

            <!-- Cheeks blush -->
            <ellipse cx="36" cy="54" rx="3.5" ry="2" fill="rgba(255, 100, 100, 0.4)" />
            <ellipse cx="72" cy="54" rx="3.5" ry="2" fill="rgba(255, 100, 100, 0.4)" />

            <!-- Dynamic Eyes & Expression -->
            ${eyeMarkup}

            <!-- Equiped Hat -->
            ${hatMarkup}

            <!-- Study Prop (Book) -->
            ${propMarkup}
          </g>

          <!-- Alert / Emote Bubble -->
          ${alertBubble}
        </svg>
      `;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JigraRenderer;
  } else {
    root.JigraRenderer = JigraRenderer;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
