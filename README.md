# Jigra ⚡ — Focus Companion & YouTube Study Shield

**Jigra** is an end-to-end browser productivity extension built with **Chrome Extension Manifest V3**, Vanilla JavaScript, procedural Web Audio, and modern CSS glassmorphism.

Designed specifically for students, researchers, and developers, Jigra prevents digital doom-scrolling (especially YouTube Shorts & recommendations), provides a gamified desktop companion that lives on screen, and rewards completed study blocks with quick 60-second micro-break games, currency (**Sparks**), and companion skins & evolutions.

---

## 🌟 Key Features

### 1. Context-Aware YouTube Study Shield
- **Smart UI Stripper:** Automatically removes the YouTube recommendation sidebar (`#secondary`), comments feed (`#comments`), homepage infinite scroll wall, end-screen video cards, and Shorts carousels when a focus session is active.
- **Shorts Interceptor:** Detects and halts YouTube Shorts navigation (`/shorts/*`) instantly on YouTube's SPA (Single Page Application) without reloading the page.
- **Deterrent Override:** In *Ultra Focus Mode*, leaving a study sprint early requires holding an emergency override button for 5 full seconds.
- **Distraction-Free Playback:** Centers the primary video player and search bar so you can watch tutorials, lectures, and documentaries without visual rabbit holes.

### 2. Interactive Floating Screen Companion
- **Encapsulated Widget:** Injected using a closed Shadow DOM so website styles never interfere with the companion.
- **Physics & Snapping:** Draggable with mouse or touch, and smoothly docks/snaps to screen edges.
- **State-Driven Emotes & Animations:**
  - **Focusing State:** Gentle breathing, reading study notes, focused sparkling eyes, mini countdown pill.
  - **Distraction State:** Taps against the glass (`AudioContext` knock sound), shakes the avatar, and displays warning speech bubbles if you visit distracting domains or idle.
  - **Milestone Celebration:** Victory dance, procedural 8-bit fanfare, and confetti bursts (`canvas-confetti`) when a Pomodoro block ends.
- **Mini HUD:** Click the companion anytime to check your streak, level, remaining sprint time, and jump directly to the Bazaar.

### 3. Micro-Break Brain Resets (60-Second Mini-Games)
- When a focus session finishes, the extension prompts a dopamine-reset micro-break:
  - **6-Pair Memory Matrix:** 12 cards with 3D flip physics, matching pairs of learning icons under a 60-second timer.
  - **Speed Quote Typer:** Cyber terminal typing sprint testing WPM and accuracy on curated stoic and productivity quotes.
- **Strict 60-Second Enforcement:** When the clock hits 0:00, the game freezes, awards **+5 bonus Sparks**, and transitions the student to the next sprint.

### 4. Economy, Evolution & Customization Bazaar
- **Sparks Wallet:** Earn +10 Sparks per standard sprint (+20 for deep, +25 for ultra) and +5 per mini-game.
- **Cosmetics Bazaar:** Purchase and instantly equip:
  - **Hats & Glasses:** Study Specs, Arcane Wizard Hat, Gold Monarch Crown, Cyber Headphones.
  - **Companion Skins:** Ignis Ember 🔥, Cryo Frost ❄️, Jade Drake 🐲, Astral Void 🌌.
  - **Magical Auras:** Cosmic Stardust ✨, Cyber Matrix 🟩, Zen Bloom 🌸.
- **Evolution Tree:** As your study hours accumulate, your companion evolves across 4 stages:
  1. *Flame Sprout* (Lv. 1)
  2. *Adept Scholar* (Lv. 5)
  3. *Guardian Phoenix* (Lv. 10)
  4. *Celestial Sage* (Lv. 20)

---

## 📁 Project Architecture

```
hyperbloom/
├── manifest.json                     # Chrome Extension Manifest V3 configuration
├── icons/                            # Extension icons (16, 32, 48, 128 px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   └── service_worker.js             # MV3 background worker, chrome.alarms, notifications, economy
├── content_scripts/
│   ├── youtube_shield.css            # YouTube DOM suppression styles
│   ├── youtube_shield.js             # YouTube SPA navigation hook & Shorts interceptor
│   ├── companion_overlay.css         # Shadow DOM floating companion styles & animations
│   ├── companion_overlay.js          # Draggable companion controller with reactive states
│   └── confetti.js                   # Zero-dependency canvas confetti engine
├── popup/
│   ├── popup.html                    # Quick popup window
│   ├── popup.css                     # Circular timer & neon UI styling
│   └── popup.js                      # Popup controller & real-time sync
├── dashboard/
│   ├── dashboard.html                # Full-page application: Hub, Bazaar, Evolution, Arcade
│   ├── dashboard.css                 # Glassmorphic cyber theme
│   ├── dashboard.js                  # Dashboard state manager
│   └── games/
│       ├── memory_match.js           # 6-Pair Memory Matrix game
│       └── speed_typer.js            # 60s Speed Quote Typer game
├── shared/
│   ├── storage.js                    # chrome.storage.local schema, helpers & default state
│   ├── audio.js                      # Web Audio API procedural sound synthesizer
│   └── companion_renderer.js         # SVG vector companion generator with cosmetics & emotes
└── README.md
```

---

## 🚀 How to Load and Test in Chrome / Brave / Edge

1. Open your Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Arc, etc.).
2. Navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`
3. Toggle on **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"**.
5. Select this project folder:
   ```
   c:\Users\Avvari\OneDrive\Desktop\hyperbloom
   ```
6. Jigra will appear in your extension toolbar! Pin it for quick access.

---

## 🧪 Testing Checklist

1. **Popup & Timer Start:**
   - Click the Jigra extension icon in your toolbar.
   - Switch between **Standard (25m)**, **Deep Focus (45m)**, and **Ultra (50m)**.
   - Click **Start Focus** — notice the circular timer countdown and the companion updating to its focusing state.
2. **YouTube Shield:**
   - Go to `https://www.youtube.com/`.
   - Notice home recommendations are replaced with the gentle Jigra Focus placeholder.
   - Open any tutorial video: recommendations (`#secondary`) and comments (`#comments`) are stripped.
   - Try navigating to `https://www.youtube.com/shorts/`: the interceptor immediately blocks the video and displays the "Focus Shield Triggered" modal.
3. **Screen Companion:**
   - Open any website (e.g. Wikipedia, GitHub, MDN).
   - See the floating flame companion in the bottom right corner.
   - Drag it anywhere on your screen and release; it smoothly docks to the edge.
   - Click it to toggle the mini HUD and check your Sparks wallet.
4. **Micro-Break Mini-Games:**
   - Click **Open Bazaar & Games** or skip to break.
   - Play the **6-Pair Memory Matrix** or **Speed Quote Typer**.
   - Notice the 60-second timer countdown, live stats, victory sound, and +5 bonus Sparks awarded to your wallet upon completion.
5. **Cosmetics Bazaar:**
   - Navigate to the **Cosmetics Bazaar** tab.
   - Spend your initial 50 Sparks bonus on **Study Specs** or save up for the **Arcane Wizard Hat** or **Cryo Frost** skin.
   - Click **Equip** and observe the companion update in the showcase and on your active tabs immediately!
