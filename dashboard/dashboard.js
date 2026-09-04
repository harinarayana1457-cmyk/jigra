/**
 * Jigra Dashboard Controller
 * Handles tab routing, Focus Hub timer engine, Bazaar shop purchasing/equipping,
 * Companion evolution tree and interactive emotes, and Micro-Break mini-games.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let activeTab = 'focus-hub';
  let activeGame = 'memory';
  let currentGameInstance = null;
  let previewEmoteState = 'idle';
  let currentFilter = 'all';
  let appData = null;

  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const dashWalletSparks = document.getElementById('dash-wallet-sparks');
  const dashWalletStreak = document.getElementById('dash-wallet-streak');

  // Focus Hub elements
  const hubClockDisplay = document.getElementById('hub-clock-display');
  const hubPhaseLabel = document.getElementById('hub-phase-label');
  const hubModeButtons = document.querySelectorAll('.hub-mode-btn');
  const hubBtnStart = document.getElementById('hub-btn-start');
  const hubBtnIcon = document.getElementById('hub-btn-icon');
  const hubBtnText = document.getElementById('hub-btn-text');
  const hubBtnReset = document.getElementById('hub-btn-reset');
  const hubBtnSkip = document.getElementById('hub-btn-skip');
  const statTotalMinutes = document.getElementById('stat-total-minutes');
  const statSessionCount = document.getElementById('stat-session-count');
  const statCompanionLevel = document.getElementById('stat-companion-level');
  const statCompanionStage = document.getElementById('stat-companion-stage');
  const hubHistoryList = document.getElementById('hub-history-list');

  // Bazaar elements
  const filterButtons = document.querySelectorAll('.filter-btn');
  const bazaarItemsGrid = document.getElementById('bazaar-items-grid');

  // Evolution elements
  const showcaseAvatar = document.getElementById('showcase-avatar-container');
  const showcaseName = document.getElementById('showcase-name');
  const showcaseStageLabel = document.getElementById('showcase-stage-label');
  const showcaseXpBar = document.getElementById('showcase-xp-bar');
  const showcaseLevelText = document.getElementById('showcase-level-text');
  const showcaseXpText = document.getElementById('showcase-xp-text');
  const emoteButtons = document.querySelectorAll('.btn-emote');
  const evolutionStagesList = document.getElementById('evolution-stages-list');

  // Arcade elements
  const gameTabButtons = document.querySelectorAll('.game-tab-btn');
  const btnRestartGame = document.getElementById('btn-restart-game');
  const arcadeArena = document.getElementById('arcade-arena');

  // Initialize
  async function initDashboard() {
    appData = await JigraStorage.get();

    // Check URL hash for tab navigation (e.g. #bazaar, #evolution)
    const hash = window.location.hash.replace('#', '');
    if (hash && ['focus-hub', 'bazaar', 'evolution', 'arcade'].includes(hash)) {
      switchTab(hash);
    }

    renderAllViews();
    setupEventListeners();

    // Clock ticker
    setInterval(() => {
      updateHubClock();
    }, 500);

    // Storage updates listener
    JigraStorage.onChanged(async () => {
      appData = await JigraStorage.get();
      renderAllViews();
    });
  }

  function renderAllViews() {
    if (!appData) return;
    renderWalletAndMetrics();
    renderFocusHub();
    renderBazaar();
    renderEvolution();
    renderArcadeIntervals();
    if (activeTab === 'arcade' && !currentGameInstance) {
      launchMiniGame(activeGame);
    }
  }

  function switchTab(tabId) {
    activeTab = tabId;
    window.location.hash = tabId;

    navItems.forEach((item) => {
      if (item.dataset.tab === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    tabPanes.forEach((pane) => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (tabId === 'arcade' && !currentGameInstance) {
      launchMiniGame(activeGame);
    }
  }

  /* ------------------- WALLET & METRICS ------------------- */
  function renderWalletAndMetrics() {
    const { economy, companion } = appData;
    dashWalletSparks.textContent = economy.sparks;
    dashWalletStreak.textContent = `${economy.streakDays}d`;

    statTotalMinutes.textContent = `${economy.totalMinutesFocused || 0}m`;
    statSessionCount.textContent = appData.timer.sessionCount || 0;
    statCompanionLevel.textContent = `Lv. ${companion.level}`;

    const currentStageObj =
      JigraStorage.EVOLUTION_STAGES.find((s) => s.stage === companion.evolutionStage) ||
      JigraStorage.EVOLUTION_STAGES[0];
    statCompanionStage.textContent = currentStageObj.title;
  }

  /* ------------------- FOCUS HUB ------------------- */
  function getCalculatedRemaining() {
    if (!appData) return 0;
    const { timer } = appData;
    if (timer.targetTimestamp && (timer.state === 'FOCUS' || timer.state === 'BREAK')) {
      return Math.max(0, Math.ceil((timer.targetTimestamp - Date.now()) / 1000));
    }
    return timer.remainingSeconds || 0;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateHubClock() {
    if (!appData) return;
    const remaining = getCalculatedRemaining();
    hubClockDisplay.textContent = formatTime(remaining);

    const { state } = appData.timer;
    if (state === 'FOCUS') {
      hubPhaseLabel.textContent = '🔥 Study Session in Progress';
      hubPhaseLabel.style.color = '#de5b1b';
      hubPhaseLabel.style.borderColor = '#de5b1b';
      hubPhaseLabel.style.background = 'rgba(222, 91, 27, 0.12)';
    } else if (state === 'BREAK') {
      hubPhaseLabel.textContent = '☕ Micro-Break Active (60s Brain Reset)';
      hubPhaseLabel.style.color = '#15803d';
      hubPhaseLabel.style.borderColor = '#15803d';
      hubPhaseLabel.style.background = 'rgba(21, 128, 61, 0.12)';
    } else if (state === 'PAUSED') {
      hubPhaseLabel.textContent = '⏸ Study Session Paused';
      hubPhaseLabel.style.color = '#b45309';
      hubPhaseLabel.style.borderColor = '#b45309';
      hubPhaseLabel.style.background = 'rgba(180, 83, 9, 0.12)';
    } else {
      hubPhaseLabel.textContent = 'Ready to Focus';
      hubPhaseLabel.style.color = '#5c544c';
      hubPhaseLabel.style.borderColor = '#5c544c';
      hubPhaseLabel.style.background = 'rgba(92, 84, 76, 0.10)';
    }
  }

  function renderFocusHub() {
    const { timer, economy } = appData;

    // Active mode button
    hubModeButtons.forEach((btn) => {
      if (btn.dataset.mode === timer.mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Main button state
    if (timer.state === 'FOCUS' || timer.state === 'BREAK') {
      hubBtnIcon.textContent = '⏸';
      hubBtnText.textContent = 'Pause';
    } else if (timer.state === 'PAUSED') {
      hubBtnIcon.textContent = '▶';
      hubBtnText.textContent = 'Resume';
    } else {
      hubBtnIcon.textContent = '▶';
      hubBtnText.textContent = 'Start Focus';
    }

    updateHubClock();

    // History list
    if (economy.history && economy.history.length > 0) {
      hubHistoryList.innerHTML = economy.history
        .slice()
        .reverse()
        .map(
          (h) => `
        <div class="history-row">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">🔥</span>
            <div>
              <div style="font-weight: 800; color: #141210; font-size: 14px;">${h.minutes}m Focus Session</div>
              <div style="font-size: 12px; color: #5c544c; font-weight: 600;">${h.date} • Mode: ${h.mode}</div>
            </div>
          </div>
          <span style="font-weight: 900; color: #b45309; font-size: 14px;">+${h.sparks} Sparks ★</span>
        </div>
      `
        )
        .join('');
    } else {
      hubHistoryList.innerHTML = `
        <div class="history-row" style="color: var(--text-muted); justify-content: center;">
          No sessions completed yet. Start a focus sprint to begin your streak!
        </div>
      `;
    }
  }

  /* ------------------- BAZAAR SHOP ------------------- */
  function renderBazaar() {
    const { companion, inventory, economy } = appData;
    const items = JigraStorage.BAZAAR_ITEMS;

    const filtered = items.filter((item) => {
      if (currentFilter === 'all') return true;
      return item.type === currentFilter;
    });

    bazaarItemsGrid.innerHTML = filtered
      .map((item) => {
        const isUnlocked = inventory.includes(item.id) || item.price === 0;
        const isEquipped =
          (item.type === 'hat' && companion.hat === item.id.replace('hat_', '')) ||
          (item.type === 'skin' && companion.skin === item.id.replace('skin_', '')) ||
          (item.type === 'aura' && companion.aura === item.id.replace('aura_', ''));

        let actionBtnHtml = '';
        if (isEquipped) {
          actionBtnHtml = `<button class="btn-item-action btn-equipped">Equipped ✓</button>`;
        } else if (isUnlocked) {
          actionBtnHtml = `<button class="btn-item-action btn-equip" data-id="${item.id}">Equip</button>`;
        } else {
          actionBtnHtml = `<button class="btn-item-action btn-buy" data-id="${item.id}" data-price="${item.price}">Buy ✨ ${item.price}</button>`;
        }

        return `
        <div class="bazaar-item-card">
          <div class="item-badge-row">
            <span class="item-type-badge">${item.type}</span>
            <span class="item-price">${isUnlocked ? 'Owned' : `✨ ${item.price}`}</span>
          </div>
          <div class="item-icon-display">${item.icon}</div>
          <h3 class="item-name">${item.name}</h3>
          <p class="item-desc">${item.desc}</p>
          <div class="item-footer">
            <span style="font-size: 11px; color: var(--text-muted);">Cosmetic Item</span>
            ${actionBtnHtml}
          </div>
        </div>
      `;
      })
      .join('');

    // Attach buy / equip listeners
    bazaarItemsGrid.querySelectorAll('.btn-buy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const itemId = btn.dataset.id;
        const price = parseInt(btn.dataset.price, 10);
        await buyBazaarItem(itemId, price);
      });
    });

    bazaarItemsGrid.querySelectorAll('.btn-equip').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const itemId = btn.dataset.id;
        await equipBazaarItem(itemId);
      });
    });
  }

  async function buyBazaarItem(itemId, price) {
    if (appData.economy.sparks < price) {
      if (typeof JigraAudio !== 'undefined') JigraAudio.playWarning();
      alert(`Not enough Sparks! You need ✨ ${price} Sparks, but have ✨ ${appData.economy.sparks}. Complete more study blocks to earn sparks!`);
      return;
    }

    // Deduct sparks and add to inventory
    const newSparks = appData.economy.sparks - price;
    const newInventory = [...appData.inventory, itemId];

    await JigraStorage.set({
      economy: { ...appData.economy, sparks: newSparks },
      inventory: newInventory
    });

    if (typeof JigraAudio !== 'undefined') JigraAudio.playLevelUp();
    await equipBazaarItem(itemId);
  }

  async function equipBazaarItem(itemId) {
    const item = JigraStorage.BAZAAR_ITEMS.find((i) => i.id === itemId);
    if (!item) return;

    const companionUpdates = { ...appData.companion };
    if (item.type === 'hat') {
      companionUpdates.hat = item.id.replace('hat_', '');
    } else if (item.type === 'skin') {
      companionUpdates.skin = item.id.replace('skin_', '');
    } else if (item.type === 'aura') {
      companionUpdates.aura = item.id.replace('aura_', '');
    }

    await JigraStorage.set({ companion: companionUpdates });
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
  }

  /* ------------------- EVOLUTION TREE ------------------- */
  function renderEvolution() {
    const { companion } = appData;

    // Showcase
    showcaseAvatar.innerHTML = JigraRenderer.renderSVG(companion, previewEmoteState, 140);
    showcaseName.textContent = companion.name;

    const currentStageObj =
      JigraStorage.EVOLUTION_STAGES.find((s) => s.stage === companion.evolutionStage) ||
      JigraStorage.EVOLUTION_STAGES[0];
    showcaseStageLabel.textContent = currentStageObj.title;

    const xpPercent = Math.min(100, Math.round((companion.exp / companion.expToNext) * 100));
    showcaseXpBar.style.width = `${xpPercent}%`;
    showcaseLevelText.textContent = `Level ${companion.level}`;
    showcaseXpText.textContent = `${companion.exp} / ${companion.expToNext} XP`;

    // Stage roadmap
    evolutionStagesList.innerHTML = JigraStorage.EVOLUTION_STAGES.map((st) => {
      const isUnlocked = companion.level >= st.minLevel;
      const isCurrent = companion.evolutionStage === st.stage;

      return `
        <div class="stage-card ${isUnlocked ? 'unlocked' : ''} ${isCurrent ? 'current' : ''}">
          <div class="stage-number-bubble">${st.stage}</div>
          <div class="stage-info">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h4 class="stage-title">${st.title}</h4>
              ${isCurrent ? '<span style="font-size: 10px; font-weight: 900; background: #de5b1b; color: #ffffff; border: 1px solid #141210; padding: 2px 8px; border-radius: 4px; box-shadow: 1px 1px 0px #141210; text-transform: uppercase;">Current Form</span>' : ''}
            </div>
            <p class="stage-desc">${st.desc}</p>
          </div>
          <div>
            ${isUnlocked ? '<span style="font-size: 11px; font-weight: 900; background: #eaf5ec; color: #15803d; border: 1.5px solid #15803d; padding: 4px 10px; border-radius: 6px;">Unlocked ✓</span>' : `<span style="font-size: 12px; font-weight: 800; color: #71675c;">Requires Lv. ${st.minLevel}</span>`}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ------------------- MICRO-BREAK ARCADE ------------------- */
  function renderArcadeIntervals() {
    if (!appData) return;
    const { settings } = appData;
    const intervalMode = settings.gameInterval?.mode || 'every_sprint';
    const access = JigraStorage.checkGameAccess(appData);

    const badge = document.getElementById('dash-interval-status-badge');
    if (badge) {
      badge.textContent = access.progressText;
      if (access.allowed) {
        badge.style.background = '#eaf5ec';
        badge.style.color = '#15803d';
        badge.style.border = '1.5px solid #15803d';
      } else {
        badge.style.background = '#fef2f2';
        badge.style.color = '#b91c1c';
        badge.style.border = '1.5px solid #b91c1c';
      }
    }

    const buttons = document.querySelectorAll('#dash-interval-btn-group button');
    buttons.forEach((btn) => {
      if (btn.dataset.interval === intervalMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function launchMiniGame(gameName) {
    if (currentGameInstance && currentGameInstance.destroy) {
      currentGameInstance.destroy();
    }
    arcadeArena.innerHTML = '';

    const onGameFinish = async () => {
      await JigraStorage.recordGamePlayed();
      appData = await JigraStorage.get();
      renderArcadeIntervals();
      await chrome.runtime.sendMessage({ type: 'RESUME_OR_START_NEXT_SPRINT' });
    };

    if (gameName === 'memory') {
      currentGameInstance = new MemoryMatchGame(arcadeArena, onGameFinish);
    } else if (gameName === 'typer') {
      currentGameInstance = new SpeedTyperGame(arcadeArena, onGameFinish);
    }
  }

  /* ------------------- EVENT LISTENERS ------------------- */
  function setupEventListeners() {
    // Navigation
    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
        switchTab(item.dataset.tab);
      });
    });

    // Arcade Interval group buttons
    document.querySelectorAll('#dash-interval-btn-group button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
        const newMode = btn.dataset.interval;
        await JigraStorage.updateGameIntervalMode(newMode);
        appData = await JigraStorage.get();
        renderArcadeIntervals();
      });
    });

    // Hub Timer Actions
    hubBtnStart.addEventListener('click', async () => {
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
      const { state, mode } = appData.timer;
      if (state === 'FOCUS' || state === 'BREAK') {
        await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
      } else if (state === 'PAUSED') {
        await chrome.runtime.sendMessage({ type: 'RESUME_TIMER' });
      } else {
        await chrome.runtime.sendMessage({ type: 'START_TIMER', payload: { mode } });
      }
    });

    hubBtnReset.addEventListener('click', async () => {
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
      await chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
    });

    hubBtnSkip.addEventListener('click', async () => {
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
      await chrome.runtime.sendMessage({ type: 'SKIP_TO_BREAK' });
      switchTab('arcade');
    });

    hubModeButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
        const mode = btn.dataset.mode;
        const config = JigraStorage.TIMER_MODES[mode];
        if (!config) return;

        const duration = Math.round(config.focusMinutes * 60);
        await JigraStorage.updateTimer({
          mode,
          duration,
          remainingSeconds: duration,
          state: 'IDLE',
          targetTimestamp: null
        });
      });
    });

    // Bazaar filters
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
        filterButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderBazaar();
      });
    });

    // Emote Previewer buttons
    emoteButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
        emoteButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        previewEmoteState = btn.dataset.state;
        renderEvolution();
      });
    });

    // Arcade Game Tabs
    gameTabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
        gameTabButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeGame = btn.dataset.game;
        launchMiniGame(activeGame);
      });
    });

    btnRestartGame.addEventListener('click', () => {
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
      launchMiniGame(activeGame);
    });
  }

  // Launch
  initDashboard();
});
