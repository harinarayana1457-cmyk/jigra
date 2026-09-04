/**
 * Jigra Companion Renderer
 * Generates dynamic SVG graphics and animations for the golden deity companion character,
 * equipped with interchangeable elemental skins, equippable hats, auras, and emotive state animations.
 */

(function (root) {
  function getCompanionImgSrc() {
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime && chrome.runtime.id && chrome.runtime.getURL) {
        return chrome.runtime.getURL('dashboard/assets/companion.png');
      }
    } catch (e) {}
    if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('/dashboard/')) {
      return 'assets/companion.png';
    }
    return 'dashboard/assets/companion.png';
  }

  const SKINS = {
    ember: {
      primary: '#d97706',
      secondary: '#f59e0b',
      core: '#fef08a',
      glow: 'rgba(245, 158, 11, 0.45)',
      name: 'Golden Sage',
      cssFilter: 'none'
    },
    frost: {
      primary: '#00b4d8',
      secondary: '#48cae4',
      core: '#caf0f8',
      glow: 'rgba(0, 180, 216, 0.45)',
      name: 'Cryo Frost',
      cssFilter: 'hue-rotate(160deg) saturate(1.2) brightness(1.05)'
    },
    dragon: {
      primary: '#10b981',
      secondary: '#34d399',
      core: '#a7f3d0',
      glow: 'rgba(16, 185, 129, 0.45)',
      name: 'Jade Drake',
      cssFilter: 'hue-rotate(85deg) saturate(1.3) brightness(1.02)'
    },
    void: {
      primary: '#8b5cf6',
      secondary: '#c084fc',
      core: '#fae8ff',
      glow: 'rgba(139, 92, 246, 0.45)',
      name: 'Astral Void',
      cssFilter: 'hue-rotate(240deg) saturate(1.35) brightness(1.08)'
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
      const imgSrc = getCompanionImgSrc();

      // Unique SVG ID prefix to avoid collisions across multiple instances
      const idPrefix = 'jigra-' + Math.random().toString(36).substring(2, 7);

      // Hat accessories tailored to the statue landmark coordinates
      let hatMarkup = '';
      if (hat === 'glasses') {
        hatMarkup = `
          <!-- Study Specs on Serene Eyes -->
          <g class="jigra-hat-glasses">
            <circle cx="49.5" cy="38.8" r="5" stroke="#0f172a" stroke-width="1.8" fill="rgba(255,255,255,0.3)"/>
            <circle cx="58.5" cy="38.8" r="5" stroke="#0f172a" stroke-width="1.8" fill="rgba(255,255,255,0.3)"/>
            <line x1="53.5" y1="38.8" x2="54.5" y2="38.8" stroke="#0f172a" stroke-width="1.8"/>
            <line x1="44.5" y1="38.5" x2="38" y2="36" stroke="#0f172a" stroke-width="1.4"/>
            <line x1="63.5" y1="38.5" x2="70" y2="36" stroke="#0f172a" stroke-width="1.4"/>
            <!-- Glass glare highlight -->
            <path d="M 47 36.5 L 51 36.5" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
            <path d="M 56 36.5 L 60 36.5" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
          </g>
        `;
      } else if (hat === 'wizard') {
        hatMarkup = `
          <!-- Arcane Wizard Hat resting atop the Crown -->
          <g class="jigra-hat-wizard" transform="translate(0, -5)">
            <ellipse cx="54" cy="22" rx="22" ry="5.5" fill="#4c1d95" stroke="#2e1065" stroke-width="1.3"/>
            <polygon points="36,22 54,0 72,22" fill="#6d28d9" stroke="#4c1d95" stroke-width="1.3"/>
            <polygon points="51,8 54,2 57,8 52,5 56,5" fill="#fbbf24"/>
            <rect x="38" y="19" width="32" height="3" fill="#fbbf24" rx="1.5"/>
          </g>
        `;
      } else if (hat === 'crown') {
        hatMarkup = `
          <!-- Gold Monarch Sovereign Crown -->
          <g class="jigra-hat-crown" transform="translate(0, -4)">
            <polygon points="38,24 38,14 46,19 54,10 62,19 70,14 70,24" fill="#f59e0b" stroke="#b45309" stroke-width="1.3"/>
            <circle cx="54" cy="10" r="2.2" fill="#ef4444"/>
            <circle cx="38" cy="14" r="1.6" fill="#3b82f6"/>
            <circle cx="70" cy="14" r="1.6" fill="#10b981"/>
            <rect x="38" y="21" width="32" height="3" fill="#fbbf24"/>
          </g>
        `;
      } else if (hat === 'headphones') {
        hatMarkup = `
          <!-- Cyber Noise-Cancelling Headphones -->
          <g class="jigra-hat-headphones">
            <path d="M 36 40 C 36 12, 72 12, 72 40" stroke="#0f172a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <rect x="31" y="33" width="6.5" height="15" rx="3" fill="#06b6d4" stroke="#0891b2" stroke-width="1.2"/>
            <rect x="70.5" y="33" width="6.5" height="15" rx="3" fill="#06b6d4" stroke="#0891b2" stroke-width="1.2"/>
          </g>
        `;
      }

      // Focusing Sacred Prop & Urna
      let focusingMarkup = '';
      if (state === 'focusing') {
        focusingMarkup = `
          <!-- Enlightened Forehead Third-Eye Urna Gem -->
          <circle cx="54" cy="35.5" r="1.8" fill="#fef08a" stroke="#d97706" stroke-width="0.8" filter="drop-shadow(0 0 4px #fbbf24)"/>
          
          <!-- Mini Floating Wisdom Book / Scroll beside open palm -->
          <g class="jigra-anim-book" transform="translate(36, 68)">
            <rect x="0" y="2" width="16" height="12" rx="2" fill="#fffbeb" stroke="#d97706" stroke-width="1.2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))" />
            <rect x="18" y="2" width="16" height="12" rx="2" fill="#fffbeb" stroke="#d97706" stroke-width="1.2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))" />
            <line x1="3" y1="5" x2="13" y2="5" stroke="#b45309" stroke-width="1" />
            <line x1="3" y1="9" x2="13" y2="9" stroke="#b45309" stroke-width="1" />
            <line x1="21" y1="5" x2="31" y2="5" stroke="#b45309" stroke-width="1" />
            <line x1="21" y1="9" x2="31" y2="9" stroke="#b45309" stroke-width="1" />
            <circle cx="17" cy="8" r="2" fill="#f59e0b" />
          </g>
        `;
      }

      // Aura FX
      let auraMarkup = '';
      if (aura === 'sparkle') {
        auraMarkup = `
          <g class="jigra-anim-aura-sparkle">
            <circle cx="18" cy="28" r="2" fill="#fde047" opacity="0.85" />
            <circle cx="90" cy="22" r="2.5" fill="#fde047" opacity="0.9" />
            <circle cx="84" cy="72" r="2" fill="#fde047" opacity="0.8" />
            <circle cx="22" cy="68" r="2" fill="#fde047" opacity="0.85" />
          </g>
        `;
      } else if (aura === 'matrix') {
        auraMarkup = `
          <g class="jigra-anim-aura-matrix" font-family="monospace" font-size="6.5" fill="#22c55e" opacity="0.9">
            <text x="14" y="28">01</text>
            <text x="86" y="32">10</text>
            <text x="16" y="68">0</text>
            <text x="84" y="70">1</text>
          </g>
        `;
      } else if (aura === 'zen') {
        auraMarkup = `
          <g class="jigra-anim-aura-zen">
            <path d="M 20 26 Q 25 22 30 26 Q 25 30 20 26" fill="#f472b6" opacity="0.85" />
            <path d="M 86 32 Q 91 28 96 32 Q 91 36 86 32" fill="#f472b6" opacity="0.85" />
            <path d="M 82 68 Q 87 64 92 68 Q 87 72 82 68" fill="#f472b6" opacity="0.8" />
          </g>
        `;
      }

      // Emote Alert / Pause / Celebration Badges
      let alertBubble = '';
      if (state === 'distracted') {
        alertBubble = `
          <g class="jigra-anim-alert-bubble" transform="translate(72, 6)">
            <ellipse cx="14" cy="14" rx="12" ry="10" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
            <polygon points="10,22 14,28 16,22" fill="#ef4444"/>
            <text x="14" y="18" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="12" fill="#ffffff">!</text>
          </g>
        `;
      } else if (state === 'paused') {
        alertBubble = `
          <g class="jigra-anim-pause-bubble" transform="translate(72, 8)">
            <circle cx="12" cy="12" r="11" fill="#f59e0b" stroke="#d97706" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.35))"/>
            <rect x="8.5" y="7" width="2.5" height="10" rx="1.2" fill="#ffffff"/>
            <rect x="13" y="7" width="2.5" height="10" rx="1.2" fill="#ffffff"/>
          </g>
        `;
      } else if (state === 'celebrating') {
        alertBubble = `
          <g class="jigra-anim-celebrate-burst">
            <circle cx="54" cy="50" r="44" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 6" fill="none" opacity="0.8" class="jigra-anim-halo-spin"/>
            <polygon points="28,24 30,28 34,28 31,30 32,34 28,32 24,34 25,30 22,28 26,28" fill="#fbbf24"/>
            <polygon points="80,24 82,28 86,28 83,30 84,34 80,32 76,34 77,30 74,28 78,28" fill="#fbbf24"/>
            <polygon points="54,4 56,8 60,8 57,10 58,14 54,12 50,14 51,10 48,8 52,8" fill="#fbbf24"/>
          </g>
        `;
      }

      // Focus halo ring
      let haloRingMarkup = '';
      if (state === 'focusing') {
        haloRingMarkup = `
          <!-- Sacred Enlightened Halo Ring -->
          <circle cx="54" cy="38" r="28" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3 2" fill="none" opacity="0.85" class="jigra-anim-halo-spin" />
          <circle cx="54" cy="38" r="23" fill="rgba(245, 158, 11, 0.12)" stroke="rgba(251, 191, 36, 0.45)" stroke-width="1" />
        `;
      }

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="${size}" height="${size}" class="jigra-companion-svg jigra-state-${state}">
          <defs>
            <style>
              @keyframes jigraHaloSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .jigra-anim-halo-spin {
                transform-origin: 54px 38px;
                animation: jigraHaloSpin 14s infinite linear;
              }
              @keyframes jigraGlowPulse {
                0%, 100% { opacity: 0.6; transform: scale(0.96); }
                50% { opacity: 1; transform: scale(1.04); }
              }
              .jigra-anim-pulse {
                transform-origin: 54px 46px;
                animation: jigraGlowPulse 2.8s infinite ease-in-out;
              }
            </style>

            <radialGradient id="${idPrefix}-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${skin.glow}" />
              <stop offset="60%" stop-color="${skin.secondary}" stop-opacity="0.3" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>

          <!-- Outer ambient aura glow -->
          <circle cx="54" cy="46" r="44" fill="url(#${idPrefix}-glow)" class="jigra-anim-pulse" />

          ${haloRingMarkup}
          ${auraMarkup}

          <!-- Companion Main Body (Ancient Gilded Golden Deity Statue) -->
          <g class="jigra-anim-body-group" style="filter: ${skin.cssFilter};">
            <image 
              href="${imgSrc}" 
              x="21" 
              y="9" 
              width="66" 
              height="95.8" 
              preserveAspectRatio="xMidYMid meet" 
              filter="drop-shadow(0 4px 10px rgba(0,0,0,0.38))"
            />

            <!-- Focusing Sacred Third-Eye and Wisdom Prop -->
            ${focusingMarkup}

            <!-- Equiped Hat Accessory -->
            ${hatMarkup}
          </g>

          <!-- Alert / Pause / Celebration Emote Bubble -->
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
