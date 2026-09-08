/**
 * Jigra Micro-Break: Spark Snake (Zen Arcade Classic)
 * A smooth 60-second zen snake game where you guide your companion flame ember
 * around a frosted grid eating focus sparks to build momentum and calm the mind.
 */

(function (root) {
  class SparkSnakeGame {
    constructor(containerElement, onFinish) {
      this.container = containerElement;
      this.onFinish = onFinish;

      // Canvas & Grid settings
      this.canvas = null;
      this.ctx = null;
      this.gridSize = 20; // 20px per cell
      this.cols = 24;     // 480px width
      this.rows = 18;     // 360px height

      // Game state
      this.snake = [];
      this.direction = { x: 1, y: 0 };
      this.nextDirection = { x: 1, y: 0 };
      this.food = { x: 15, y: 9, isBonus: false };
      this.particles = [];
      this.score = 0;
      this.sparksEaten = 0;
      this.timerSeconds = 60;
      this.timerInterval = null;
      this.gameLoopInterval = null;
      this.isGameOver = false;
      this.isPaused = false;
      this.speed = 110; // ms per tick

      // Event listener references for clean destroy
      this.handleKeyDown = this.onKeyDown.bind(this);

      this.init();
    }

    init() {
      // Starting snake: 4 segments in middle of grid
      const startX = 6;
      const startY = 9;
      this.snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY },
        { x: startX - 3, y: startY }
      ];
      this.direction = { x: 1, y: 0 };
      this.nextDirection = { x: 1, y: 0 };
      this.particles = [];
      this.score = 0;
      this.sparksEaten = 0;
      this.timerSeconds = 60;
      this.isGameOver = false;

      this.renderUI();
      this.setupCanvas();
      this.spawnFood();

      window.addEventListener('keydown', this.handleKeyDown);

      this.startGameLoops();
    }

    renderUI() {
      this.container.innerHTML = `
        <div class="game-wrapper snake-game-wrapper">
          <div class="game-header">
            <div class="game-stat">
              <span class="stat-label">Time Remaining</span>
              <span class="stat-value timer-val" id="snake-timer">01:00</span>
            </div>
            <div class="game-stat">
              <span class="stat-label">Sparks Eaten</span>
              <span class="stat-value" id="snake-sparks">0 ✨</span>
            </div>
            <div class="game-stat">
              <span class="stat-label">Focus Score</span>
              <span class="stat-value" id="snake-score">0</span>
            </div>
          </div>

          <div class="snake-canvas-box">
            <canvas id="snake-canvas" width="${this.cols * this.gridSize}" height="${this.rows * this.gridSize}"></canvas>
            
            <div class="snake-controls-hint">
              <span>Guide with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span>
            </div>
          </div>

          <!-- Result Modal -->
          <div class="game-result-modal" id="snake-result" style="display: none;">
            <div class="result-box">
              <div class="result-emoji" id="result-emoji">🐍</div>
              <h2 class="result-heading" id="result-heading">Zen Flow Mastered!</h2>
              <p class="result-message" id="result-message">
                You collected focus sparks and refreshed your mind!
              </p>
              <button class="btn-hub-primary" id="btn-snake-done">
                Back to Focus (+5 ✨)
              </button>
            </div>
          </div>
        </div>
      `;

      const btnDone = this.container.querySelector('#btn-snake-done');
      if (btnDone) {
        btnDone.addEventListener('click', () => {
          if (this.onFinish) this.onFinish();
        });
      }
    }

    setupCanvas() {
      this.canvas = this.container.querySelector('#snake-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
    }

    spawnFood() {
      let valid = false;
      let newFood = { x: 0, y: 0, isBonus: false };

      while (!valid) {
        newFood.x = Math.floor(Math.random() * this.cols);
        newFood.y = Math.floor(Math.random() * this.rows);

        valid = !this.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      }

      // 20% chance of golden star bonus
      newFood.isBonus = Math.random() < 0.20;
      this.food = newFood;
    }

    onKeyDown(e) {
      const key = e.key.toLowerCase();
      let newDir = null;

      if (key === 'arrowup' || key === 'w') {
        newDir = { x: 0, y: -1 };
      } else if (key === 'arrowdown' || key === 's') {
        newDir = { x: 0, y: 1 };
      } else if (key === 'arrowleft' || key === 'a') {
        newDir = { x: -1, y: 0 };
      } else if (key === 'arrowright' || key === 'd') {
        newDir = { x: 1, y: 0 };
      }

      if (newDir) {
        // Prevent 180-degree immediate reverse
        if (newDir.x !== -this.direction.x && newDir.y !== -this.direction.y) {
          this.nextDirection = newDir;
        }
        e.preventDefault();
      }
    }

    startGameLoops() {
      // Main 60-second countdown timer
      const timerElem = this.container.querySelector('#snake-timer');
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
          this.endGame(true);
        }
      }, 1000);

      // Snake movement loop
      this.gameLoopInterval = setInterval(() => {
        this.tick();
      }, this.speed);

      // Continuous render loop for smooth particle animations
      this.animFrame = requestAnimationFrame(() => this.drawLoop());
    }

    tick() {
      if (this.isGameOver) return;

      this.direction = this.nextDirection;
      const head = this.snake[0];
      let nextX = head.x + this.direction.x;
      let nextY = head.y + this.direction.y;

      // Zen screen wrap-around (gentle and relaxing!)
      if (nextX < 0) nextX = this.cols - 1;
      if (nextX >= this.cols) nextX = 0;
      if (nextY < 0) nextY = this.rows - 1;
      if (nextY >= this.rows) nextY = 0;

      // Self-collision check
      const selfCollision = this.snake.slice(1).some(seg => seg.x === nextX && seg.y === nextY);
      if (selfCollision) {
        // Trim tail back slightly instead of instant harsh game over to preserve zen state
        if (this.snake.length > 5) {
          this.snake.splice(this.snake.length - 3, 3);
          this.createBurst(head.x * this.gridSize, head.y * this.gridSize, '#f59e0b', 8);
        }
      }

      const newHead = { x: nextX, y: nextY };
      this.snake.unshift(newHead);

      // Food collision
      if (newHead.x === this.food.x && newHead.y === this.food.y) {
        this.sparksEaten++;
        const pts = this.food.isBonus ? 25 : 10;
        this.score += pts;

        // Sound & audio
        if (typeof JigraAudio !== 'undefined') {
          if (this.food.isBonus) {
            JigraAudio.playSuccess();
          } else {
            JigraAudio.playClick();
          }
        }

        // Particle burst
        const px = this.food.x * this.gridSize + this.gridSize / 2;
        const py = this.food.y * this.gridSize + this.gridSize / 2;
        this.createBurst(px, py, this.food.isBonus ? '#fbbf24' : '#f97316', 14);

        // Update score UI
        const sparksElem = this.container.querySelector('#snake-sparks');
        const scoreElem = this.container.querySelector('#snake-score');
        if (sparksElem) sparksElem.textContent = `${this.sparksEaten} ✨`;
        if (scoreElem) scoreElem.textContent = this.score;

        this.spawnFood();
      } else {
        // Normal move: pop tail
        this.snake.pop();
      }
    }

    createBurst(x, y, color, count = 10) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3.5;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.5 + Math.random() * 2.5,
          color,
          alpha: 1,
          decay: 0.03 + Math.random() * 0.03
        });
      }
    }

    drawLoop() {
      if (!this.ctx || !this.canvas) return;

      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Draw subtle grid dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      for (let c = 0; c < this.cols; c++) {
        for (let r = 0; r < this.rows; r++) {
          ctx.beginPath();
          ctx.arc(c * this.gridSize + this.gridSize / 2, r * this.gridSize + this.gridSize / 2, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Food (Focus Spark)
      const fx = this.food.x * this.gridSize + this.gridSize / 2;
      const fy = this.food.y * this.gridSize + this.gridSize / 2;
      const pulse = 1 + Math.sin(Date.now() / 150) * 0.18;

      // Glow halo
      ctx.save();
      ctx.beginPath();
      ctx.arc(fx, fy, (this.gridSize / 2) * pulse * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = this.food.isBonus ? 'rgba(251, 191, 36, 0.35)' : 'rgba(249, 115, 22, 0.30)';
      ctx.fill();

      // Food core
      ctx.beginPath();
      ctx.arc(fx, fy, (this.gridSize / 2.8) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = this.food.isBonus ? '#fbbf24' : '#ea580c';
      ctx.shadowColor = this.food.isBonus ? '#f59e0b' : '#f97316';
      ctx.shadowBlur = 10;
      ctx.fill();

      // Center bright glint
      ctx.beginPath();
      ctx.arc(fx - 1, fy - 1, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // Draw Snake Segments
      const totalSegs = this.snake.length;
      for (let i = totalSegs - 1; i >= 0; i--) {
        const seg = this.snake[i];
        const sx = seg.x * this.gridSize;
        const sy = seg.y * this.gridSize;
        const progress = 1 - i / totalSegs;

        ctx.save();
        if (i === 0) {
          // Flame Head
          ctx.fillStyle = '#ea580c';
          ctx.shadowColor = 'rgba(234, 88, 12, 0.6)';
          ctx.shadowBlur = 12;

          ctx.beginPath();
          ctx.arc(sx + this.gridSize / 2, sy + this.gridSize / 2, this.gridSize / 2, 0, Math.PI * 2);
          ctx.fill();

          // Golden inner head
          ctx.beginPath();
          ctx.arc(sx + this.gridSize / 2, sy + this.gridSize / 2, this.gridSize / 3.2, 0, Math.PI * 2);
          ctx.fillStyle = '#fde047';
          ctx.fill();

          // Cute Eyes looking in direction of motion
          const eyeOffsetDist = 3;
          const eyeX = sx + this.gridSize / 2 + this.direction.x * eyeOffsetDist;
          const eyeY = sy + this.gridSize / 2 + this.direction.y * eyeOffsetDist;

          ctx.fillStyle = '#1e293b';
          if (this.direction.x !== 0) {
            // Horizontal motion
            ctx.beginPath();
            ctx.arc(eyeX, eyeY - 3, 2, 0, Math.PI * 2);
            ctx.arc(eyeX, eyeY + 3, 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Vertical motion
            ctx.beginPath();
            ctx.arc(eyeX - 3, eyeY, 2, 0, Math.PI * 2);
            ctx.arc(eyeX + 3, eyeY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Body segments: smooth gradient from orange to warm gold
          const radius = (this.gridSize / 2.4) * (0.65 + progress * 0.35);
          ctx.fillStyle = progress > 0.5 ? '#f97316' : '#fb923c';
          ctx.shadowColor = 'rgba(249, 115, 22, 0.35)';
          ctx.shadowBlur = 6;

          ctx.beginPath();
          ctx.arc(sx + this.gridSize / 2, sy + this.gridSize / 2, radius, 0, Math.PI * 2);
          ctx.fill();

          // Spark center glow
          ctx.beginPath();
          ctx.arc(sx + this.gridSize / 2, sy + this.gridSize / 2, radius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#fef08a';
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw & update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (!this.isGameOver) {
        this.animFrame = requestAnimationFrame(() => this.drawLoop());
      }
    }

    endGame(isTimeUp = true) {
      if (this.isGameOver) return;
      this.isGameOver = true;

      clearInterval(this.timerInterval);
      clearInterval(this.gameLoopInterval);
      if (this.animFrame) cancelAnimationFrame(this.animFrame);

      // Award bonus sparks based on score (minimum 5 sparks)
      const sparksEarned = Math.max(5, Math.floor(this.score / 20) + 5);

      try {
        if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
          chrome.runtime.sendMessage({
            type: 'AWARD_MINI_GAME_SPARKS',
            payload: { sparks: sparksEarned }
          }).catch(() => {});
        }
      } catch (e) {}

      if (typeof JigraAudio !== 'undefined') {
        JigraAudio.playVictoryJingle();
      }

      const modal = this.container.querySelector('#snake-result');
      const emoji = this.container.querySelector('#result-emoji');
      const heading = this.container.querySelector('#result-heading');
      const desc = this.container.querySelector('#result-message');
      const btnDone = this.container.querySelector('#btn-snake-done');

      if (emoji) emoji.textContent = '🐍';
      if (heading) heading.textContent = 'Zen Flow Complete!';
      if (desc) {
        desc.textContent = `You guided your companion flame through the grid, ate ${this.sparksEaten} focus sparks, and scored ${this.score} points!`;
      }
      if (btnDone) {
        btnDone.textContent = `Back to Focus (+${sparksEarned} ✨)`;
      }

      if (modal) modal.style.display = 'flex';
    }

    destroy() {
      this.isGameOver = true;
      clearInterval(this.timerInterval);
      clearInterval(this.gameLoopInterval);
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
      window.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SparkSnakeGame };
  } else {
    root.SparkSnakeGame = SparkSnakeGame;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
