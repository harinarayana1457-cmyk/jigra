/**
 * Jigra Background Service Worker (Manifest V3)
 * Manages Pomodoro timing with chrome.alarms, persists state, handles tab tracking,
 * awards Sparks currency, and coordinates with content scripts & popup.
 */

try {
  importScripts('/shared/storage.js');
} catch (e) {
  try {
    importScripts('../shared/storage.js');
  } catch (err) {
    console.error('[Jigra] Failed to import storage.js:', err);
  }
}

const ALARM_NAME = 'jigra_pomodoro_timer';
const DISTRACTING_DOMAINS = [
  'tiktok.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'facebook.com',
  'twitch.tv',
  'netflix.com'
];

// Initialize on extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Jigra] Installed or Updated:', details.reason);
  const data = await JigraStorage.get();
  console.log('[Jigra] Initial state verified:', data.companion.name, 'Level', data.companion.level);

  // Set default badge
  chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
  chrome.action.setBadgeText({ text: '' });
});

// Alarm Listener - Handles Timer Completion
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const data = await JigraStorage.get();
  const { state, mode } = data.timer;
  const modeConfig = JigraStorage.TIMER_MODES[mode] || JigraStorage.TIMER_MODES.standard;

  if (state === 'FOCUS') {
    // Focus block completed!
    const focusMins = Math.round(data.timer.duration / 60);
    const sparksEarned = modeConfig.rewardSparks;
    const expEarned = modeConfig.exp;

    // Record session & rewards
    await JigraStorage.recordSession(focusMins, mode, sparksEarned);
    const { companion, leveledUp } = await JigraStorage.addExp(expEarned);

    // Switch to BREAK state
    const breakDuration = Math.round(modeConfig.breakMinutes * 60);
    const targetTimestamp = Date.now() + breakDuration * 1000;

    const updatedTimer = {
      state: 'BREAK',
      mode,
      duration: breakDuration,
      remainingSeconds: breakDuration,
      targetTimestamp
    };
    await JigraStorage.updateTimer(updatedTimer);

    // Schedule break alarm
    chrome.alarms.create(ALARM_NAME, { when: targetTimestamp });

    // Show desktop notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '🎉 Focus Sprint Complete!',
      message: `Great job! You earned +${sparksEarned} Sparks & +${expEarned} XP! Time for your 60-second micro-break.`
    });

    // Notify all tabs (trigger companion victory dance & confetti)
    broadcastMessage({
      type: 'TIMER_COMPLETED',
      payload: {
        sparksEarned,
        expEarned,
        leveledUp,
        companion,
        openMicroBreak: true
      }
    });

    updateBadge('BRK', '#10b981');

  } else if (state === 'BREAK') {
    // Break completed!
    const updatedTimer = {
      state: 'IDLE',
      duration: modeConfig.focusMinutes * 60,
      remainingSeconds: modeConfig.focusMinutes * 60,
      targetTimestamp: null
    };
    await JigraStorage.updateTimer(updatedTimer);
    chrome.alarms.clear(ALARM_NAME);

    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '⚡ Micro-Break Finished!',
      message: 'Mind refreshed! Ready to begin your next focus sprint?'
    });

    broadcastMessage({
      type: 'BREAK_COMPLETED',
      payload: { timer: updatedTimer }
    });

    updateBadge('', '#f97316');
  }
});

// Update extension icon badge text
function updateBadge(text, color = '#f97316') {
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) {
    // Ignore in unsupported environments
  }
}

// Broadcast message to all runtime listeners and active tabs
async function broadcastMessage(message) {
  // Send to popup / dashboard
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (e) {}

  // Send to active tabs (companion overlay & youtube shield)
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  } catch (e) {}
}

// Message handler from Popup, Dashboard, and Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  (async () => {
    switch (type) {
      case 'START_TIMER': {
        const data = await JigraStorage.get();
        const mode = payload?.mode || data.timer.mode || 'standard';
        const modeConfig = JigraStorage.TIMER_MODES[mode] || JigraStorage.TIMER_MODES.standard;
        const duration = Math.round(modeConfig.focusMinutes * 60);
        const targetTimestamp = Date.now() + duration * 1000;

        const updatedTimer = {
          state: 'FOCUS',
          mode,
          duration,
          remainingSeconds: duration,
          targetTimestamp
        };
        await JigraStorage.updateTimer(updatedTimer);

        chrome.alarms.clear(ALARM_NAME, () => {
          chrome.alarms.create(ALARM_NAME, { when: targetTimestamp });
        });

        broadcastMessage({ type: 'STATE_CHANGED', payload: { timer: updatedTimer } });
        updateBadge('FOC', '#f97316');
        sendResponse({ success: true, timer: updatedTimer });
        break;
      }

      case 'PAUSE_TIMER': {
        const data = await JigraStorage.get();
        if (data.timer.state !== 'FOCUS' && data.timer.state !== 'BREAK') {
          return sendResponse({ success: false });
        }

        const remaining = data.timer.targetTimestamp
          ? Math.max(0, Math.ceil((data.timer.targetTimestamp - Date.now()) / 1000))
          : data.timer.remainingSeconds;

        chrome.alarms.clear(ALARM_NAME);

        const updatedTimer = {
          ...data.timer,
          state: 'PAUSED',
          previousRunningState: data.timer.state,
          remainingSeconds: remaining,
          targetTimestamp: null
        };
        await JigraStorage.updateTimer(updatedTimer);

        broadcastMessage({ type: 'STATE_CHANGED', payload: { timer: updatedTimer } });
        updateBadge('PAU', '#64748b');
        sendResponse({ success: true, timer: updatedTimer });
        break;
      }

      case 'RESUME_TIMER': {
        const data = await JigraStorage.get();
        if (data.timer.state !== 'PAUSED') {
          return sendResponse({ success: false });
        }

        const remaining = data.timer.remainingSeconds > 0 ? data.timer.remainingSeconds : 60;
        const targetTimestamp = Date.now() + remaining * 1000;
        const targetState = data.timer.previousRunningState || (data.timer.duration <= 600 ? 'BREAK' : 'FOCUS');

        const updatedTimer = {
          ...data.timer,
          state: targetState,
          targetTimestamp
        };
        await JigraStorage.updateTimer(updatedTimer);

        chrome.alarms.clear(ALARM_NAME, () => {
          chrome.alarms.create(ALARM_NAME, { when: targetTimestamp });
        });
        broadcastMessage({ type: 'STATE_CHANGED', payload: { timer: updatedTimer } });
        updateBadge(targetState === 'FOCUS' ? 'FOC' : 'BRK', targetState === 'FOCUS' ? '#f97316' : '#10b981');
        sendResponse({ success: true, timer: updatedTimer });
        break;
      }

      case 'RESUME_OR_START_NEXT_SPRINT': {
        const data = await JigraStorage.get();
        const prevState = data.timer.previousRunningState || data.timer.state;
        const isMiddleOfFocus =
          (data.timer.state === 'PAUSED' && prevState === 'FOCUS') ||
          (data.timer.state === 'FOCUS' && data.timer.remainingSeconds > 0 && data.timer.remainingSeconds < data.timer.duration);

        if (isMiddleOfFocus) {
          // Resume remaining focus session
          const remaining = data.timer.remainingSeconds > 0 ? data.timer.remainingSeconds : 60;
          const targetTimestamp = Date.now() + remaining * 1000;
          const updatedTimer = {
            ...data.timer,
            state: 'FOCUS',
            targetTimestamp
          };
          await JigraStorage.updateTimer(updatedTimer);

          chrome.alarms.clear(ALARM_NAME, () => {
            chrome.alarms.create(ALARM_NAME, { when: targetTimestamp });
          });

          broadcastMessage({ type: 'STATE_CHANGED', payload: { timer: updatedTimer } });
          updateBadge('FOC', '#f97316');
          sendResponse({ success: true, resumed: true, remainingSeconds: remaining, timer: updatedTimer });
        } else {
          // Scheduled break or fresh sprint -> start new focus session
          const mode = data.timer.mode || 'standard';
          const modeConfig = JigraStorage.TIMER_MODES[mode] || JigraStorage.TIMER_MODES.standard;
          const duration = Math.round(modeConfig.focusMinutes * 60);
          const targetTimestamp = Date.now() + duration * 1000;

          const updatedTimer = {
            state: 'FOCUS',
            mode,
            duration,
            remainingSeconds: duration,
            targetTimestamp
          };
          await JigraStorage.updateTimer(updatedTimer);

          chrome.alarms.clear(ALARM_NAME, () => {
            chrome.alarms.create(ALARM_NAME, { when: targetTimestamp });
          });

          broadcastMessage({ type: 'STATE_CHANGED', payload: { timer: updatedTimer } });
          updateBadge('FOC', '#f97316');
          sendResponse({ success: true, resumed: false, timer: updatedTimer });
        }
        break;
      }

      case 'RESET_TIMER': {
        const data = await JigraStorage.get();
        const mode = data.timer.mode || 'standard';
        const modeConfig = JigraStorage.TIMER_MODES[mode] || JigraStorage.TIMER_MODES.standard;
        const duration = Math.round(modeConfig.focusMinutes * 60);

        chrome.alarms.clear(ALARM_NAME);

        const updatedTimer = {
          state: 'IDLE',
          mode,
          duration,
          remainingSeconds: duration,
          targetTimestamp: null
        };
        await JigraStorage.updateTimer(updatedTimer);

        broadcastMessage({ type: 'STATE_CHANGED', payload: { timer: updatedTimer } });
        updateBadge('', '#f97316');
        sendResponse({ success: true, timer: updatedTimer });
        break;
      }

      case 'SKIP_TO_BREAK': {
        const data = await JigraStorage.get();
        const modeConfig = JigraStorage.TIMER_MODES[data.timer.mode] || JigraStorage.TIMER_MODES.standard;
        const breakDuration = Math.round(modeConfig.breakMinutes * 60);
        const targetTimestamp = Date.now() + breakDuration * 1000;

        const updatedTimer = {
          state: 'BREAK',
          mode: data.timer.mode,
          duration: breakDuration,
          remainingSeconds: breakDuration,
          targetTimestamp
        };
        await JigraStorage.updateTimer(updatedTimer);

        chrome.alarms.clear(ALARM_NAME, () => {
          chrome.alarms.create(ALARM_NAME, { when: targetTimestamp });
        });

        broadcastMessage({ type: 'STATE_CHANGED', payload: { timer: updatedTimer } });
        updateBadge('BRK', '#10b981');
        sendResponse({ success: true, timer: updatedTimer });
        break;
      }

      case 'AWARD_MINI_GAME_SPARKS': {
        const sparksWon = payload?.sparks || 5;
        const newTotal = await JigraStorage.addSparks(sparksWon);
        sendResponse({ success: true, sparks: newTotal });
        break;
      }

      case 'OPEN_DASHBOARD': {
        const url = chrome.runtime.getURL('dashboard/dashboard.html');
        if (payload?.tab) {
          chrome.tabs.create({ url: `${url}#${payload.tab}` });
        } else {
          chrome.tabs.create({ url });
        }
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();

  return true; // Keep message channel open for async response
});

// Distraction monitoring: Detect if user navigates to distracting sites while in FOCUS mode
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    checkTabDistraction(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      checkTabDistraction(activeInfo.tabId, tab.url);
    }
  } catch (e) {}
});

async function checkTabDistraction(tabId, url) {
  try {
    const data = await JigraStorage.get();
    if (data.timer.state !== 'FOCUS') return;

    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();

    // Check if visiting YouTube Shorts or other distracting sites
    const isShorts = host.includes('youtube.com') && parsedUrl.pathname.startsWith('/shorts');
    const isBlacklisted = DISTRACTING_DOMAINS.some((domain) => host.endsWith(domain));

    if (isShorts || isBlacklisted) {
      chrome.tabs.sendMessage(tabId, {
        type: 'DISTRACTION_ALERT',
        payload: {
          url,
          reason: isShorts ? 'YouTube Shorts detected!' : `${host} is a distraction zone!`
        }
      }).catch(() => {});
    }
  } catch (e) {}
}
