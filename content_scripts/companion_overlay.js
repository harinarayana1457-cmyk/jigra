/**
 * Jigra Floating Screen Companion Content Script
 * Injected into active browser tabs. Features Shadow DOM encapsulation,
 * smooth physics dragging, dockable edges, reactive state animations,
 * in-browser game launcher, and customizable interval controls.
 */

(function () {
  // Prevent duplicate injection
  if (document.getElementById('jigra-companion-host')) return;

  let shadowRoot = null;
  let companionData = { skin: 'ember', hat: 'none', aura: 'none', level: 1, exp: 0, expToNext: 100 };
  let economyData = { sparks: 50, streakDays: 1, totalMinutesFocused: 0 };
  let timerData = { state: 'IDLE', mode: 'standard', remainingSeconds: 1500, targetTimestamp: null };
  let settingsData = {
    soundEnabled: true,
    gameInterval: { mode: 'every_sprint', sprintsSinceLastGame: 0, minutesSinceLastGame: 0 }
  };
  let currentState = 'idle'; // 'idle' | 'focusing' | 'distracted' | 'celebrating' | 'paused'
  let speechTimeout = null;
  let activeInPageGame = null;
  let currentInPageGameType = 'memory';
  let pauseMonitoringActive = false;
  let pauseSecondsElapsed = 0;
  let pauseReminderIndex = 0;
  let initialPauseTimeout = null;
  let tickIntervalId = null;

  function cleanupOrphanedScript() {
    if (tickIntervalId) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
    if (initialPauseTimeout) {
      clearTimeout(initialPauseTimeout);
      initialPauseTimeout = null;
    }
    if (speechTimeout) {
      clearTimeout(speechTimeout);
      speechTimeout = null;
    }
    pauseMonitoringActive = false;
  }

  function isContextValid() {
    try {
      if (typeof chrome === 'undefined' || !chrome?.runtime || !chrome.runtime.id) {
        cleanupOrphanedScript();
        return false;
      }
      return true;
    } catch (e) {
      cleanupOrphanedScript();
      return false;
    }
  }

  // Intercept and cleanly handle context invalidation errors in orphaned scripts
  window.addEventListener('error', (event) => {
    const msg = event?.message || event?.error?.message || '';
    if (typeof msg === 'string' && msg.includes('Extension context invalidated')) {
      cleanupOrphanedScript();
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (typeof msg === 'string' && msg.includes('Extension context invalidated')) {
      cleanupOrphanedScript();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  async function safeSendMessage(message) {
    if (!isContextValid()) return null;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      if (err?.message?.includes('Extension context invalidated')) {
        cleanupOrphanedScript();
      }
      return null;
    }
  }

  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let currentPosX = window.innerWidth - 110;
  let currentPosY = window.innerHeight - 130;
  let hasMoved = false;

  async function initCompanion() {
    if (!isContextValid()) return;
    // Wait for dependencies if necessary
    if (typeof JigraStorage === 'undefined' || typeof JigraRenderer === 'undefined') {
      setTimeout(initCompanion, 80);
      return;
    }

    const host = document.createElement('div');
    host.id = 'jigra-companion-host';
    (document.body || document.documentElement).appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    // Load styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    try {
      styleLink.href = chrome.runtime.getURL('content_scripts/companion_overlay.css');
    } catch (e) {
      return;
    }
    shadowRoot.appendChild(styleLink);

    // Initial data fetch
    try {
      const store = await JigraStorage.get();
      if (!isContextValid()) return;
      companionData = store.companion;
      economyData = store.economy;
      timerData = store.timer;
      settingsData = store.settings || settingsData;
    } catch (e) {
      return;
    }

    updateCurrentStateFromTimer();
    renderCompanionUI();
    setupDragEvents();
    setupListeners();

    // Start 1s countdown tick
    tickIntervalId = setInterval(tickTimer, 1000);
  }

  function updateCurrentStateFromTimer() {
    if (timerData.state === 'FOCUS') {
      currentState = 'focusing';
    } else if (timerData.state === 'BREAK') {
      currentState = 'celebrating';
    } else if (timerData.state === 'PAUSED') {
      currentState = 'paused';
    } else {
      currentState = 'idle';
    }

    if (timerData.state === 'PAUSED') {
      startPauseMonitoring();
    } else {
      stopPauseMonitoring();
    }
  }

  function startPauseMonitoring() {
    if (pauseMonitoringActive) return;
    pauseMonitoringActive = true;
    pauseSecondsElapsed = 0;

    if (initialPauseTimeout) clearTimeout(initialPauseTimeout);
    // Give a brief gentle pause before initial reminder so it feels natural
    initialPauseTimeout = setTimeout(() => {
      if (timerData.state === 'PAUSED' && !activeInPageGame) {
        triggerPauseReminder(true);
      }
    }, 1800);
  }

  function stopPauseMonitoring() {
    pauseMonitoringActive = false;
    pauseSecondsElapsed = 0;
    if (initialPauseTimeout) {
      clearTimeout(initialPauseTimeout);
      initialPauseTimeout = null;
    }
  }

  function triggerPauseReminder(isInitial = false) {
    if (timerData.state !== 'PAUSED') return;

    // Gentle audio cue
    if (typeof JigraAudio !== 'undefined' && settingsData?.soundEnabled !== false) {
      JigraAudio.playNudge();
    }

    // Avatar attention wiggle
    const avatarEl = shadowRoot?.getElementById('jigra-avatar');
    if (avatarEl) {
      avatarEl.classList.remove('jigra-wobble-nudge');
      void avatarEl.offsetWidth; // Trigger DOM reflow
      avatarEl.classList.add('jigra-wobble-nudge');
      setTimeout(() => avatarEl.classList.remove('jigra-wobble-nudge'), 700);
    }

    const remaining = getRemainingSeconds();
    const formatted = formatTime(remaining);
    const streak = economyData?.streakDays || 1;
    const compName = companionData?.name || 'Jigra';

    const reminders = [
      `⏰ Psst! You have ${formatted} left in this sprint. Let's finish strong!`,
      `👀 Don't get trapped scrolling! Your ${streak}d study streak is waiting for you.`,
      `🔥 ${compName} is ready when you are! Resume now to keep earning Sparks.`,
      `📚 The hardest step is restarting—you've got this! Ready to dive back in?`,
      `⚡ Every focused minute levels up ${compName}! Ready to crush the rest?`
    ];

    const messageText = isInitial
      ? `⏸️ Study session paused! Take a quick breath, but don't lose your focus groove!`
      : reminders[pauseReminderIndex % reminders.length];

    pauseReminderIndex++;

    showSpeechBubble({
      title: '⏸️ Study Paused',
      text: messageText,
      actionText: '▶ Resume Session',
      onAction: async () => {
        if (!isContextValid()) return;
        await safeSendMessage({ type: 'RESUME_TIMER' });
        showSpeechBubble({
          title: '🚀 Back in the Zone!',
          text: `Focus sprint resumed! Crushing the next ${formatted}!`,
          duration: 3500
        });
      },
      duration: 8000
    });
  }

  function getRemainingSeconds() {
    try {
      if (!timerData) return 0;
      if (timerData.targetTimestamp && (timerData.state === 'FOCUS' || timerData.state === 'BREAK')) {
        return Math.max(0, Math.ceil((timerData.targetTimestamp - Date.now()) / 1000));
      }
      return timerData.remainingSeconds || 0;
    } catch (e) {
      return 0;
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function renderCompanionUI() {
    if (!isContextValid()) return;
    let container = shadowRoot.getElementById('jigra-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'jigra-root';
      container.className = `jigra-companion-root state-${currentState}`;
      shadowRoot.appendChild(container);
    } else {
      container.className = `jigra-companion-root state-${currentState}`;
    }

    const remaining = getRemainingSeconds();
    const formattedTime = formatTime(remaining);
    const isBreak = timerData.state === 'BREAK';
    const isPaused = timerData.state === 'PAUSED';
    const svgContent = JigraRenderer.renderSVG(companionData, currentState, 84);

    let pillClass = '';
    if (isBreak) pillClass = 'pill-break';
    else if (isPaused) pillClass = 'pill-paused';

    let pillLabel = formattedTime;
    if (isPaused) pillLabel = `⏸️ ${formattedTime}`;

    // Check game interval access
    const gameAccess = JigraStorage.checkGameAccess({
      settings: settingsData,
      timer: timerData
    });
    const intervalMode = settingsData?.gameInterval?.mode || 'every_sprint';

    container.innerHTML = `
      <!-- Thought / Warning Bubble -->
      <div class="jigra-speech-bubble" id="jigra-bubble"></div>

      <!-- Mini HUD Menu -->
      <div class="jigra-hud-panel" id="jigra-hud">
        <div class="jigra-hud-header">
          <span class="jigra-hud-title">${companionData.name} • Lv. ${companionData.level}</span>
          <button class="jigra-hud-close" id="jigra-hud-close">✕</button>
        </div>
        <div class="jigra-hud-stats">
          <div class="jigra-hud-stat-item">
            <span class="jigra-hud-stat-label">Sparks</span>
            <span class="jigra-hud-stat-val">✨ ${economyData.sparks}</span>
          </div>
          <div class="jigra-hud-stat-item">
            <span class="jigra-hud-stat-label">Streak</span>
            <span class="jigra-hud-stat-val">🔥 ${economyData.streakDays}d</span>
          </div>
        </div>

        <!-- Customizable Game Interval Selector -->
        <div class="jigra-hud-interval-box">
          <div class="jigra-interval-header-row">
            <span class="jigra-interval-label">🎮 Play Games Interval</span>
            <span class="jigra-interval-status-badge ${gameAccess.allowed ? '' : 'badge-locked'}" id="jigra-interval-badge">
              ${gameAccess.progressText}
            </span>
          </div>
          <select class="jigra-interval-select" id="jigra-hud-interval-select" title="Customize when mini-games can be played">
            <option value="every_sprint" ${intervalMode === 'every_sprint' ? 'selected' : ''}>After Every Sprint (Default)</option>
            <option value="every_2_sprints" ${intervalMode === 'every_2_sprints' ? 'selected' : ''}>Every 2 Sprints (50m Focus)</option>
            <option value="every_4_sprints" ${intervalMode === 'every_4_sprints' ? 'selected' : ''}>Every 4 Sprints (Long Block)</option>
            <option value="time_30m" ${intervalMode === 'time_30m' ? 'selected' : ''}>Every 30 Mins Focus</option>
            <option value="time_60m" ${intervalMode === 'time_60m' ? 'selected' : ''}>Every 60 Mins Focus</option>
            <option value="anytime" ${intervalMode === 'anytime' ? 'selected' : ''}>Anytime (Free Play)</option>
          </select>
        </div>

        <!-- Actions Row: Focus, Play Game, Bazaar -->
        <div class="jigra-hud-actions">
          <button class="jigra-hud-btn jigra-btn-primary" id="jigra-hud-timer-btn" title="Toggle study session">
            ${timerData.state === 'FOCUS' ? '⏸ Pause' : timerData.state === 'PAUSED' ? '▶ Resume Focus' : '▶ Focus'}
          </button>
          <button class="jigra-hud-btn jigra-btn-game ${gameAccess.allowed ? '' : 'is-locked'}" id="jigra-hud-game-btn" title="${gameAccess.reason}">
            ${gameAccess.allowed ? '🎮 Play' : '🔒 Play'}
          </button>
          <button class="jigra-hud-btn jigra-btn-secondary" id="jigra-hud-bazaar-btn" title="Open Customization Bazaar">
            🛍️ Bazaar
          </button>
        </div>
      </div>

      <!-- Main Companion Character Wrapper -->
      <div class="jigra-avatar-wrapper" id="jigra-avatar">
        ${svgContent}
      </div>

      <!-- Timer Pill -->
      <div class="jigra-timer-pill ${pillClass}" id="jigra-pill" title="${isPaused ? 'Paused - Click to Resume' : ''}">
        <div class="jigra-status-dot"></div>
        <span id="jigra-pill-time">${pillLabel}</span>
      </div>
    `;

    // Position container
    updatePositionStyles();

    // Bind HUD buttons
    shadowRoot.getElementById('jigra-hud-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHUD(false);
    });

    // Pill click: resume if paused, otherwise toggle HUD
    shadowRoot.getElementById('jigra-pill')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isContextValid()) return;
      if (timerData.state === 'PAUSED') {
        await safeSendMessage({ type: 'RESUME_TIMER' });
        showSpeechBubble({
          title: '🚀 Resumed',
          text: 'Focus session resumed! Keep that momentum going!',
          duration: 3500
        });
      } else {
        toggleHUD();
      }
    });

    shadowRoot.getElementById('jigra-hud-bazaar-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isContextValid()) return;
      safeSendMessage({ type: 'OPEN_DASHBOARD', payload: { tab: 'bazaar' } });
      toggleHUD(false);
    });

    shadowRoot.getElementById('jigra-hud-timer-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isContextValid()) return;
      if (timerData.state === 'FOCUS') {
        await safeSendMessage({ type: 'PAUSE_TIMER' });
      } else if (timerData.state === 'PAUSED') {
        await safeSendMessage({ type: 'RESUME_TIMER' });
      } else {
        await safeSendMessage({ type: 'START_TIMER', payload: { mode: timerData.mode } });
      }
      toggleHUD(false);
    });

    // Play Game Button
    shadowRoot.getElementById('jigra-hud-game-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isContextValid()) return;
      if (!gameAccess.allowed) {
        if (typeof JigraAudio !== 'undefined') JigraAudio.playWarning();
        showSpeechBubble(`🔒 ${gameAccess.reason} (Tip: Select 'Anytime' above for Free Play!)`, 5000);
        return;
      }
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
      toggleHUD(false);

      // If user is playing in the middle of an active session, pause timer so no study minutes are lost
      let wasInActiveSession = false;
      if (timerData.state === 'FOCUS') {
        wasInActiveSession = true;
        await safeSendMessage({ type: 'PAUSE_TIMER' });
      }

      openInPageMiniGame(currentInPageGameType, wasInActiveSession);
    });

    // Interval Selector dropdown change
    shadowRoot.getElementById('jigra-hud-interval-select')?.addEventListener('change', async (e) => {
      e.stopPropagation();
      if (!isContextValid()) return;
      const newMode = e.target.value;
      await JigraStorage.updateGameIntervalMode(newMode);
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
      const updated = await JigraStorage.get();
      if (!isContextValid()) return;
      settingsData = updated.settings;
      renderCompanionUI();
      toggleHUD(true);
      showSpeechBubble(`🎮 Game interval set: ${JigraStorage.GAME_INTERVAL_MODES[newMode]?.label || newMode}`, 3500);
    });
  }

  /* ------------------- IN-PAGE MINI-GAME MODAL ------------------- */
  function openInPageMiniGame(gameType = 'memory', wasInActiveSession = false) {
    closeInPageMiniGame();
    currentInPageGameType = gameType;

    const modal = document.createElement('div');
    modal.id = 'jigra-inpage-game-modal';

    modal.innerHTML = `
      <div class="jigra-inpage-container">
        <div class="jigra-inpage-header">
          <div class="jigra-inpage-title-box">
            <span style="font-size: 20px;">🎮</span>
            <span class="jigra-inpage-title">Micro-Break Brain Reset (60s)</span>
          </div>
          <div class="jigra-inpage-game-switch">
            <button class="jigra-inpage-switch-btn ${gameType === 'memory' ? 'active' : ''}" id="jigra-modal-switch-mem">
              🧠 Memory
            </button>
            <button class="jigra-inpage-switch-btn ${gameType === 'typer' ? 'active' : ''}" id="jigra-modal-switch-typ">
              ⚡ Typer
            </button>
          </div>
          <button class="jigra-inpage-close" id="jigra-modal-close" title="Close">✕</button>
        </div>
        <div id="jigra-inpage-arena"></div>
      </div>
    `;

    shadowRoot.appendChild(modal);

    const arena = modal.querySelector('#jigra-inpage-arena');

    const onGameFinished = async () => {
      if (!isContextValid()) return;
      await JigraStorage.recordGamePlayed();
      if (typeof JigraAudio !== 'undefined') JigraAudio.playVictoryJingle();
      if (typeof JigraConfetti !== 'undefined') {
        JigraConfetti.launch({ count: 120 });
      }

      // Close modal after brief pause and resume or start next focus sprint
      setTimeout(async () => {
        closeInPageMiniGame();
        if (!isContextValid()) return;
        const response = await safeSendMessage({ type: 'RESUME_OR_START_NEXT_SPRINT' });
        if (response?.resumed) {
          const rem = response.remainingSeconds || getRemainingSeconds();
          showSpeechBubble(`⚡ Focus session resumed from ${formatTime(rem)}! Keep going.`, 4500);
        } else {
          showSpeechBubble('🚀 Focus Sprint started! You got this.', 4000);
        }
      }, 1500);
    };

    // Instantiate game
    if (gameType === 'memory') {
      const MemoryMatchClass = window.MemoryMatchGame || (typeof MemoryMatchGame !== 'undefined' ? MemoryMatchGame : null);
      if (MemoryMatchClass) {
        activeInPageGame = new MemoryMatchClass(arena, onGameFinished);
      }
    } else {
      const SpeedTyperClass = window.SpeedTyperGame || (typeof SpeedTyperGame !== 'undefined' ? SpeedTyperGame : null);
      if (SpeedTyperClass) {
        activeInPageGame = new SpeedTyperClass(arena, onGameFinished);
      }
    }

    // Modal events
    modal.querySelector('#jigra-modal-close')?.addEventListener('click', async () => {
      closeInPageMiniGame();
      if (wasInActiveSession || timerData.state === 'PAUSED') {
        if (!isContextValid()) return;
        await safeSendMessage({ type: 'RESUME_TIMER' });
        showSpeechBubble('⚡ Session resumed!', 3000);
      }
    });

    modal.querySelector('#jigra-modal-switch-mem')?.addEventListener('click', () => {
      openInPageMiniGame('memory', wasInActiveSession);
    });

    modal.querySelector('#jigra-modal-switch-typ')?.addEventListener('click', () => {
      openInPageMiniGame('typer', wasInActiveSession);
    });
  }

  function closeInPageMiniGame() {
    if (activeInPageGame && activeInPageGame.destroy) {
      activeInPageGame.destroy();
      activeInPageGame = null;
    }
    const existing = shadowRoot.getElementById('jigra-inpage-game-modal');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function updatePositionStyles() {
    const root = shadowRoot?.getElementById('jigra-root');
    if (!root) return;
    root.style.position = 'fixed';
    root.style.left = `${currentPosX}px`;
    root.style.top = `${currentPosY}px`;
  }

  function setupDragEvents() {
    const root = shadowRoot.getElementById('jigra-root');
    if (!root) return;

    const onPointerDown = (e) => {
      // Don't drag if clicking inside HUD or modal
      if (e.target.closest('#jigra-hud') || e.target.closest('#jigra-inpage-game-modal')) return;

      isDragging = true;
      hasMoved = false;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      dragStartX = clientX - currentPosX;
      dragStartY = clientY - currentPosY;
      root.classList.add('is-dragging');

      window.addEventListener('mousemove', onPointerMove, { passive: true });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      const nextX = clientX - dragStartX;
      const nextY = clientY - dragStartY;

      if (Math.abs(nextX - currentPosX) > 4 || Math.abs(nextY - currentPosY) > 4) {
        hasMoved = true;
      }

      // Viewport bounds
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 120;
      currentPosX = Math.max(10, Math.min(maxX, nextX));
      currentPosY = Math.max(10, Math.min(maxY, nextY));

      updatePositionStyles();
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      root.classList.remove('is-dragging');

      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      // Snap to closest edge (left or right)
      const mid = window.innerWidth / 2;
      if (currentPosX < mid) {
        currentPosX = 16; // Snap Left
      } else {
        currentPosX = window.innerWidth - 104; // Snap Right
      }
      updatePositionStyles();

      // If it was a clean click without moving, toggle HUD
      if (!hasMoved) {
        toggleHUD();
      }
    };

    root.addEventListener('mousedown', onPointerDown);
    root.addEventListener('touchstart', onPointerDown, { passive: true });
  }

  function toggleHUD(forceState) {
    const hud = shadowRoot.getElementById('jigra-hud');
    if (!hud) return;
    const isOpen = hud.classList.contains('open');
    const nextState = forceState !== undefined ? forceState : !isOpen;

    if (nextState) {
      hud.classList.add('open');
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    } else {
      hud.classList.remove('open');
    }
  }

  function showSpeechBubble(content, duration = 4500) {
    const bubble = shadowRoot.getElementById('jigra-bubble');
    if (!bubble) return;

    if (speechTimeout) clearTimeout(speechTimeout);

    if (typeof content === 'string') {
      bubble.innerHTML = `<div class="jigra-bubble-body">${content}</div>`;
    } else if (content && typeof content === 'object') {
      duration = content.duration || duration || 6000;
      let html = '';
      if (content.title) {
        html += `<div class="jigra-bubble-title">${content.title}</div>`;
      }
      if (content.text) {
        html += `<div class="jigra-bubble-body">${content.text}</div>`;
      }
      if (content.actionText) {
        html += `<button class="jigra-bubble-btn" id="jigra-bubble-act-btn">${content.actionText}</button>`;
      }
      bubble.innerHTML = html;

      if (content.actionText && content.onAction) {
        const actBtn = bubble.querySelector('#jigra-bubble-act-btn');
        actBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          content.onAction();
        });
      }
    }

    bubble.classList.add('visible');

    speechTimeout = setTimeout(() => {
      bubble.classList.remove('visible');
    }, duration);
  }

  function tickTimer() {
    if (!isContextValid()) {
      cleanupOrphanedScript();
      return;
    }

    try {
      const remaining = getRemainingSeconds();
      const formatted = formatTime(remaining);

      const timeSpan = shadowRoot?.getElementById('jigra-pill-time');
      if (timeSpan) {
        if (timerData.state === 'PAUSED') {
          timeSpan.textContent = `⏸️ ${formatted}`;
        } else {
          timeSpan.textContent = formatted;
        }
      }

      // While paused, track elapsed pause time and trigger periodic reminders
      if (timerData.state === 'PAUSED' && pauseMonitoringActive) {
        pauseSecondsElapsed++;
        // Every 35 seconds of paused state, trigger a friendly reminder if no game is running
        if (pauseSecondsElapsed > 0 && pauseSecondsElapsed % 35 === 0) {
          if (!activeInPageGame) {
            triggerPauseReminder(false);
          }
        }
      }
    } catch (e) {
      if (e?.message?.includes('Extension context invalidated')) {
        cleanupOrphanedScript();
      }
    }
  }

  function setupListeners() {
    if (!isContextValid()) return;

    // Listen for storage changes
    try {
      JigraStorage.onChanged(async (changes) => {
        if (!isContextValid()) return;
        try {
          const store = await JigraStorage.get();
          if (!isContextValid() || !store) return;
          companionData = store.companion;
          economyData = store.economy;
          timerData = store.timer;
          settingsData = store.settings || settingsData;

          updateCurrentStateFromTimer();
          renderCompanionUI();
        } catch (e) {
          if (e?.message?.includes('Extension context invalidated')) {
            cleanupOrphanedScript();
          }
        }
      });
    } catch (e) {}

    // Listen for runtime broadcasts
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
          if (!isContextValid()) return;
          try {
            const { type, payload } = message;

            if (type === 'STATE_CHANGED' && payload?.timer) {
              timerData = payload.timer;
              updateCurrentStateFromTimer();
              renderCompanionUI();
            } else if (type === 'PAUSE_REMINDER_NUDGE') {
              // Nudge from service worker or tab broadcast
              if (timerData.state === 'PAUSED' && !activeInPageGame) {
                triggerPauseReminder(false);
              }
            } else if (type === 'DISTRACTION_ALERT') {
              // Distraction detected!
              currentState = 'distracted';
              renderCompanionUI();
              showSpeechBubble(payload?.reason || 'Tap tap! Back to work! 🚨', 5000);

              if (typeof JigraAudio !== 'undefined') {
                JigraAudio.playTapGlass();
              }

              setTimeout(() => {
                if (!isContextValid()) return;
                updateCurrentStateFromTimer();
                renderCompanionUI();
              }, 5000);
            } else if (type === 'TIMER_COMPLETED') {
              // Victory celebration!
              currentState = 'celebrating';
              renderCompanionUI();
              showSpeechBubble(`🎉 Session Complete! +${payload.sparksEarned} Sparks! Click 'Play' for your 60s micro-break! 🎮`, 7000);

              // Sound fanfare
              if (typeof JigraAudio !== 'undefined') {
                JigraAudio.playVictoryJingle();
              }

              // Confetti burst from companion origin
              if (typeof JigraConfetti !== 'undefined') {
                JigraConfetti.launch({
                  x: currentPosX + 44,
                  y: currentPosY + 44,
                  count: 90
                });
              }
            }
          } catch (e) {
            if (e?.message?.includes('Extension context invalidated')) {
              cleanupOrphanedScript();
            }
          }
        });
      }
    } catch (e) {
      // Extension context invalidated
    }

    // Keep companion on screen on window resize
    window.addEventListener('resize', () => {
      if (!isContextValid()) return;
      currentPosX = Math.min(currentPosX, window.innerWidth - 104);
      currentPosY = Math.min(currentPosY, window.innerHeight - 120);
      updatePositionStyles();
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCompanion);
  } else {
    initCompanion();
  }
})();
