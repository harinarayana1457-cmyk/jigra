/**
 * Jigra Micro-Break: Speed Quote Typer
 * A 60-second typing sprint featuring inspiring focus quotes.
 */

(function (root) {
  const QUOTES = [
    "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    "Focus is a muscle. The more you protect your attention, the stronger your mind becomes.",
    "Small daily improvements over time lead to stunning results and true mastery.",
    "Deep work is the superpower to focus without distraction on cognitively demanding tasks.",
    "Do not wait to strike till the iron is hot; but make it hot by striking diligently.",
    "Energy flows where attention goes. Guard your time like your most precious asset."
  ];

  class SpeedTyperGame {
    constructor(containerElement, onFinish) {
      this.container = containerElement;
      this.onFinish = onFinish;
      this.targetQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      this.timerSeconds = 60;
      this.timerInterval = null;
      this.hasStarted = false;
      this.isGameOver = false;
      this.startTime = null;
      this.totalTyped = 0;
      this.correctChars = 0;

      this.init();
    }

    init() {
      this.render();
      this.bindEvents();
    }

    render() {
      const quoteChars = this.targetQuote
        .split('')
        .map((char, i) => `<span class="char" data-idx="${i}">${char}</span>`)
        .join('');

      this.container.innerHTML = `
        <div class="game-wrapper">
          <div class="game-header">
            <div class="game-stat">
              <span class="stat-label">Time Remaining</span>
              <span class="stat-value timer-val" id="typer-timer">01:00</span>
            </div>
            <div class="game-stat">
              <span class="stat-label">Speed</span>
              <span class="stat-value" id="typer-wpm">0 WPM</span>
            </div>
            <div class="game-stat">
              <span class="stat-label">Accuracy</span>
              <span class="stat-value" id="typer-accuracy">100%</span>
            </div>
          </div>

          <div class="quote-display-box" id="quote-display">
            ${quoteChars}
          </div>

          <div class="typing-input-wrapper">
            <input type="text" id="typer-input" class="typer-input" placeholder="Start typing here to begin 60s countdown..." autocomplete="off" autofocus />
          </div>

          <div class="game-result-modal" id="typer-result" style="display: none;">
            <div class="result-box">
              <div class="result-icon" id="typer-result-icon">⚡</div>
              <h3 class="result-title" id="typer-result-heading">Sprint Complete!</h3>
              <p class="result-desc" id="typer-result-desc">You typed at 52 WPM with 98% accuracy.</p>
              <div class="reward-pill">+5 Sparks ✨</div>
              <button class="game-btn-next" id="btn-finish-typer">Start Next Study Sprint 🚀</button>
            </div>
          </div>
        </div>
      `;
    }

    bindEvents() {
      const input = this.container.querySelector('#typer-input');
      if (!input) return;

      input.addEventListener('input', (e) => {
        if (this.isGameOver) return;

        if (!this.hasStarted) {
          this.hasStarted = true;
          this.startTime = Date.now();
          this.startTimer();
        }

        this.handleTyping(input.value);
      });

      this.container.querySelector('#btn-finish-typer')?.addEventListener('click', () => {
        if (this.onFinish) this.onFinish();
      });
    }

    handleTyping(inputValue) {
      const charElements = this.container.querySelectorAll('.char');
      let correct = 0;

      for (let i = 0; i < charElements.length; i++) {
        const elem = charElements[i];
        const targetChar = this.targetQuote[i];
        const typedChar = inputValue[i];

        elem.classList.remove('correct', 'incorrect', 'current');

        if (typedChar === undefined) {
          if (i === inputValue.length) {
            elem.classList.add('current');
          }
        } else if (typedChar === targetChar) {
          elem.classList.add('correct');
          correct++;
        } else {
          elem.classList.add('incorrect');
        }
      }

      this.correctChars = correct;
      this.totalTyped = inputValue.length;

      // Update WPM & Accuracy
      const elapsedMins = (Date.now() - this.startTime) / 60000;
      const wpm = elapsedMins > 0 ? Math.round(correct / 5 / elapsedMins) : 0;
      const accuracy = this.totalTyped > 0 ? Math.round((correct / this.totalTyped) * 100) : 100;

      const wpmElem = this.container.querySelector('#typer-wpm');
      const accElem = this.container.querySelector('#typer-accuracy');
      if (wpmElem) wpmElem.textContent = `${wpm} WPM`;
      if (accElem) accElem.textContent = `${accuracy}%`;

      // Play subtle tick sound
      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();

      // Check for completion
      if (inputValue.length >= this.targetQuote.length && correct === this.targetQuote.length) {
        this.endGame(true);
      }
    }

    startTimer() {
      const timerElem = this.container.querySelector('#typer-timer');
      this.timerInterval = setInterval(() => {
        if (this.isGameOver) return;
        this.timerSeconds--;

        const m = Math.floor(this.timerSeconds / 60);
        const s = this.timerSeconds % 60;
        if (timerElem) {
          timerElem.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          if (this.timerSeconds <= 10) {
            timerElem.style.color = '#ef4444';
          }
        }

        if (this.timerSeconds <= 0) {
          this.endGame(false);
        }
      }, 1000);
    }

    endGame(isCompleted) {
      if (this.isGameOver) return;
      this.isGameOver = true;
      clearInterval(this.timerInterval);

      const input = this.container.querySelector('#typer-input');
      if (input) input.disabled = true;

      // Award bonus sparks
      chrome.runtime.sendMessage({
        type: 'AWARD_MINI_GAME_SPARKS',
        payload: { sparks: 5 }
      });

      const elapsedMins = Math.max(0.1, (Date.now() - (this.startTime || Date.now())) / 60000);
      const finalWpm = Math.round(this.correctChars / 5 / elapsedMins);
      const finalAcc = this.totalTyped > 0 ? Math.round((this.correctChars / this.totalTyped) * 100) : 100;

      const modal = this.container.querySelector('#typer-result');
      const heading = this.container.querySelector('#typer-result-heading');
      const desc = this.container.querySelector('#typer-result-desc');

      if (isCompleted) {
        heading.textContent = 'Quote Conquered!';
        desc.textContent = `Blazing speed: ${finalWpm} WPM at ${finalAcc}% accuracy! Mind sharp and refocused.`;
        if (typeof JigraAudio !== 'undefined') JigraAudio.playVictoryJingle();
      } else {
        heading.textContent = 'Time Up! Focus Reset Done';
        desc.textContent = `Scored ${finalWpm} WPM with ${finalAcc}% accuracy. Brain primed for the next sprint!`;
      }

      if (modal) modal.style.display = 'flex';
    }

    destroy() {
      clearInterval(this.timerInterval);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpeedTyperGame };
  } else {
    root.SpeedTyperGame = SpeedTyperGame;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
