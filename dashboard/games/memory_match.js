/**
 * Jigra Micro-Break: 6-Pair Memory Matrix
 * A 60-second card-matching game to refresh cognitive working memory.
 */

(function (root) {
  const ICONS = [
    { id: 'brain', emoji: '🧠', name: 'Brain' },
    { id: 'atom', emoji: '⚛️', name: 'Atom' },
    { id: 'rocket', emoji: '🚀', name: 'Rocket' },
    { id: 'code', emoji: '💻', name: 'Code' },
    { id: 'fire', emoji: '🔥', name: 'Flame' },
    { id: 'star', emoji: '⭐', name: 'Star' }
  ];

  class MemoryMatchGame {
    constructor(containerElement, onFinish) {
      this.container = containerElement;
      this.onFinish = onFinish;
      this.cards = [];
      this.flippedCards = [];
      this.matchedPairs = 0;
      this.totalPairs = 6;
      this.timerSeconds = 60;
      this.timerInterval = null;
      this.isLocked = false;
      this.moves = 0;
      this.isGameOver = false;

      this.init();
    }

    init() {
      // Build deck of 12 cards (6 pairs)
      const deck = [...ICONS, ...ICONS].map((icon, idx) => ({
        uid: `${icon.id}-${idx}`,
        id: icon.id,
        emoji: icon.emoji,
        name: icon.name,
        isFlipped: false,
        isMatched: false
      }));

      // Shuffle deck using Fisher-Yates
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      this.cards = deck;
      this.render();
      this.startTimer();
    }

    render() {
      this.container.innerHTML = `
        <div class="game-wrapper">
          <div class="game-header">
            <div class="game-stat">
              <span class="stat-label">Time Remaining</span>
              <span class="stat-value timer-val" id="memory-timer">01:00</span>
            </div>
            <div class="game-stat">
              <span class="stat-label">Pairs Matched</span>
              <span class="stat-value" id="memory-pairs">0 / ${this.totalPairs}</span>
            </div>
            <div class="game-stat">
              <span class="stat-label">Moves</span>
              <span class="stat-value" id="memory-moves">0</span>
            </div>
          </div>

          <div class="memory-grid" id="memory-cards-grid">
            ${this.cards
              .map(
                (card, index) => `
              <div class="memory-card" data-index="${index}">
                <div class="card-inner">
                  <div class="card-front">❓</div>
                  <div class="card-back">${card.emoji}</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="game-result-modal" id="memory-result" style="display: none;">
            <div class="result-box">
              <div class="result-icon" id="result-emoji">🎉</div>
              <h3 class="result-title" id="result-heading">Brain Reset Complete!</h3>
              <p class="result-desc" id="result-message">You matched all pairs in time. Your working memory is primed!</p>
              <div class="reward-pill">+5 Sparks ✨</div>
              <button class="game-btn-next" id="btn-finish-break">Ready for Next Focus Block 🚀</button>
            </div>
          </div>
        </div>
      `;

      // Attach click listeners to cards
      const cardElements = this.container.querySelectorAll('.memory-card');
      cardElements.forEach((elem) => {
        elem.addEventListener('click', () => {
          const idx = parseInt(elem.dataset.index, 10);
          this.handleCardClick(idx, elem);
        });
      });

      this.container.querySelector('#btn-finish-break')?.addEventListener('click', () => {
        if (this.onFinish) this.onFinish();
      });
    }

    handleCardClick(index, elem) {
      if (this.isLocked || this.isGameOver) return;
      const card = this.cards[index];
      if (card.isFlipped || card.isMatched) return;

      // Flip card
      card.isFlipped = true;
      elem.classList.add('flipped');
      this.flippedCards.push({ card, elem });

      if (typeof JigraAudio !== 'undefined') JigraAudio.playClick();

      if (this.flippedCards.length === 2) {
        this.moves++;
        const movesElem = this.container.querySelector('#memory-moves');
        if (movesElem) movesElem.textContent = this.moves;

        this.checkForMatch();
      }
    }

    checkForMatch() {
      this.isLocked = true;
      const [first, second] = this.flippedCards;

      if (first.card.id === second.card.id) {
        // Matched!
        setTimeout(() => {
          first.card.isMatched = true;
          second.card.isMatched = true;
          first.elem.classList.add('matched');
          second.elem.classList.add('matched');

          this.matchedPairs++;
          const pairsElem = this.container.querySelector('#memory-pairs');
          if (pairsElem) pairsElem.textContent = `${this.matchedPairs} / ${this.totalPairs}`;

          if (typeof JigraAudio !== 'undefined') JigraAudio.playCardMatch();

          this.flippedCards = [];
          this.isLocked = false;

          if (this.matchedPairs === this.totalPairs) {
            this.endGame(true);
          }
        }, 350);
      } else {
        // No match - flip back
        setTimeout(() => {
          first.card.isFlipped = false;
          second.card.isFlipped = false;
          first.elem.classList.remove('flipped');
          second.elem.classList.remove('flipped');

          this.flippedCards = [];
          this.isLocked = false;
        }, 800);
      }
    }

    startTimer() {
      const timerElem = this.container.querySelector('#memory-timer');
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

    endGame(isWin) {
      if (this.isGameOver) return;
      this.isGameOver = true;
      clearInterval(this.timerInterval);

      // Award bonus sparks
      try {
        if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
          chrome.runtime.sendMessage({
            type: 'AWARD_MINI_GAME_SPARKS',
            payload: { sparks: 5 }
          }).catch(() => {});
        }
      } catch (e) {}

      const modal = this.container.querySelector('#memory-result');
      const emoji = this.container.querySelector('#result-emoji');
      const heading = this.container.querySelector('#result-heading');
      const desc = this.container.querySelector('#result-message');

      if (isWin) {
        emoji.textContent = '🏆';
        heading.textContent = 'Matrix Mastered!';
        desc.textContent = `Completed in ${60 - this.timerSeconds}s and ${this.moves} moves! Your brain is energized.`;
        if (typeof JigraAudio !== 'undefined') JigraAudio.playVictoryJingle();
      } else {
        emoji.textContent = '⏰';
        heading.textContent = 'Time Up! Brain Reset Done';
        desc.textContent = `Matched ${this.matchedPairs} / ${this.totalPairs} pairs. Micro-break complete!`;
      }

      if (modal) modal.style.display = 'flex';
    }

    destroy() {
      clearInterval(this.timerInterval);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MemoryMatchGame };
  } else {
    root.MemoryMatchGame = MemoryMatchGame;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
