/**
 * Jigra Storage Manager
 * Centralized data schema, initial state, and persistent chrome.storage.local helpers.
 */

(function (root) {
  const DEFAULT_STATE = {
    // Timer State Machine
    timer: {
      state: 'IDLE', // 'IDLE' | 'FOCUS' | 'BREAK' | 'PAUSED'
      mode: 'standard', // 'standard' (25/5) | 'focus' (45/10) | 'ultra' (50/10)
      remainingSeconds: 25 * 60,
      duration: 25 * 60,
      targetTimestamp: null, // Epoch ms when alarm will ring
      sessionCount: 0, // Blocks completed today
      activeTabDomain: null
    },

    // Economy & Stats
    economy: {
      sparks: 50, // Starting currency bonus for new learners
      totalMinutesFocused: 0,
      streakDays: 1,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      history: [] // [{ date: 'YYYY-MM-DD', minutes: 25, mode: 'standard', sparks: 10 }]
    },

    // Companion State
    companion: {
      name: 'Ignis',
      level: 1,
      exp: 0,
      expToNext: 100,
      skin: 'ember', // 'ember' | 'frost' | 'dragon' | 'void'
      hat: 'none', // 'none' | 'glasses' | 'wizard' | 'crown' | 'headphones'
      aura: 'none', // 'none' | 'sparkle' | 'matrix' | 'zen'
      evolutionStage: 1 // 1: Hatchling, 2: Apprentice, 3: Guardian, 4: Celestial
    },

    // Unlocked Cosmetics Inventory
    inventory: ['skin_ember', 'hat_none', 'aura_none'],

    // User Settings
    settings: {
      soundEnabled: true,
      gentleShield: true,
      ultraShield: true,
      companionVisible: true,
      position: { bottom: 24, right: 24 },
      gameInterval: {
        mode: 'every_sprint', // 'every_sprint' | 'every_2_sprints' | 'every_4_sprints' | 'time_30m' | 'time_60m' | 'anytime'
        sprintsSinceLastGame: 0,
        minutesSinceLastGame: 0,
        lastPlayedTimestamp: 0
      }
    }
  };

  const GAME_INTERVAL_MODES = {
    every_sprint: { label: 'After Every Sprint', requiredSprints: 1, desc: 'Play after every completed sprint.' },
    every_2_sprints: { label: 'Every 2 Sprints', requiredSprints: 2, desc: 'Unlock after 2 focus sprints.' },
    every_4_sprints: { label: 'Every 4 Sprints', requiredSprints: 4, desc: 'Full cycle (e.g. 100m of focus).' },
    time_30m: { label: 'Every 30 Mins', requiredMinutes: 30, desc: 'Unlock after 30 mins of focus.' },
    time_60m: { label: 'Every 60 Mins', requiredMinutes: 60, desc: 'Unlock after 60 mins of focus.' },
    anytime: { label: 'Anytime (Free Play)', requiredSprints: 0, desc: 'Practice games anytime without waiting.' }
  };

  const TIMER_MODES = {
    standard: { focusMinutes: 25, breakMinutes: 5, rewardSparks: 10, exp: 50, name: 'Standard (25/5)' },
    focus: { focusMinutes: 45, breakMinutes: 10, rewardSparks: 20, exp: 100, name: 'Deep Focus (45/10)' },
    ultra: { focusMinutes: 50, breakMinutes: 10, rewardSparks: 25, exp: 150, name: 'Ultra Focus (50/10)' },
    debug: { focusMinutes: 0.16, breakMinutes: 0.16, rewardSparks: 5, exp: 20, name: 'Debug Sprint (10s)' } // Helper for rapid testing
  };

  const BAZAAR_ITEMS = [
    // Hats & Accessories
    { id: 'hat_glasses', type: 'hat', name: 'Study Specs', price: 30, desc: 'Sharp reading glasses for laser focus.', icon: '👓' },
    { id: 'hat_wizard', type: 'hat', name: 'Arcane Wizard Hat', price: 60, desc: 'Harness the ancient magic of deep work.', icon: '🧙' },
    { id: 'hat_crown', type: 'hat', name: 'Gold Monarch Crown', price: 100, desc: 'For royalty of productivity and discipline.', icon: '👑' },
    { id: 'hat_headphones', type: 'hat', name: 'Cyber Headphones', price: 75, desc: 'Blocks out all digital noise.', icon: '🎧' },

    // Companion Skins
    { id: 'skin_ember', type: 'skin', name: 'Ignis Ember', price: 0, desc: 'Warm living flame of motivation.', icon: '🔥' },
    { id: 'skin_frost', type: 'skin', name: 'Cryo Frost', price: 80, desc: 'Calm and collected ice elemental.', icon: '❄️' },
    { id: 'skin_dragon', type: 'skin', name: 'Jade Drake', price: 150, desc: 'Ancient guardian of knowledge.', icon: '🐲' },
    { id: 'skin_void', type: 'skin', name: 'Astral Void', price: 200, desc: 'Mystical cosmic spirit of eternity.', icon: '🌌' },

    // Auras
    { id: 'aura_sparkle', type: 'aura', name: 'Cosmic Stardust', price: 40, desc: 'Glittering sparks orbiting your companion.', icon: '✨' },
    { id: 'aura_matrix', type: 'aura', name: 'Cyber Matrix', price: 90, desc: 'Flowing neon code fragments.', icon: '🟩' },
    { id: 'aura_zen', type: 'aura', name: 'Zen Bloom', price: 110, desc: 'Floating cherry blossoms and petals.', icon: '🌸' }
  ];

  const EVOLUTION_STAGES = [
    { stage: 1, minLevel: 1, title: 'Flame Sprout', desc: 'Curious and eager to study.' },
    { stage: 2, minLevel: 5, title: 'Adept Scholar', desc: 'Can focus for hours without wavering.' },
    { stage: 3, minLevel: 10, title: 'Guardian Phoenix', desc: 'Shields you from the temptations of doom-scrolling.' },
    { stage: 4, minLevel: 20, title: 'Celestial Sage', desc: 'Transcended into pure mastery.' }
  ];

  const JigraStorage = {
    DEFAULT_STATE,
    GAME_INTERVAL_MODES,
    TIMER_MODES,
    BAZAAR_ITEMS,
    EVOLUTION_STAGES,

    async get() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) {
          return resolve(JSON.parse(JSON.stringify(DEFAULT_STATE)));
        }
        chrome.storage.local.get(null, (result) => {
          if (!result || Object.keys(result).length === 0) {
            const fresh = JSON.parse(JSON.stringify(DEFAULT_STATE));
            chrome.storage.local.set(fresh);
            return resolve(fresh);
          }
          // Merge with defaults to ensure all keys exist
          const merged = {
            timer: { ...DEFAULT_STATE.timer, ...(result.timer || {}) },
            economy: { ...DEFAULT_STATE.economy, ...(result.economy || {}) },
            companion: { ...DEFAULT_STATE.companion, ...(result.companion || {}) },
            inventory: result.inventory || DEFAULT_STATE.inventory,
            settings: {
              ...DEFAULT_STATE.settings,
              ...(result.settings || {}),
              gameInterval: {
                ...DEFAULT_STATE.settings.gameInterval,
                ...(result.settings?.gameInterval || {})
              }
            }
          };
          resolve(merged);
        });
      });
    },

    async set(updates) {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) return resolve();
        chrome.storage.local.set(updates, () => resolve());
      });
    },

    async updateTimer(timerUpdates) {
      const data = await this.get();
      const updatedTimer = { ...data.timer, ...timerUpdates };
      await this.set({ timer: updatedTimer });
      return updatedTimer;
    },

    async addSparks(amount) {
      const data = await this.get();
      const newSparks = Math.max(0, (data.economy.sparks || 0) + amount);
      const economy = { ...data.economy, sparks: newSparks };
      await this.set({ economy });
      return newSparks;
    },

    async addExp(amount) {
      const data = await this.get();
      let { level, exp, expToNext } = data.companion;
      exp += amount;
      let leveledUp = false;

      while (exp >= expToNext) {
        exp -= expToNext;
        level += 1;
        expToNext = Math.round(expToNext * 1.35);
        leveledUp = true;
      }

      // Determine evolution stage
      let evolutionStage = 1;
      for (const ev of EVOLUTION_STAGES) {
        if (level >= ev.minLevel) evolutionStage = ev.stage;
      }

      const companion = { ...data.companion, level, exp, expToNext, evolutionStage };
      await this.set({ companion });
      return { companion, leveledUp };
    },

    async recordSession(minutes, mode, sparksEarned) {
      const data = await this.get();
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = data.economy.lastActiveDate;

      let streakDays = data.economy.streakDays || 1;
      if (lastDate !== today) {
        const last = new Date(lastDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streakDays += 1;
        } else if (diffDays > 1) {
          streakDays = 1; // Streak reset
        }
      }

      const history = [...(data.economy.history || [])];
      history.push({
        timestamp: Date.now(),
        date: today,
        minutes,
        mode,
        sparks: sparksEarned
      });
      if (history.length > 50) history.shift(); // Keep recent 50

      const economy = {
        ...data.economy,
        sparks: (data.economy.sparks || 0) + sparksEarned,
        totalMinutesFocused: (data.economy.totalMinutesFocused || 0) + minutes,
        streakDays,
        lastActiveDate: today,
        history
      };

      const timer = {
        ...data.timer,
        sessionCount: (data.timer.sessionCount || 0) + 1
      };

      const settings = {
        ...data.settings,
        gameInterval: {
          ...data.settings.gameInterval,
          sprintsSinceLastGame: (data.settings.gameInterval?.sprintsSinceLastGame || 0) + 1,
          minutesSinceLastGame: (data.settings.gameInterval?.minutesSinceLastGame || 0) + minutes
        }
      };

      await this.set({ economy, timer, settings });
      return { economy, streakDays, settings };
    },

    checkGameAccess(store) {
      const settings = store?.settings || DEFAULT_STATE.settings;
      const gameInterval = settings.gameInterval || DEFAULT_STATE.settings.gameInterval;
      const mode = gameInterval.mode || 'every_sprint';
      const timer = store?.timer || DEFAULT_STATE.timer;

      // In BREAK phase, games are always active (micro-break)
      if (timer.state === 'BREAK') {
        return {
          allowed: true,
          mode,
          progressText: 'Micro-Break Ready! 🚀',
          reason: 'Focus sprint completed! Micro-break is active.'
        };
      }

      if (mode === 'anytime') {
        return {
          allowed: true,
          mode,
          progressText: 'Free Play (Anytime)',
          reason: 'Free Play is enabled in settings.'
        };
      }

      const sprints = gameInterval.sprintsSinceLastGame || 0;
      const minutes = gameInterval.minutesSinceLastGame || 0;

      if (mode === 'every_sprint') {
        if (sprints >= 1) {
          return { allowed: true, mode, progressText: 'Ready to Play! (1/1 Sprint)', reason: '1 sprint completed!' };
        }
        return {
          allowed: false,
          mode,
          progressText: 'Locked (0/1 Sprint)',
          reason: 'Complete 1 focus sprint to unlock games.',
          remaining: 1 - sprints,
          type: 'sprint'
        };
      }

      if (mode === 'every_2_sprints') {
        if (sprints >= 2) {
          return { allowed: true, mode, progressText: 'Ready to Play! (2/2 Sprints)', reason: '2 sprints completed!' };
        }
        return {
          allowed: false,
          mode,
          progressText: `Locked (${sprints}/2 Sprints)`,
          reason: `Complete ${2 - sprints} more sprint(s) to unlock games.`,
          remaining: 2 - sprints,
          type: 'sprint'
        };
      }

      if (mode === 'every_4_sprints') {
        if (sprints >= 4) {
          return { allowed: true, mode, progressText: 'Ready to Play! (4/4 Sprints)', reason: '4 sprints completed!' };
        }
        return {
          allowed: false,
          mode,
          progressText: `Locked (${sprints}/4 Sprints)`,
          reason: `Complete ${4 - sprints} more sprint(s) to unlock games.`,
          remaining: 4 - sprints,
          type: 'sprint'
        };
      }

      if (mode === 'time_30m') {
        if (minutes >= 30) {
          return { allowed: true, mode, progressText: 'Ready to Play! (30m+ Focus)', reason: '30m focus achieved!' };
        }
        return {
          allowed: false,
          mode,
          progressText: `Locked (${minutes}/30m)`,
          reason: `Focus for ${30 - minutes} more minute(s) to unlock games.`,
          remaining: 30 - minutes,
          type: 'minute'
        };
      }

      if (mode === 'time_60m') {
        if (minutes >= 60) {
          return { allowed: true, mode, progressText: 'Ready to Play! (60m+ Focus)', reason: '60m focus achieved!' };
        }
        return {
          allowed: false,
          mode,
          progressText: `Locked (${minutes}/60m)`,
          reason: `Focus for ${60 - minutes} more minute(s) to unlock games.`,
          remaining: 60 - minutes,
          type: 'minute'
        };
      }

      return { allowed: true, mode, progressText: 'Ready to Play', reason: '' };
    },

    async recordGamePlayed() {
      const data = await this.get();
      const settings = {
        ...data.settings,
        gameInterval: {
          ...data.settings.gameInterval,
          sprintsSinceLastGame: 0,
          minutesSinceLastGame: 0,
          lastPlayedTimestamp: Date.now()
        }
      };
      await this.set({ settings });
      return settings.gameInterval;
    },

    async updateGameIntervalMode(newMode) {
      const data = await this.get();
      const settings = {
        ...data.settings,
        gameInterval: {
          ...data.settings.gameInterval,
          mode: newMode
        }
      };
      await this.set({ settings });
      return settings.gameInterval;
    },

    onChanged(callback) {
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local') {
            callback(changes);
          }
        });
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JigraStorage;
  } else {
    root.JigraStorage = JigraStorage;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
