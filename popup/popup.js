/**
 * Jigra Popup Controller
 * Manages timer display, mode switching, companion preview, and action dispatches.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const CIRCLE_CIRCUMFERENCE = 440; // 2 * Math.PI * 70 = ~439.8

  // DOM Elements
  const badgeSparks = document.getElementById('badge-sparks');
  const badgeStreak = document.getElementById('badge-streak');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const timerProgress = document.getElementById('timer-progress');
  const timerDisplay = document.getElementById('timer-display');
  const timerStateLabel = document.getElementById('timer-state-label');
  const btnMain = document.getElementById('btn-main-action');
  const btnMainIcon = document.getElementById('btn-main-icon');
  const btnMainText = document.getElementById('btn-main-text');
  const btnReset = document.getElementById('btn-reset');
  const btnSkip = document.getElementById('btn-skip');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnToggleShield = document.getElementById('btn-toggle-shield');
  const companionCard = document.getElementById('companion-card');
  const companionAvatar = document.getElementById('companion-avatar-container');
  const companionName = document.getElementById('companion-name-display');
  const companionStage = document.getElementById('companion-stage-display');
  const companionXpFill = document.getElementById('companion-xp-fill');
  const companionXpLabel = document.getElementById('companion-xp-label');

  let stateCache = null;
  let tickTimerId = null;

  async function refreshUI() {
    stateCache = await JigraStorage.get();
    const { timer, economy, companion, settings } = stateCache;

    // Badges
    badgeSparks.textContent = economy.sparks;
    badgeStreak.textContent = `${economy.streakDays}d`;

    // Active Mode Button
    modeButtons.forEach((btn) => {
      if (btn.dataset.mode === timer.mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Companion preview
    let animState = 'idle';
    if (timer.state === 'FOCUS') animState = 'focusing';
    else if (timer.state === 'BREAK') animState = 'celebrating';

    companionAvatar.innerHTML = JigraRenderer.renderSVG(companion, animState, 50);
    companionName.textContent = companion.name;

    const currentStageObj = JigraStorage.EVOLUTION_STAGES.find((s) => s.stage === companion.evolutionStage) || {
      title: 'Flame Sprout'
    };
    companionStage.textContent = currentStageObj.title;

    const xpPercent = Math.min(100, Math.round((companion.exp / companion.expToNext) * 100));
    companionXpFill.style.width = `${xpPercent}%`;
    companionXpLabel.textContent = `Level ${companion.level} • ${companion.exp}/${companion.expToNext} XP`;

    // Shield status toggle
    if (settings.gentleShield) {
      btnToggleShield.classList.add('active');
    } else {
      btnToggleShield.classList.remove('active');
    }

    // Micro-break interval status
    const gameAccess = JigraStorage.checkGameAccess(stateCache);
    const popupIntervalStatus = document.getElementById('popup-interval-status');
    if (popupIntervalStatus) {
      popupIntervalStatus.textContent = gameAccess.progressText;
      popupIntervalStatus.style.color = gameAccess.allowed ? '#34d399' : '#f87171';
    }

    updateClockAndProgress();
    updateButtonStates();
  }

  function getCalculatedRemaining() {
    if (!stateCache) return 0;
    const { timer } = stateCache;
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

  function updateClockAndProgress() {
    if (!stateCache) return;
    const { timer } = stateCache;
    const remaining = getCalculatedRemaining();
    const duration = timer.duration || 1500;

    timerDisplay.textContent = formatTime(remaining);

    // Progress circle
    const fraction = Math.max(0, Math.min(1, remaining / duration));
    const offset = CIRCLE_CIRCUMFERENCE * (1 - fraction);
    timerProgress.style.strokeDashoffset = offset;

    if (timer.state === 'BREAK') {
      timerProgress.classList.add('break-mode');
      timerStateLabel.textContent = '☕ Micro-Break';
    } else if (timer.state === 'FOCUS') {
      timerProgress.classList.remove('break-mode');
      timerStateLabel.textContent = '🔥 Focusing';
    } else if (timer.state === 'PAUSED') {
      timerProgress.classList.remove('break-mode');
      timerStateLabel.textContent = '⏸ Paused';
    } else {
      timerProgress.classList.remove('break-mode');
      timerStateLabel.textContent = 'Ready to Study';
    }
  }

  function updateButtonStates() {
    if (!stateCache) return;
    const { timer } = stateCache;

    if (timer.state === 'FOCUS' || timer.state === 'BREAK') {
      btnMainIcon.textContent = '⏸';
      btnMainText.textContent = 'Pause';
    } else if (timer.state === 'PAUSED') {
      btnMainIcon.textContent = '▶';
      btnMainText.textContent = 'Resume';
    } else {
      btnMainIcon.textContent = '▶';
      btnMainText.textContent = 'Start Focus';
    }
  }

  // Event Listeners
  btnMain.addEventListener('click', async () => {
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    if (!stateCache) return;
    const { timer } = stateCache;

    if (timer.state === 'FOCUS' || timer.state === 'BREAK') {
      await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
    } else if (timer.state === 'PAUSED') {
      await chrome.runtime.sendMessage({ type: 'RESUME_TIMER' });
    } else {
      await chrome.runtime.sendMessage({ type: 'START_TIMER', payload: { mode: timer.mode } });
    }
    refreshUI();
  });

  btnReset.addEventListener('click', async () => {
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    await chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
    refreshUI();
  });

  btnSkip.addEventListener('click', async () => {
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    await chrome.runtime.sendMessage({ type: 'SKIP_TO_BREAK' });
    refreshUI();
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
      const newMode = btn.dataset.mode;
      const config = JigraStorage.TIMER_MODES[newMode];
      if (!config) return;

      const duration = Math.round(config.focusMinutes * 60);
      await JigraStorage.updateTimer({
        mode: newMode,
        duration,
        remainingSeconds: duration,
        state: 'IDLE',
        targetTimestamp: null
      });

      refreshUI();
    });
  });

  btnOpenDashboard.addEventListener('click', () => {
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });

  companionCard.addEventListener('click', () => {
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', payload: { tab: 'evolution' } });
  });

  btnToggleShield.addEventListener('click', async () => {
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    const data = await JigraStorage.get();
    const nextVal = !data.settings.gentleShield;
    const settings = { ...data.settings, gentleShield: nextVal, ultraShield: nextVal };
    await JigraStorage.set({ settings });
    refreshUI();
  });

  document.getElementById('btn-popup-arcade')?.addEventListener('click', () => {
    if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', payload: { tab: 'arcade' } });
  });

  // Storage and Runtime listeners
  JigraStorage.onChanged(() => {
    refreshUI();
  });

  // Clock tick
  tickTimerId = setInterval(() => {
    updateClockAndProgress();
  }, 500);

  // Initial load
  await refreshUI();
});
