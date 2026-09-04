/**
 * Jigra YouTube Study Shield Content Script
 * Suppresses recommendation feeds, comments, and explore rabbit holes.
 * Intercepts Shorts SPA navigation and provides an emergency exit deterrent.
 */

(function () {
  let isShieldActive = false;
  let currentTimerState = 'IDLE';
  let currentTimerMode = 'standard';
  let targetTimestamp = null;
  let remainingSeconds = 0;
  let companionData = { skin: 'ember', hat: 'none', aura: 'none', level: 1 };
  let holdInterval = null;
  let holdProgress = 0;

  // Initialize Shield
  async function initShield() {
    if (typeof JigraStorage === 'undefined') {
      setTimeout(initShield, 100);
      return;
    }

    const data = await JigraStorage.get();
    applyState(data);

    // Listen for storage updates
    JigraStorage.onChanged((changes) => {
      if (changes.timer || changes.settings || changes.companion) {
        JigraStorage.get().then(applyState);
      }
    });

    // Listen for runtime messages
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_CHANGED' && message.payload?.timer) {
        currentTimerState = message.payload.timer.state;
        currentTimerMode = message.payload.timer.mode;
        targetTimestamp = message.payload.timer.targetTimestamp;
        remainingSeconds = message.payload.timer.remainingSeconds;
        evaluateShield();
      }
    });

    // Hook YouTube SPA navigation events
    window.addEventListener('yt-navigate-finish', handleNavigation);
    window.addEventListener('yt-page-data-updated', handleNavigation);
    window.addEventListener('popstate', handleNavigation);

    // Polling fallback for SPA URL changes
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        handleNavigation();
      }
      updateTimerDisplay();
    }, 1000);

    handleNavigation();
  }

  function applyState(data) {
    currentTimerState = data.timer.state;
    currentTimerMode = data.timer.mode;
    targetTimestamp = data.timer.targetTimestamp;
    remainingSeconds = data.timer.remainingSeconds;
    companionData = data.companion || companionData;
    evaluateShield();
  }

  function evaluateShield() {
    const isFocusing = currentTimerState === 'FOCUS';
    const html = document.documentElement;

    if (isFocusing) {
      if (!isShieldActive) {
        html.classList.add('jigra-shield-active');
        isShieldActive = true;
      }
      injectHeaderBadge();
    } else {
      html.classList.remove('jigra-shield-active');
      isShieldActive = false;
      removeShortsBlocker();
      removeHeaderBadge();
    }

    checkShortsInterception();
  }

  function handleNavigation() {
    evaluateShield();
  }

  function checkShortsInterception() {
    const isShorts = location.pathname.startsWith('/shorts');
    const isFocusing = currentTimerState === 'FOCUS';

    if (isShorts && isFocusing) {
      // Pause video playback immediately
      document.querySelectorAll('video').forEach((v) => {
        try {
          v.pause();
          v.muted = true;
        } catch (e) {}
      });

      // Play alert sound if audio module available
      if (typeof JigraAudio !== 'undefined' && JigraAudio.playWarning) {
        JigraAudio.playWarning();
      }

      showShortsBlocker();
    } else {
      removeShortsBlocker();
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function getCalculatedRemaining() {
    if (targetTimestamp && currentTimerState === 'FOCUS') {
      return Math.max(0, Math.ceil((targetTimestamp - Date.now()) / 1000));
    }
    return remainingSeconds || 0;
  }

  function updateTimerDisplay() {
    const remaining = getCalculatedRemaining();
    const formatted = formatTime(remaining);

    // Update blocker timer
    const timerElem = document.getElementById('jigra-blocker-countdown');
    if (timerElem) {
      timerElem.textContent = formatted;
    }

    // Update header badge
    const badgeTime = document.getElementById('jigra-badge-time');
    if (badgeTime) {
      badgeTime.textContent = formatted;
    }
  }

  function showShortsBlocker() {
    let blocker = document.getElementById('jigra-shorts-blocker');
    if (blocker) return;

    blocker = document.createElement('div');
    blocker.id = 'jigra-shorts-blocker';

    let companionSVG = '';
    if (typeof JigraRenderer !== 'undefined') {
      companionSVG = JigraRenderer.renderSVG(companionData, 'distracted', 96);
    } else {
      companionSVG = '🔥';
    }

    const isUltra = currentTimerMode === 'ultra';

    blocker.innerHTML = `
      <div class="jigra-blocker-card">
        <div id="jigra-blocker-avatar">${companionSVG}</div>
        <h2 class="jigra-blocker-title">Focus Shield Triggered!</h2>
        <p class="jigra-blocker-desc">
          YouTube Shorts is a notorious doom-scroll trap. Your companion is cheering for you to finish this study block!
        </p>
        <div class="jigra-blocker-timer" id="jigra-blocker-countdown">${formatTime(getCalculatedRemaining())}</div>
        
        <button class="jigra-blocker-btn" id="jigra-return-btn">
          ⬅ Return to Study Video
        </button>

        ${
          isUltra
            ? `
          <div class="jigra-override-container">
            <button class="jigra-override-btn" id="jigra-override-btn">
              Hold 5s for Emergency Override
            </button>
            <div class="jigra-hold-progress-bar" id="jigra-override-progress">
              <div class="jigra-hold-progress-fill" id="jigra-override-fill"></div>
            </div>
          </div>
        `
            : `
          <div class="jigra-override-container">
            <button class="jigra-override-btn" id="jigra-gentle-exit-btn">
              Pause Study Session
            </button>
          </div>
        `
        }
      </div>
    `;

    (document.body || document.documentElement).appendChild(blocker);

    // Event listeners
    document.getElementById('jigra-return-btn')?.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'https://www.youtube.com/';
      }
    });

    if (isUltra) {
      const overrideBtn = document.getElementById('jigra-override-btn');
      const progressBar = document.getElementById('jigra-override-progress');
      const progressFill = document.getElementById('jigra-override-fill');

      const startHold = (e) => {
        e.preventDefault();
        holdProgress = 0;
        if (progressBar) progressBar.style.display = 'block';
        if (overrideBtn) overrideBtn.textContent = 'Keep Holding... (5s)';

        holdInterval = setInterval(() => {
          holdProgress += 2;
          if (progressFill) progressFill.style.width = `${holdProgress}%`;

          if (holdProgress >= 100) {
            clearInterval(holdInterval);
            removeShortsBlocker();
            chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
            alert('Emergency override granted. Focus session paused.');
          }
        }, 100);
      };

      const cancelHold = () => {
        if (holdInterval) {
          clearInterval(holdInterval);
          holdInterval = null;
        }
        holdProgress = 0;
        if (progressFill) progressFill.style.width = '0%';
        if (progressBar) progressBar.style.display = 'none';
        if (overrideBtn) overrideBtn.textContent = 'Hold 5s for Emergency Override';
      };

      overrideBtn?.addEventListener('mousedown', startHold);
      overrideBtn?.addEventListener('mouseup', cancelHold);
      overrideBtn?.addEventListener('mouseleave', cancelHold);
      overrideBtn?.addEventListener('touchstart', startHold);
      overrideBtn?.addEventListener('touchend', cancelHold);
    } else {
      document.getElementById('jigra-gentle-exit-btn')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
        removeShortsBlocker();
      });
    }
  }

  function removeShortsBlocker() {
    const blocker = document.getElementById('jigra-shorts-blocker');
    if (blocker && blocker.parentNode) {
      blocker.parentNode.removeChild(blocker);
    }
  }

  function injectHeaderBadge() {
    if (document.getElementById('jigra-yt-status-badge')) return;

    const targets = [
      document.querySelector('ytd-masthead #end'),
      document.querySelector('ytd-masthead #buttons'),
      document.querySelector('#masthead-container')
    ];

    const target = targets.find((el) => !!el);
    if (!target) return;

    const badge = document.createElement('div');
    badge.id = 'jigra-yt-status-badge';
    badge.title = 'Jigra Study Shield is protecting you from recommendations!';
    badge.innerHTML = `
      <span>🛡️ Jigra Focus</span>
      <span id="jigra-badge-time" style="font-family:monospace; background:rgba(0,0,0,0.2); padding:1px 6px; border-radius:10px;">${formatTime(getCalculatedRemaining())}</span>
    `;

    badge.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    });

    target.prepend(badge);
  }

  function removeHeaderBadge() {
    const badge = document.getElementById('jigra-yt-status-badge');
    if (badge && badge.parentNode) {
      badge.parentNode.removeChild(badge);
    }
  }

  // Start initialization immediately at document_start to prevent DOM flicker
  initShield();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      evaluateShield();
    });
  }
})();
