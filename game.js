/**
 * RENKLİ ÇARK - HTML5 & Canvas Mobil Uyumlu İğne Saplama Oyunu
 */

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // UI Elements
  const hudScore = document.getElementById('hudScore');
  const hudLevel = document.getElementById('hudLevel');
  const hudBest = document.getElementById('hudBest');
  const difficultyBanner = document.getElementById('difficultyBanner');
  const mainOverlay = document.getElementById('mainOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const endStats = document.getElementById('endStats');
  const finalScoreEl = document.getElementById('finalScore');
  const finalLevelEl = document.getElementById('finalLevel');
  const saveScoreForm = document.getElementById('saveScoreForm');
  const playerNameInput = document.getElementById('playerNameInput');
  const scoreboardList = document.getElementById('scoreboardList');
  const btnStartGame = document.getElementById('btnStartGame');
  const btnScoreboard = document.getElementById('btnScoreboard');
  const btnSound = document.getElementById('btnSound');
  const btnClearScores = document.getElementById('btnClearScores');

  // Constants & Palettes (6 distinct vibrant colors per palette for clear color-matching)
  const STORAGE_KEY_SCORES = 'renkli_cark_leaderboard_v1';
  const STORAGE_KEY_LAST_NAME = 'renkli_cark_player_name';

  const WHEEL_PALETTES = [
    ['#FF3366', '#FF9933', '#FFCC00', '#00E676', '#00E5FF', '#9B5DE5'],
    ['#F72585', '#FF9E00', '#FEE440', '#06D6A0', '#00BBF9', '#7209B7'],
    ['#FF595E', '#FF924C', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'],
    ['#EF476F', '#F78C6B', '#FFD166', '#06D6A0', '#118AB2', '#8338EC']
  ];

  // Sound Synthesizer (Web Audio API)
  class SoundFX {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    playTone(freq, type, duration, gainVal = 0.15, slideFreq = null) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideFreq, now + duration);
      }

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    throwPin() {
      this.playTone(320, 'triangle', 0.08, 0.11, 600);
    }

    pinHit(combo = 1) {
      const base = Math.min(260 + combo * 30, 720);
      this.playTone(base, 'sine', 0.11, 0.16, base * 1.3);
    }

    colorMatch(streak = 1) {
      const root = Math.min(440 + streak * 40, 880);
      this.playTone(root, 'triangle', 0.14, 0.2, root * 1.25);
      setTimeout(() => this.playTone(root * 1.5, 'sine', 0.18, 0.22, root * 2), 55);
    }

    starHit() {
      this.playTone(587.33, 'sine', 0.12, 0.2, 880);
      setTimeout(() => this.playTone(880, 'triangle', 0.18, 0.2, 1174.66), 70);
    }

    levelUp() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'triangle', 0.16, 0.18), i * 65);
      });
    }

    collision() {
      this.playTone(160, 'sawtooth', 0.35, 0.24, 55);
    }
  }

  const sfx = new SoundFX();

  // Game State
  let width = 0;
  let height = 0;
  let dpr = 1;

  let gameState = 'MENU'; // MENU | PLAYING | LEVEL_CLEAR | GAME_OVER | PAUSED
  let score = 0;
  let level = 1;
  let combo = 0;
  let colorMatchStreak = 0;
  let lastThrowTime = 0;
  let scoreSavedForRun = false;
  let latestSavedId = null;

  // Geometry
  let wheel = {
    x: 0,
    y: 0,
    radius: 72,
    pinLength: 56,
    pinHeadRadius: 8,
    angle: 0,
    baseSpeed: 0.015,
    currentSpeed: 0.015,
    direction: 1,
    pattern: 'STEADY',
    patternTimer: 0,
    pulseScale: 1,
    palette: WHEEL_PALETTES[0],
    matchedSegmentIdx: -1,
    matchFlashAlpha: 0
  };

  let stuckPins = []; // { angle, color, isObstacle, scale, matched }
  let bonusStars = []; // { angle, hit, pulse }
  let pinQueueColors = []; // Pre-generated colors for remaining pins
  let activePin = null; // { x, y, vy, color }
  let pinsRemaining = 0;
  let totalPinsForLevel = 0;
  let particles = [];
  let floatingTexts = [];
  let shakeTime = 0;
  let shakeIntensity = 0;
  let flashColor = null;
  let flashAlpha = 0;

  // Leaderboard Management
  function getScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveScoreEntry(name, pts, lvl) {
    const list = getScores();
    const entry = {
      id: Date.now(),
      name: (name || 'Oyuncu').trim().slice(0, 16) || 'Oyuncu',
      score: pts,
      level: lvl,
      date: new Date().toLocaleDateString('tr-TR')
    };
    list.push(entry);
    list.sort((a, b) => b.score - a.score || b.level - a.level);
    const trimmed = list.slice(0, 10);
    try {
      localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(trimmed));
      localStorage.setItem(STORAGE_KEY_LAST_NAME, entry.name);
    } catch {
      // ignore storage quota errors
    }
    latestSavedId = entry.id;
    renderScoreboard();
    updateHudBest();
  }

  function updateHudBest() {
    const list = getScores();
    const best = list.length > 0 ? Math.max(list[0].score, score) : score;
    hudBest.textContent = best;
  }

  function renderScoreboard() {
    const list = getScores();
    if (list.length === 0) {
      scoreboardList.innerHTML = `<div class="empty-scores">Henüz kayıtlı skor yok. İlk rekoru sen kır! 🎯</div>`;
      return;
    }

    scoreboardList.innerHTML = list
      .map(
        (item, idx) => `
        <div class="score-row ${item.id === latestSavedId ? 'highlight' : ''}">
          <span class="rank-badge">${idx + 1}</span>
          <span class="player-name">${escapeHtml(item.name)}</span>
          <span class="player-lvl">Sv. ${item.level}</span>
          <span class="player-pts">${item.score} P</span>
        </div>
      `
      )
      .join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  // Responsive Fullscreen Canvas Setup
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width || window.innerWidth;
    height = rect.height || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Calculate vertical safe zones so wheel + pins + launch pad fit any mobile screen
    const topHudBottom = 104;
    const usableHeight = Math.max(320, height - topHudBottom);
    const minDim = Math.min(width, usableHeight * 0.92);

    wheel.radius = Math.max(48, Math.min(78, minDim * 0.165));
    wheel.pinLength = Math.max(40, Math.min(62, minDim * 0.132));
    wheel.pinHeadRadius = Math.max(6.5, Math.min(8.8, minDim * 0.0185));

    wheel.x = width / 2;
    const minWheelY = topHudBottom + wheel.radius + wheel.pinLength + 16;
    const idealWheelY = topHudBottom + usableHeight * 0.34;
    wheel.y = Math.max(minWheelY, idealWheelY);
  }

  window.addEventListener('resize', resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
  }

  // Angle & Color Helpers
  function normalizeAngle(a) {
    const twoPi = Math.PI * 2;
    return ((a % twoPi) + twoPi) % twoPi;
  }

  function angularDistance(a, b) {
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
    return Math.min(diff, Math.PI * 2 - diff);
  }

  function getSegmentIndexAtAngle(relativeAngle) {
    const segments = wheel.palette.length;
    const arcStep = (Math.PI * 2) / segments;
    const norm = normalizeAngle(relativeAngle);
    return Math.floor(norm / arcStep) % segments;
  }

  function getSegmentColorAtAngle(relativeAngle) {
    return wheel.palette[getSegmentIndexAtAngle(relativeAngle)];
  }

  // Balanced & Gradual Progressive Difficulty Configuration
  function configureLevel(lvl) {
    wheel.palette = WHEEL_PALETTES[(lvl - 1) % WHEEL_PALETTES.length];
    wheel.patternTimer = 0;
    wheel.matchedSegmentIdx = -1;
    wheel.matchFlashAlpha = 0;

    // Gentle speed progression: starts at 0.015 and rises slowly (+0.00105 per level, max 0.035)
    const gentleBase = Math.min(0.0145 + (lvl - 1) * 0.00105, 0.035);
    wheel.baseSpeed = gentleBase;

    const isBoss = lvl % 5 === 0;
    let patternName = 'Rahat Dönüş';

    if (lvl <= 2) {
      wheel.pattern = 'STEADY';
      wheel.direction = lvl === 1 ? 1 : -1;
      patternName = lvl === 1 ? 'Rahat Dönüş' : 'Ters Yön • Dengeli';
    } else if (lvl <= 4) {
      wheel.pattern = 'GENTLE_WAVE';
      wheel.direction = lvl % 2 === 1 ? 1 : -1;
      patternName = '🌊 Yumuşak Tempo';
    } else if (isBoss) {
      wheel.pattern = 'BOSS_RHYTHM';
      wheel.direction = 1;
      patternName = '👑 ÖZEL SEVİYE • Renk Avı';
    } else if (lvl % 4 === 0) {
      wheel.pattern = 'BREATHE_PACE';
      wheel.direction = lvl % 8 === 0 ? -1 : 1;
      patternName = '⚡ Yavaşla - Hızlan';
    } else if (lvl % 3 === 0) {
      wheel.pattern = 'SLOW_SWING';
      wheel.direction = 1;
      patternName = '🔄 Yumuşak Salınım';
    } else {
      wheel.pattern = 'GENTLE_WAVE';
      wheel.direction = lvl % 2 === 0 ? 1 : -1;
      patternName = '🌊 Dengeli Akış';
    }

    difficultyBanner.textContent = `Seviye ${lvl} • ${patternName}`;

    // Pre-stuck pins: starts with just 1 pin on Level 1, grows very gradually up to max 6
    stuckPins = [];
    const obstacleCount = lvl === 1 ? 1 : Math.min(1 + Math.floor(lvl / 2.4), 6);
    for (let i = 0; i < obstacleCount; i++) {
      const rawAngle = (Math.PI * 2 * i) / obstacleCount + 0.25;
      const angle = normalizeAngle(rawAngle);
      // Color obstacle pins with the slice color they sit on so players can also color-match with them!
      const sliceCol = getSegmentColorAtAngle(angle);
      stuckPins.push({
        angle,
        color: sliceCol,
        isObstacle: true,
        scale: 1,
        matched: false
      });
    }

    // Bonus stars on wheel circumference (between obstacle pins)
    bonusStars = [];
    const starCount = isBoss ? 3 : lvl >= 2 ? Math.min(1 + Math.floor(lvl / 4), 2) : 1;
    for (let s = 0; s < starCount; s++) {
      const candidateAngle = normalizeAngle(((s + 0.5) * Math.PI * 2) / starCount);
      const tooClose = stuckPins.some((p) => angularDistance(p.angle, candidateAngle) < 0.32);
      if (!tooClose) {
        bonusStars.push({
          angle: candidateAngle,
          hit: false,
          pulse: Math.random() * Math.PI * 2
        });
      }
    }

    // Pins player must throw: starts at 5, grows slowly (~1 extra pin every 2 levels, max 12)
    totalPinsForLevel = Math.min(5 + Math.floor((lvl - 1) * 0.55), 12);
    pinsRemaining = totalPinsForLevel;
    activePin = null;

    // Build queue of pin colors from current palette so every pin has a matching target on the wheel
    pinQueueColors = [];
    for (let i = 0; i < totalPinsForLevel; i++) {
      pinQueueColors.push(wheel.palette[i % wheel.palette.length]);
    }

    hudLevel.textContent = lvl;
  }

  function getCurrentPinColor() {
    const idx = totalPinsForLevel - pinsRemaining;
    return pinQueueColors[idx] || wheel.palette[idx % wheel.palette.length];
  }

  function getLaunchY() {
    const bottomSpace = Math.max(76, height * 0.13);
    const maxLaunchY = height - wheel.pinLength - 34;
    const minLaunchY = wheel.y + wheel.radius + wheel.pinLength + 38;
    return Math.max(minLaunchY, Math.min(height - bottomSpace, maxLaunchY));
  }

  // Action: Throw Pin
  function throwPin() {
    if (gameState !== 'PLAYING') return;
    if (activePin || pinsRemaining <= 0) return;

    activePin = {
      x: wheel.x,
      y: getLaunchY(),
      vy: -Math.max(1150, height * 1.9), // fast, crisp throw
      color: getCurrentPinColor()
    };
    sfx.throwPin();
  }

  // Particle & Floating Text Helpers
  function spawnParticles(x, y, color, count = 18, speedMultiplier = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (60 + Math.random() * 190) * speedMultiplier;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5 + Math.random() * 4,
        color,
        alpha: 1,
        decay: 1.4 + Math.random() * 1.2
      });
    }
  }

  function spawnFloatingText(x, y, text, color = '#ffffff', size = 18) {
    floatingTexts.push({
      x,
      y,
      text,
      color,
      size,
      vy: -62,
      alpha: 1
    });
  }

  function triggerShake(duration = 0.25, intensity = 8) {
    shakeTime = duration;
    shakeIntensity = intensity;
  }

  function triggerFlash(color, alpha = 0.28) {
    flashColor = color;
    flashAlpha = alpha;
  }

  // Update Loop
  function update(dt) {
    // Screen Shake & Flash decay
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - dt * 1.5);
    if (wheel.matchFlashAlpha > 0) wheel.matchFlashAlpha = Math.max(0, wheel.matchFlashAlpha - dt * 1.8);
    wheel.pulseScale += (1 - wheel.pulseScale) * Math.min(1, dt * 14);

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= 1.1 * dt;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }

    if (gameState !== 'PLAYING' && gameState !== 'LEVEL_CLEAR') {
      wheel.angle = normalizeAngle(wheel.angle + 0.65 * dt);
      return;
    }

    // Smooth, Balanced Wheel Rotation Patterns
    wheel.patternTimer += dt;
    const baseRadPerSec = wheel.baseSpeed * 60;

    switch (wheel.pattern) {
      case 'STEADY':
        wheel.currentSpeed = baseRadPerSec * wheel.direction;
        break;
      case 'GENTLE_WAVE': {
        const wave = 0.82 + 0.28 * Math.sin(wheel.patternTimer * 1.6);
        wheel.currentSpeed = baseRadPerSec * wave * wheel.direction;
        break;
      }
      case 'SLOW_SWING': {
        const osc = Math.sin(wheel.patternTimer * 0.95);
        wheel.currentSpeed = baseRadPerSec * 1.05 * osc;
        break;
      }
      case 'BREATHE_PACE': {
        const factor = 0.68 + 0.45 * Math.cos(wheel.patternTimer * 1.8);
        wheel.currentSpeed = baseRadPerSec * factor * wheel.direction;
        break;
      }
      case 'BOSS_RHYTHM': {
        const swing = 0.85 * Math.sin(wheel.patternTimer * 1.25) + 0.35 * Math.cos(wheel.patternTimer * 2.1);
        wheel.currentSpeed = baseRadPerSec * swing;
        break;
      }
    }

    wheel.angle = normalizeAngle(wheel.angle + wheel.currentSpeed * dt);

    // Animate bonus stars
    bonusStars.forEach((s) => {
      s.pulse += dt * 5;
    });

    // Update Active Thrown Pin
    if (activePin && gameState === 'PLAYING') {
      activePin.y += activePin.vy * dt;

      const targetTipY = wheel.y + wheel.radius;
      if (activePin.y <= targetTipY) {
        // Pin reached wheel rim at bottom (angle = PI / 2 in canvas coordinates)
        const hitWorldAngle = Math.PI / 2;
        const relativeAngle = normalizeAngle(hitWorldAngle - wheel.angle);

        // Forgiving collision threshold so close shots feel fair
        const outerRadius = wheel.radius + wheel.pinLength;
        const minSafeAngle = (wheel.pinHeadRadius * 1.72) / outerRadius;

        let collidedPin = null;
        for (const p of stuckPins) {
          if (angularDistance(p.angle, relativeAngle) < minSafeAngle) {
            collidedPin = p;
            break;
          }
        }

        if (collidedPin) {
          handleCollision(collidedPin);
        } else {
          handlePinSuccess(relativeAngle, activePin.color);
        }
      }
    }
  }

  function handlePinSuccess(relativeAngle, color) {
    activePin = null;
    pinsRemaining--;
    wheel.pulseScale = 1.1;

    // Combo calculation (fast consecutive throws increase combo)
    const now = performance.now();
    if (now - lastThrowTime < 1200) {
      combo = Math.min(combo + 1, 8);
    } else {
      combo = 1;
    }
    lastThrowTime = now;

    // Color Match Check:
    // 1. Does the pin color match the wheel segment color where it landed?
    const landedSegmentIdx = getSegmentIndexAtAngle(relativeAngle);
    const landedSegmentColor = wheel.palette[landedSegmentIdx];
    const isSliceMatch = landedSegmentColor.toLowerCase() === color.toLowerCase();

    // 2. Did it land right next to another pin of the same color?
    const isNeighborPinMatch = stuckPins.some(
      (p) => p.color.toLowerCase() === color.toLowerCase() && angularDistance(p.angle, relativeAngle) < 0.42
    );

    const isColorMatched = isSliceMatch || isNeighborPinMatch;

    stuckPins.push({
      angle: relativeAngle,
      color,
      isObstacle: false,
      scale: isColorMatched ? 1.5 : 1.32,
      matched: isColorMatched
    });

    const impactX = wheel.x;
    const impactY = wheel.y + wheel.radius;

    // Check bonus star hit
    let starBonus = 0;
    for (const star of bonusStars) {
      if (!star.hit && angularDistance(star.angle, relativeAngle) < 0.26) {
        star.hit = true;
        starBonus = 25 * level;
        sfx.starHit();
        spawnParticles(impactX, impactY, '#FFCC00', 26, 1.3);
        spawnFloatingText(impactX, impactY - 12, `⭐ +${starBonus}`, '#FFCC00', 19);
      }
    }

    const basePoints = 10 * level + (combo > 1 ? (combo - 1) * 5 : 0);
    let colorBonus = 0;

    if (isColorMatched) {
      colorMatchStreak++;
      const multiplier = isSliceMatch && isNeighborPinMatch ? 2.5 : 2;
      colorBonus = Math.round(basePoints * (multiplier - 1)) + colorMatchStreak * 5 * level;

      wheel.matchedSegmentIdx = landedSegmentIdx;
      wheel.matchFlashAlpha = 1;

      if (starBonus === 0) {
        sfx.colorMatch(colorMatchStreak);
      }
      spawnParticles(impactX, impactY, color, 26, 1.25);
    } else {
      colorMatchStreak = 0;
      if (starBonus === 0) {
        sfx.pinHit(combo);
      }
      spawnParticles(impactX, impactY, color, 14, 0.9);
    }

    const totalEarned = basePoints + colorBonus + starBonus;
    score += totalEarned;
    hudScore.textContent = score;
    updateHudBest();

    if (isSliceMatch && isNeighborPinMatch) {
      spawnFloatingText(impactX, impactY + 28, `🌈 SÜPER RENK UYUMU! +${basePoints + colorBonus}`, color, 20);
    } else if (isColorMatched) {
      const streakTxt = colorMatchStreak > 1 ? ` (Seri x${colorMatchStreak})` : '';
      spawnFloatingText(impactX, impactY + 28, `🎨 RENK UYUMU! x2 +${basePoints + colorBonus}${streakTxt}`, color, 19);
    } else {
      const comboText = combo > 1 ? `🔥 x${combo} (+${basePoints})` : `+${basePoints}`;
      spawnFloatingText(impactX, impactY + 26, comboText, '#ffffff', combo > 1 ? 18 : 16);
    }

    // Check Level Clear
    if (pinsRemaining <= 0) {
      gameState = 'LEVEL_CLEAR';
      const levelBonus = 50 * level;
      score += levelBonus;
      hudScore.textContent = score;
      updateHudBest();

      sfx.levelUp();
      triggerFlash('#00e676', 0.3);
      spawnParticles(wheel.x, wheel.y, '#00e676', 40, 1.5);
      spawnFloatingText(wheel.x, wheel.y, `SEVİYE ${level} TAMAMLANDI! +${levelBonus}`, '#00e676', 21);

      setTimeout(() => {
        if (gameState === 'LEVEL_CLEAR') {
          level++;
          configureLevel(level);
          gameState = 'PLAYING';
        }
      }, 1150);
    }
  }

  function handleCollision(collidedPin) {
    gameState = 'GAME_OVER';
    sfx.collision();
    triggerShake(0.45, 14);
    triggerFlash('#ff1744', 0.45);

    const crashX = wheel.x;
    const crashY = wheel.y + wheel.radius + wheel.pinLength;
    spawnParticles(crashX, crashY, '#ff1744', 36, 1.4);
    spawnFloatingText(crashX, crashY - 20, 'ÇARPIŞMA!', '#ff5252', 24);
    collidedPin.color = '#ff1744';

    setTimeout(() => {
      showGameOverModal();
    }, 650);
  }

  // Rendering
  function draw() {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Apply Screen Shake
    if (shakeTime > 0) {
      const dx = (Math.random() - 0.5) * 2 * shakeIntensity;
      const dy = (Math.random() - 0.5) * 2 * shakeIntensity;
      ctx.translate(dx, dy);
    }

    // Subtle decorative background rings & color-match aim guide
    drawBackgroundDecor();

    // Draw Stuck Pins (behind the wheel rim)
    drawStuckPins();

    // Draw Bonus Stars on Rim
    drawBonusStars();

    // Draw Colorful Segmented Wheel
    drawWheel();

    // Draw Active Moving Pin & Waiting Queue
    drawActiveAndQueuedPins();

    // Draw Particles & Floating Texts
    drawParticlesAndTexts();

    ctx.restore();

    // Full-screen flash overlay on level clear or crash
    if (flashAlpha > 0 && flashColor) {
      ctx.save();
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flashAlpha;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  function drawBackgroundDecor() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1.5;
    const outerOrbit = wheel.radius + wheel.pinLength;
    ctx.beginPath();
    ctx.arc(wheel.x, wheel.y, outerOrbit, 0, Math.PI * 2);
    ctx.stroke();

    // Check if current bottom wheel segment matches the ready pin's color
    const currentReadyColor = getCurrentPinColor();
    const bottomRelativeAngle = normalizeAngle(Math.PI / 2 - wheel.angle);
    const bottomSliceColor = getSegmentColorAtAngle(bottomRelativeAngle);
    const isTargetMatchingNow =
      gameState === 'PLAYING' &&
      pinsRemaining > 0 &&
      currentReadyColor &&
      bottomSliceColor.toLowerCase() === currentReadyColor.toLowerCase();

    // Aim guide line from launch zone to wheel bottom
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = isTargetMatchingNow ? currentReadyColor : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = isTargetMatchingNow ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(wheel.x, wheel.y + wheel.radius + 8);
    ctx.lineTo(wheel.x, getLaunchY() - 14);
    ctx.stroke();

    // Target zone indicator on bottom rim of wheel
    ctx.setLineDash([]);
    const targetY = wheel.y + wheel.radius + 6;
    ctx.fillStyle = isTargetMatchingNow ? currentReadyColor : 'rgba(255, 255, 255, 0.35)';
    if (isTargetMatchingNow) {
      ctx.shadowColor = currentReadyColor;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(wheel.x, targetY - 3);
    ctx.lineTo(wheel.x - 6, targetY + 6);
    ctx.lineTo(wheel.x + 6, targetY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawStuckPins() {
    for (const p of stuckPins) {
      p.scale += (1 - p.scale) * 0.18;
      const worldAngle = wheel.angle + p.angle;
      const cos = Math.cos(worldAngle);
      const sin = Math.sin(worldAngle);

      const innerX = wheel.x + cos * (wheel.radius - 4);
      const innerY = wheel.y + sin * (wheel.radius - 4);
      const outerDist = wheel.radius + wheel.pinLength * p.scale;
      const outerX = wheel.x + cos * outerDist;
      const outerY = wheel.y + sin * outerDist;

      // Pin shaft
      ctx.save();
      ctx.strokeStyle = p.matched ? p.color : p.isObstacle ? 'rgba(225, 232, 238, 0.85)' : '#ffffff';
      ctx.lineWidth = p.matched ? 3.8 : 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();

      // Pin colorful head
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.matched ? 15 : 9;
      ctx.beginPath();
      ctx.arc(outerX, outerY, wheel.pinHeadRadius * p.scale, 0, Math.PI * 2);
      ctx.fill();

      // White ring around matched or obstacle pin head for crisp contrast
      if (p.matched || p.isObstacle) {
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = p.matched ? '#ffffff' : 'rgba(255, 255, 255, 0.65)';
        ctx.stroke();
      }

      // Inner highlight dot
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(outerX - 2, outerY - 2, wheel.pinHeadRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBonusStars() {
    for (const star of bonusStars) {
      if (star.hit) continue;
      const worldAngle = wheel.angle + star.angle;
      const dist = wheel.radius + 17;
      const sx = wheel.x + Math.cos(worldAngle) * dist;
      const sy = wheel.y + Math.sin(worldAngle) * dist;
      const scale = 1 + 0.15 * Math.sin(star.pulse);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(worldAngle + Math.PI / 2);
      ctx.scale(scale, scale);

      // Draw 5-pointed golden star
      ctx.fillStyle = '#FFCC00';
      ctx.shadowColor = '#FFCC00';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const spikes = 5;
      const outerR = 9.5;
      const innerR = 4.5;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWheel() {
    const r = wheel.radius * wheel.pulseScale;
    const segments = wheel.palette.length;
    const arcStep = (Math.PI * 2) / segments;

    ctx.save();
    ctx.translate(wheel.x, wheel.y);
    ctx.rotate(wheel.angle);

    // Outer glow ring
    ctx.shadowColor = 'rgba(0, 229, 255, 0.35)';
    ctx.shadowBlur = 22;

    // Colorful pie segments
    for (let i = 0; i < segments; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, i * arcStep, (i + 1) * arcStep);
      ctx.closePath();
      ctx.fillStyle = wheel.palette[i];
      ctx.fill();

      // Highlight flashed segment on Color Match!
      if (i === wheel.matchedSegmentIdx && wheel.matchFlashAlpha > 0) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = wheel.matchFlashAlpha * 0.55;
        ctx.fill();
        ctx.restore();
      }
    }

    // Crisp rim border
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dark hub
    ctx.fillStyle = '#121533';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.54, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.stroke();

    ctx.restore();

    // Center remaining pins counter (stays upright)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(r * 0.46)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pinsRemaining, wheel.x, wheel.y - 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.font = `700 ${Math.round(r * 0.145)}px system-ui, sans-serif`;
    ctx.fillText('KALAN İĞNE', wheel.x, wheel.y + r * 0.3);
    ctx.restore();
  }

  function drawSinglePinAt(x, tipY, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const headY = tipY + wheel.pinLength;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, tipY);
    ctx.lineTo(x, headY);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, headY, wheel.pinHeadRadius * 1.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  function drawActiveAndQueuedPins() {
    const launchY = getLaunchY();

    // Draw flying pin if any
    if (activePin) {
      drawSinglePinAt(activePin.x, activePin.y, activePin.color, 1);
    }

    // Draw current ready pin at launch pad
    if (!activePin && pinsRemaining > 0 && gameState === 'PLAYING') {
      const nextColor = getCurrentPinColor();
      drawSinglePinAt(wheel.x, launchY, nextColor, 1);
    }

    // Draw queue indicators below
    const queueStartCount = activePin ? pinsRemaining : pinsRemaining - 1;
    const maxVisibleDots = Math.min(queueStartCount, 7);
    const dotStartY = Math.min(height - 18, launchY + wheel.pinLength + 22);

    for (let i = 0; i < maxVisibleDots; i++) {
      const colorIdx = totalPinsForLevel - queueStartCount + i;
      const col = pinQueueColors[colorIdx] || wheel.palette[colorIdx % wheel.palette.length];
      const offsetX = (i - (maxVisibleDots - 1) / 2) * 19;

      ctx.save();
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.88 - i * 0.08;
      ctx.beginPath();
      ctx.arc(wheel.x + offsetX, dotStartY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticlesAndTexts() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `800 ${ft.size}px system-ui, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  // Modal & Flow Controls
  function startNewGame() {
    sfx.init();
    score = 0;
    level = 1;
    combo = 0;
    colorMatchStreak = 0;
    scoreSavedForRun = false;
    latestSavedId = null;

    hudScore.textContent = '0';
    updateHudBest();
    configureLevel(1);

    mainOverlay.classList.add('hidden');
    gameState = 'PLAYING';
  }

  function showGameOverModal() {
    modalTitle.textContent = 'OYUN BİTTİ!';
    modalSubtitle.textContent =
      score > 0
        ? 'Harika atışlardı! Skorunu tabloya kaydedebilir veya hemen yeni oyuna başlayabilirsin.'
        : 'İğneler birbirine çarptı! Kendi rengindeki dilimleri hedefleyerek tekrar dene.';

    endStats.style.display = 'grid';
    finalScoreEl.textContent = score;
    finalLevelEl.textContent = level;

    if (score > 0 && !scoreSavedForRun) {
      saveScoreForm.style.display = 'flex';
      const savedName = localStorage.getItem(STORAGE_KEY_LAST_NAME) || '';
      playerNameInput.value = savedName;
    } else {
      saveScoreForm.style.display = 'none';
    }

    btnStartGame.textContent = '🔄 TEKRAR OYNA';
    renderScoreboard();
    mainOverlay.classList.remove('hidden');
  }

  function openScoreboardModal() {
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      modalTitle.textContent = 'OYUN DURAKLATILDI';
      modalSubtitle.textContent = 'Skor tablosuna göz atıyorsun. Kaldığın yerden devam edebilirsin.';
      endStats.style.display = 'none';
      saveScoreForm.style.display = 'none';
      btnStartGame.textContent = '▶ DEVAM ET';
      renderScoreboard();
      mainOverlay.classList.remove('hidden');
    } else {
      renderScoreboard();
      mainOverlay.classList.remove('hidden');
    }
  }

  // Event Listeners (Touch, Pointer, Keyboard)
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      throwPin();
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
      if (document.activeElement === playerNameInput) return;
      if (gameState === 'PLAYING') {
        e.preventDefault();
        throwPin();
      } else if (!mainOverlay.classList.contains('hidden') && e.code === 'Enter') {
        e.preventDefault();
        btnStartGame.click();
      }
    }
  });

  btnStartGame.addEventListener('click', () => {
    if (gameState === 'PAUSED') {
      mainOverlay.classList.add('hidden');
      gameState = 'PLAYING';
    } else {
      startNewGame();
    }
  });

  btnScoreboard.addEventListener('click', (e) => {
    e.stopPropagation();
    openScoreboardModal();
  });

  btnSound.addEventListener('click', (e) => {
    e.stopPropagation();
    const on = sfx.toggle();
    btnSound.textContent = on ? '🔊' : '🔇';
  });

  saveScoreForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (scoreSavedForRun) return;
    scoreSavedForRun = true;
    saveScoreEntry(playerNameInput.value, score, level);
    saveScoreForm.style.display = 'none';
  });

  btnClearScores.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY_SCORES);
    latestSavedId = null;
    renderScoreboard();
    updateHudBest();
  });

  // Main Animation Loop
  let lastFrameTime = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Initialize
  resizeCanvas();
  configureLevel(1);
  renderScoreboard();
  updateHudBest();
  requestAnimationFrame(loop);
})();
