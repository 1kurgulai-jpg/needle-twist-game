/**
 * RENKLİ ÇARK - HTML5 & Canvas Mobil Uyumlu İğne Saplama Oyunu
 * Google Analytics (GA4), Benzersiz Küresel Skor Tablosu & Zaman Bonusu Mekaniği
 */

(() => {
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  try {
    if (isAndroid && document.documentElement) {
      document.documentElement.classList.add('is-android');
    }
  } catch (err) {}

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const gameContainer = document.getElementById('game-container');

  // UI Elements
  const hudScore = document.getElementById('hudScore');
  const hudLevel = document.getElementById('hudLevel');
  const hudLives = document.getElementById('hudLives');
  const hudBest = document.getElementById('hudBest');
  const difficultyBanner = document.getElementById('difficultyBanner');
  const timerBarWrap = document.getElementById('timerBarWrap');
  const timerLabel = document.getElementById('timerLabel');
  const timerValue = document.getElementById('timerValue');
  const timerFill = document.getElementById('timerFill');
  const mainOverlay = document.getElementById('mainOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const endStats = document.getElementById('endStats');
  const finalScoreEl = document.getElementById('finalScore');
  const finalLevelEl = document.getElementById('finalLevel');
  const saveScoreForm = document.getElementById('saveScoreForm');
  const playerNameInput = document.getElementById('playerNameInput');
  const btnSubmitScore = document.getElementById('btnSubmitScore');
  const saveFeedback = document.getElementById('saveFeedback');
  const syncBadge = document.getElementById('syncBadge');
  const scoreboardList = document.getElementById('scoreboardList');
  const btnStartGame = document.getElementById('btnStartGame');
  const btnScoreboard = document.getElementById('btnScoreboard');
  const btnSound = document.getElementById('btnSound');
  const btnRefreshScores = document.getElementById('btnRefreshScores');

  // Storage & Cloud Leaderboard Endpoints (Süresiz Kalıcı Bulut Veritabanı & Cihaz Başına Tek Kullanıcı/Rekor)
  const STORAGE_KEY_SCORES = 'renkli_cark_leaderboard_v3_clean';
  const STORAGE_KEY_LOCKED_NAME = 'renkli_cark_locked_name_v3_clean';
  const STORAGE_KEY_DEVICE_ID = 'renkli_cark_device_id_v3';
  const FIREBASE_DB_URL = window.FIREBASE_DB_URL || '';
  const PERMANENT_KV_URL = 'https://kvdb.io/JnxQcbRfQWQRLWus8FQzLb/leaderboard_v3_permanent';
  const CLOUD_LEADERBOARD_TOPIC = 'needle_twist_leaderboard_1kurgulai_v3_clean';
  const CLOUD_LEADERBOARD_URL = `https://ntfy.sh/${CLOUD_LEADERBOARD_TOPIC}`;

  function safeLower(str) {
    const s = String(str || '').trim();
    try {
      return s.toLocaleLowerCase('tr-TR');
    } catch (err) {
      return s.toLowerCase();
    }
  }

  // Başlangıçta sahte/seed skor yok; ancak cihazda dün/bugün oynanmış gerçek oyuncu kaydı varsa koru
  const SEED_GLOBAL_SCORES = [];
  const LEGACY_SEED_NAMES = new Set(['turkuazusta', 'carkavcisi', 'renkkeskin', 'neonrefleks', 'ignebeyi']);
  try {
    const rawV2 = localStorage.getItem('renkli_cark_leaderboard_v2');
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2);
      if (Array.isArray(parsedV2)) {
        const realV2 = parsedV2.filter(
          (item) =>
            item &&
            item.name &&
            !String(item.id || '').startsWith('seed-') &&
            !LEGACY_SEED_NAMES.has(safeLower(item.name))
        );
        if (realV2.length > 0) {
          const existingV3 = JSON.parse(localStorage.getItem(STORAGE_KEY_SCORES) || '[]');
          localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify([...existingV3, ...realV2]));
        }
      }
    }
    localStorage.removeItem('renkli_cark_leaderboard_v1');
    localStorage.removeItem('renkli_cark_leaderboard_v2');
  } catch (err) {
    // ignore storage errors on restricted mobile browsers
  }

  // Google Analytics (GA4) Yardımcı Fonksiyonu
  function trackAnalyticsEvent(eventName, params = {}) {
    try {
      if (typeof window.gtag === 'function') {
        const payload = Object.assign({}, params, {
          game_name: 'needle_twist_game',
          timestamp: new Date().toISOString()
        });
        window.gtag('event', eventName, payload);
      }
    } catch (err) {
      // Ad-blocker veya çevrimdışı durumda sessizce devam et
    }
  }

  // Her 10 Seviyede Bir Değişen Dinamik Neon Temalar (1-10, 11-20, 21-30, 31-40, 41-50...)
  const CHAPTER_THEMES = [
    {
      name: 'Siber Turkuaz',
      bgDark: '#071324',
      bgAccent: '#0d2b45',
      accentColor: '#00f5d4',
      hubColor: '#0b1830',
      palette: ['#00F5D4', '#00BBF9', '#FF3366', '#FFCC00', '#9B5DE5', '#FF9933']
    },
    {
      name: 'Kozmik Macenta',
      bgDark: '#140826',
      bgAccent: '#2b124c',
      accentColor: '#f72585',
      hubColor: '#1b0b33',
      palette: ['#F72585', '#4CC9F0', '#FEE440', '#06D6A0', '#9B5DE5', '#FF9E00']
    },
    {
      name: 'Zümrüt Aurora',
      bgDark: '#061f1e',
      bgAccent: '#0d3b38',
      accentColor: '#06d6a0',
      hubColor: '#082927',
      palette: ['#06D6A0', '#FFD166', '#EF476F', '#118AB2', '#8338EC', '#FF9F1C']
    },
    {
      name: 'Güneş Fırtınası',
      bgDark: '#1b0c1a',
      bgAccent: '#38152e',
      accentColor: '#ff9e00',
      hubColor: '#240f22',
      palette: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#9B5DE5', '#FF924C']
    },
    {
      name: 'Elektrik İndigo',
      bgDark: '#090d26',
      bgAccent: '#182052',
      accentColor: '#4cc9f0',
      hubColor: '#0e1538',
      palette: ['#4CC9F0', '#F72585', '#FFBE0B', '#3A86FF', '#00F5D4', '#FF595E']
    }
  ];

  // Mobil Titreşim (Haptic Feedback) & Web Audio API Ses Sentezleyici (Tam Hata Korumalı Fallback)
  class SoundFX {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
          const resumePromise = this.ctx.resume();
          if (resumePromise && typeof resumePromise.catch === 'function') {
            resumePromise.catch(() => {});
          }
        }
      } catch (err) {
        // Ses motoru başlatılamazsa oyunu kilitlemeden sessizce devam et
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    vibrate(pattern) {
      if (!this.enabled) return;
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(pattern);
        }
      } catch (err) {
        // Desteklemeyen tarayıcılarda sessizce devam et
      }
    }

    playTone(freq, type, duration, gainVal = 0.15, slideFreq = null) {
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;

        const now = Math.max(0, this.ctx.currentTime || 0);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, freq), now);
        if (slideFreq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideFreq), now + duration);
        }

        gain.gain.setValueAtTime(Math.max(0.001, gainVal), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      } catch (err) {
        // Mobil tarayıcı ses kısıtlamalarında oyunun çökmesini önle
      }
    }

    throwPin() {
      // Hafif, temiz fırlatma "whoosh" sesi
      this.playTone(250, 'sine', 0.045, 0.065, 460);
    }

    // Tok, tatmin edici ve kulak yormayan "tık / saplanma" sesi + hafif mobil titreşim
    pinHit(combo = 1) {
      this.vibrate(14);
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;

        const now = Math.max(0, this.ctx.currentTime || 0);

        // 1. Katman: Tok gövde darbesi (195Hz -> 56Hz hızlı pitch düşüşü, 52ms)
        const bodyOsc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(195, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(56, now + 0.052);
        bodyGain.gain.setValueAtTime(0.24, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.052);
        bodyOsc.connect(bodyGain);
        bodyGain.connect(this.ctx.destination);
        bodyOsc.start(now);
        bodyOsc.stop(now + 0.052);

        // 2. Katman: Net mekanik saplanma "tık" transienti (680Hz -> 210Hz, 22ms)
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.type = 'sine';
        clickOsc.frequency.setValueAtTime(680, now);
        clickOsc.frequency.exponentialRampToValueAtTime(210, now + 0.022);
        clickGain.gain.setValueAtTime(0.14, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
        clickOsc.connect(clickGain);
        clickGain.connect(this.ctx.destination);
        clickOsc.start(now);
        clickOsc.stop(now + 0.022);

        // 3. Katman: Göz/kulak yormayan yumuşak kombo rezonansı
        const harmonicFreq = Math.min(310 + combo * 20, 540);
        this.playTone(harmonicFreq, 'sine', 0.048, 0.06, harmonicFreq * 1.12);
      } catch (err) {
        // Ses sentezleme hatasında oyunu kesintisiz sürdür
      }
    }

    colorMatch(streak = 1) {
      // Önce tok saplanma hissini ver, ardından yumuşak uyum akorunu çal
      this.pinHit(streak);
      this.vibrate([16, 28, 22]);
      const root = Math.min(392 + streak * 32, 740);
      setTimeout(() => this.playTone(root, 'triangle', 0.09, 0.12, root * 1.2), 18);
      setTimeout(() => this.playTone(root * 1.25, 'sine', 0.12, 0.13, root * 1.5), 55);
    }

    starHit() {
      this.pinHit(2);
      this.vibrate([18, 25, 25]);
      this.playTone(587.33, 'sine', 0.1, 0.14, 880);
      setTimeout(() => this.playTone(880, 'triangle', 0.14, 0.14, 1174.66), 60);
    }

    levelUp() {
      this.vibrate([22, 35, 30]);
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'triangle', 0.14, 0.14), i * 58);
      });
    }

    lifeUp() {
      this.vibrate([30, 40, 45, 40, 60]);
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'sine', 0.16, 0.17), i * 55);
      });
    }

    lifeSaved() {
      this.vibrate([45, 35, 45]);
      this.playTone(220, 'triangle', 0.12, 0.2, 140);
      setTimeout(() => this.playTone(440, 'sine', 0.18, 0.18, 587.33), 75);
    }

    timeoutPenalty() {
      this.vibrate([35, 30, 35]);
      this.playTone(250, 'sawtooth', 0.11, 0.15, 170);
      setTimeout(() => this.playTone(165, 'sawtooth', 0.16, 0.16, 105), 80);
    }

    collision() {
      this.vibrate([70, 40, 90]);
      this.playTone(160, 'sawtooth', 0.32, 0.22, 55);
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
  let lives = 1; // Başlangıçta 1 Can hakkı (ve her 10 seviyede +1 Can ödülü)
  let currentTheme = CHAPTER_THEMES[0];
  let combo = 0;
  let colorMatchStreak = 0;
  let lastThrowTime = 0;
  let scoreSavedForRun = false;
  let latestSavedKey = null;
  let cachedCloudScores = [];

  // Per-Pin Shot Clock State (İğne Başına Süre Sınırı: ~8.5 - 14.5 saniye, çark hızına duyarlı)
  let pinTimeLimit = 12.2;
  let pinTimeLeft = 12.2;
  let thrownPinTimeLeft = 12.2;

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
    steps: [],
    stepIndex: 0,
    stepTraveled: 0,
    pauseTimer: 0,
    pulseScale: 1,
    palette: CHAPTER_THEMES[0].palette,
    hubColor: CHAPTER_THEMES[0].hubColor,
    glowColor: CHAPTER_THEMES[0].accentColor,
    matchedSegmentIdx: -1,
    matchFlashAlpha: 0
  };

  let stuckPins = []; // { angle, color, isObstacle, scale, matched }
  let bonusStars = []; // { angle, hit, pulse }
  let pinQueueColors = [];
  let activePin = null; // { x, y, vy, color }
  let pinsRemaining = 0;
  let totalPinsForLevel = 0;
  let particles = [];
  let floatingTexts = [];
  let shakeTime = 0;
  let shakeIntensity = 0;
  let flashColor = null;
  let flashAlpha = 0;

  // Benzersiz Kullanıcı Adı (Nickname) Normalizasyonu & Cihaz Başına Tek Kullanıcı Kilidi
  function normalizePlayerKey(name) {
    return safeLower(String(name || 'Oyuncu').trim().slice(0, 16)) || 'oyuncu';
  }

  function safeAllSettled(promises) {
    if (typeof Promise.allSettled === 'function') {
      return Promise.allSettled(promises);
    }
    return Promise.all(
      promises.map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => ({ status: 'rejected', reason })
        )
      )
    );
  }

  function getDeviceId() {
    try {
      let devId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
      if (!devId) {
        devId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(STORAGE_KEY_DEVICE_ID, devId);
      }
      return devId;
    } catch (err) {
      return 'dev_local_fallback';
    }
  }

  function getLockedDeviceName() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOCKED_NAME);
      if (saved && saved.trim()) return saved.trim().slice(0, 16);
      const legacyName = localStorage.getItem('renkli_cark_player_name');
      if (legacyName && legacyName.trim()) {
        const cleanLegacy = legacyName.trim().slice(0, 16);
        localStorage.setItem(STORAGE_KEY_LOCKED_NAME, cleanLegacy);
        return cleanLegacy;
      }
      return '';
    } catch (err) {
      return '';
    }
  }

  function setLockedDeviceName(name) {
    const clean = String(name || '')
      .trim()
      .slice(0, 16);
    if (!clean) return;
    try {
      localStorage.setItem(STORAGE_KEY_LOCKED_NAME, clean);
    } catch (err) {
      // ignore storage errors
    }
  }

  // Küresel & Yerel Skor Tablosu Yönetimi (Cihaz Başına Tek Kullanıcı & En Yüksek Rekor Mantığı)
  function getLocalScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SCORES);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function setLocalScores(list) {
    try {
      if (Array.isArray(list)) {
        localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(list.slice(0, 30)));
      }
    } catch (err) {
      // ignore quota errors
    }
  }

  function deduplicateByPlayerBest(...scoreArrays) {
    const myDeviceId = getDeviceId();
    const myLockedName = getLockedDeviceName();
    const extraFlat = [];
    for (let i = 0; i < scoreArrays.length; i++) {
      const arr = scoreArrays[i];
      if (Array.isArray(arr)) {
        for (let j = 0; j < arr.length; j++) {
          extraFlat.push(arr[j]);
        }
      } else if (arr) {
        extraFlat.push(arr);
      }
    }
    const combined = [...SEED_GLOBAL_SCORES, ...cachedCloudScores, ...getLocalScores(), ...extraFlat];

    // 1. Aşama: Aynı cihazdan (deviceId) gelen tüm skorları tek bir kayıtta birleştir (en yüksek skoru tut)
    const uniqueByDevice = new Map();
    const withoutDevice = [];

    for (const item of combined) {
      if (!item || typeof item.score !== 'number' || !item.name) continue;
      const devId = item.deviceId ? String(item.deviceId).trim() : '';
      // Bu cihaza ait kayıtsa her zaman cihazın kilitli tek kullanıcı adını kullan
      const effectiveName =
        devId && devId === myDeviceId && myLockedName
          ? myLockedName
          : String(item.name).trim().slice(0, 16) || 'Oyuncu';
      const playerKey = normalizePlayerKey(effectiveName);
      const itemScore = Number(item.score) || 0;
      const itemLevel = Number(item.level) || 1;

      const normalizedItem = {
        id: item.id || devId || playerKey,
        deviceId: devId,
        playerKey,
        name: effectiveName,
        score: itemScore,
        level: itemLevel,
        date: item.date || ''
      };

      if (devId) {
        const prevDev = uniqueByDevice.get(devId);
        if (!prevDev || itemScore > prevDev.score || (itemScore === prevDev.score && itemLevel > prevDev.level)) {
          uniqueByDevice.set(devId, normalizedItem);
        }
      } else {
        withoutDevice.push(normalizedItem);
      }
    }

    // 2. Aşama: Aynı kullanıcı adına (playerKey) sahip kayıtları da tekilleştir (en yüksek skoru tut)
    const stage1Combined = [];
    uniqueByDevice.forEach((val) => stage1Combined.push(val));
    for (let i = 0; i < withoutDevice.length; i++) {
      stage1Combined.push(withoutDevice[i]);
    }

    const uniqueByNickname = new Map();
    for (let i = 0; i < stage1Combined.length; i++) {
      const item = stage1Combined[i];
      const existing = uniqueByNickname.get(item.playerKey);
      if (!existing || item.score > existing.score || (item.score === existing.score && item.level > existing.level)) {
        uniqueByNickname.set(item.playerKey, item);
      }
    }

    const finalResult = [];
    uniqueByNickname.forEach((val) => finalResult.push(val));
    return finalResult.sort((a, b) => b.score - a.score || b.level - a.level);
  }

  function mergeAndSortTop10(...scoreArrays) {
    return deduplicateByPlayerBest(...scoreArrays).slice(0, 10);
  }

  function safeFetch(url, options) {
    try {
      if (typeof window.fetch !== 'function') {
        return Promise.reject(new Error('fetch_unsupported'));
      }
      return window.fetch(url, options);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function syncPermanentCloudLeaderboard(mergedList, singleEntry = null) {
    const cleanPayload = {
      updatedAt: new Date().toISOString(),
      scores: mergedList.slice(0, 30)
    };

    const tasks = [];

    // 1. Süresiz Kalıcı KVDB Veritabanına Tam Tabloyu Kaydet (12 saat sınırı YOKTUR)
    tasks.push(
      safeFetch(PERMANENT_KV_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(cleanPayload)
      })
    );

    // 2. Canlı Akış Sunucusuna (ntfy) hem tekil skoru hem de tam tablo yedeğini (snapshot) gönder
    const snapshotObj = singleEntry
      ? Object.assign({}, singleEntry, { type: 'snapshot', scores: mergedList.slice(0, 20) })
      : { type: 'snapshot', scores: mergedList.slice(0, 20) };

    tasks.push(
      safeFetch(CLOUD_LEADERBOARD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify(snapshotObj)
      })
    );

    if (FIREBASE_DB_URL && singleEntry) {
      tasks.push(
        safeFetch(FIREBASE_DB_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(singleEntry)
        })
      );
    }

    return safeAllSettled(tasks);
  }

  function fetchGlobalScores() {
    if (syncBadge) {
      syncBadge.textContent = '⏳ Senkronize...';
    }

    let permanentScores = [];
    let streamScores = [];
    let fetchedAnyCloud = false;

    return safeAllSettled([
      safeFetch(PERMANENT_KV_URL, { cache: 'no-store' }),
      safeFetch(`${CLOUD_LEADERBOARD_URL}/json?poll=1&since=all`, { cache: 'no-store' })
    ])
      .then((results) => {
        const kvRes = results[0];
        const ntfyRes = results[1];

        const p1 =
          kvRes && kvRes.status === 'fulfilled' && kvRes.value && kvRes.value.ok
            ? kvRes.value
                .json()
                .then((kvData) => {
                  fetchedAnyCloud = true;
                  if (kvData && Array.isArray(kvData.scores)) {
                    permanentScores = kvData.scores;
                  } else if (Array.isArray(kvData)) {
                    permanentScores = kvData;
                  }
                })
                .catch(() => {})
            : Promise.resolve();

        const p2 =
          ntfyRes && ntfyRes.status === 'fulfilled' && ntfyRes.value && ntfyRes.value.ok
            ? ntfyRes.value
                .text()
                .then((text) => {
                  fetchedAnyCloud = true;
                  const lines = String(text || '')
                    .split('\n')
                    .filter((l) => l.trim().length > 0);
                  for (let i = 0; i < lines.length; i++) {
                    try {
                      const envelope = JSON.parse(lines[i]);
                      if (envelope && envelope.event === 'message' && envelope.message) {
                        const msgObj = JSON.parse(envelope.message);
                        if (msgObj && Array.isArray(msgObj.scores)) {
                          for (let j = 0; j < msgObj.scores.length; j++) {
                            streamScores.push(msgObj.scores[j]);
                          }
                        }
                        if (msgObj && typeof msgObj.score === 'number' && msgObj.name) {
                          streamScores.push(msgObj);
                        }
                      }
                    } catch (err) {
                      // skip malformed line
                    }
                  }
                })
                .catch(() => {})
            : Promise.resolve();

        return safeAllSettled([p1, p2]);
      })
      .then(() => {
        if (fetchedAnyCloud) {
          cachedCloudScores = permanentScores.concat(streamScores);

          // Tüm kaynakları (Kalıcı Bulut + Canlı Akış + Bu Cihazın Yerel Hafızası) birleştir
          const mergedAll = deduplicateByPlayerBest();
          setLocalScores(mergedAll);
          cachedCloudScores = mergedAll;

          // Eğer bu cihazın yerel hafızasında olup kalıcı bulutta eksik/düşük kalan bir rekor varsa otomatik geri yükle!
          const permanentMap = new Map();
          for (let i = 0; i < permanentScores.length; i++) {
            const p = permanentScores[i];
            if (p && p.name && typeof p.score === 'number') {
              permanentMap.set(normalizePlayerKey(p.name), Number(p.score) || 0);
            }
          }

          const needsCloudRestore = mergedAll.some((item) => {
            const cloudScore = permanentMap.get(item.playerKey);
            return cloudScore === undefined || item.score > cloudScore;
          });

          if (needsCloudRestore && mergedAll.length > 0) {
            syncPermanentCloudLeaderboard(mergedAll).catch(() => {});
          }

          if (syncBadge) {
            syncBadge.textContent = '🌐 Kalıcı Küresel';
          }
        } else {
          if (syncBadge) {
            syncBadge.textContent = '📱 Çevrimdışı Önbellek';
          }
        }
      })
      .catch(() => {
        if (syncBadge) {
          syncBadge.textContent = '📱 Çevrimdışı Önbellek';
        }
      })
      .then(() => {
        renderScoreboard();
        updateHudBest();
      });
  }

  function saveScoreEntry(name, pts, lvl) {
    const deviceId = getDeviceId();
    const existingLockedName = getLockedDeviceName();
    // Cihazda daha önce kaydedilmiş bir kullanıcı adı varsa her zaman o tek ismi kullan
    const cleanName = existingLockedName || (name || 'Oyuncu').trim().slice(0, 16) || 'Oyuncu';
    setLockedDeviceName(cleanName);

    const playerKey = normalizePlayerKey(cleanName);
    const newScore = Number(pts) || 0;
    const newLevel = Number(lvl) || 1;

    latestSavedKey = playerKey;

    // Mevcut tüm kayıtlar içinde bu cihazın (deviceId) veya bu kullanıcı adının (playerKey) rekoru var mı kontrol et
    const allKnown = deduplicateByPlayerBest();
    const existingRecord = allKnown.find(
      (item) => (item.deviceId && item.deviceId === deviceId) || item.playerKey === playerKey
    );

    // Eğer oyuncunun önceki rekoru yeni skorundan daha yüksek veya eşitse eski rekoru koru, düşük skoru yansıtma
    if (existingRecord && newScore <= existingRecord.score) {
      renderScoreboard();
      updateHudBest();

      if (saveFeedback) {
        saveFeedback.style.display = 'block';
        saveFeedback.textContent =
          newScore === existingRecord.score
            ? `ℹ️ "${existingRecord.name}" rekorun zaten ${existingRecord.score} P! Mevcut rekorun korundu.`
            : `ℹ️ Cihaz kullanıcısı "${existingRecord.name}" için en yüksek rekorun (${existingRecord.score} P) korundu; düşük skor (${newScore} P) tabloya yansıtılmadı.`;
      }

      trackAnalyticsEvent('leaderboard_submit_kept_best', {
        player_name: cleanName,
        device_id: deviceId,
        new_score: newScore,
        kept_best_score: existingRecord.score,
        level: newLevel
      });
      return Promise.resolve();
    }

    const entry = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      deviceId,
      playerKey,
      name: cleanName,
      score: newScore,
      level: newLevel,
      date: new Date().toLocaleDateString('tr-TR')
    };

    // 1. Yerel ve önbellek listelerinde aynı cihaza veya aynı isme ait eski kaydı kaldırıp yalnızca yeni en yüksek rekoru tut
    const mergedList = deduplicateByPlayerBest([entry]);
    setLocalScores(mergedList);
    cachedCloudScores = mergedList;

    renderScoreboard();
    updateHudBest();

    // GA4 Etkinliği Gönder
    trackAnalyticsEvent('leaderboard_submit', {
      player_name: cleanName,
      device_id: deviceId,
      score: entry.score,
      previous_best: existingRecord ? existingRecord.score : 0,
      level: entry.level
    });

    // 2. Kalıcı Küresel Bulut Veritabanına Gönder (12 saat sınırı olmadan kalıcı saklanır)
    if (syncBadge) {
      syncBadge.textContent = '⏳ Gönderiliyor...';
    }
    return syncPermanentCloudLeaderboard(mergedList, entry)
      .then(() => {
        if (syncBadge) {
          syncBadge.textContent = '🌐 Kalıcı Küresel';
        }
      })
      .catch(() => {
        if (syncBadge) {
          syncBadge.textContent = '📱 Yerel Kaydedildi';
        }
      })
      .then(() => {
        if (saveFeedback) {
          saveFeedback.style.display = 'block';
          saveFeedback.textContent = existingRecord
            ? `🏆 Yeni Kişisel Rekor! "${cleanName}" satırı ${existingRecord.score} P ➔ ${entry.score} P olarak kalıcı güncellendi!`
            : `✅ Cihaz kullanıcısı "${cleanName}" (${entry.score} P) kalıcı tabloya kaydedildi!`;
        }
        renderScoreboard();
      });
  }

  function updateHudBest() {
    try {
      const top10 = mergeAndSortTop10();
      const best = top10.length > 0 ? Math.max(top10[0].score, score) : score;
      if (hudBest) hudBest.textContent = best;
    } catch (err) {
      if (hudBest) hudBest.textContent = score;
    }
  }

  function updateHudLives() {
    if (hudLives) {
      hudLives.textContent = `❤️ ${lives}`;
    }
  }

  // Her 10 Seviyede Bir Arka Plan & Çark Renk Temasını Canlı Neon Paletine Geçir
  function applyThemeForLevel(lvl) {
    const chapterIndex = Math.floor((Math.max(1, lvl) - 1) / 10) % CHAPTER_THEMES.length;
    const theme = CHAPTER_THEMES[chapterIndex] || CHAPTER_THEMES[0];
    currentTheme = theme;

    wheel.palette = theme.palette;
    wheel.hubColor = theme.hubColor;
    wheel.glowColor = theme.accentColor;

    try {
      const rootStyle = document.documentElement && document.documentElement.style;
      if (rootStyle && typeof rootStyle.setProperty === 'function') {
        rootStyle.setProperty('--bg-dark', theme.bgDark);
        rootStyle.setProperty('--bg-accent', theme.bgAccent);
        rootStyle.setProperty('--turquoise', theme.accentColor);
      }
      if (document.body && document.body.style) {
        document.body.style.backgroundColor = theme.bgDark;
      }
      if (gameContainer && gameContainer.style) {
        gameContainer.style.backgroundColor = theme.bgDark;
      }
    } catch (err) {
      // CSS değişkeni desteklemeyen eski tarayıcılarda çökmeden devam et
    }
    return theme;
  }

  function getRankDisplay(idx) {
    if (idx === 0) return '🥇';
    if (idx === 1) return '🥈';
    if (idx === 2) return '🥉';
    return String(idx + 1);
  }

  function renderScoreboard() {
    const list = mergeAndSortTop10();
    if (list.length === 0) {
      scoreboardList.innerHTML = `<div class="empty-scores">Tablo sıfırlandı! Yeni dönemin ilk rekorunu sen kır! 🎯</div>`;
      return;
    }

    const myDeviceId = getDeviceId();
    const myLockedName = getLockedDeviceName();
    const myPlayerKey = myLockedName ? normalizePlayerKey(myLockedName) : latestSavedKey;

    scoreboardList.innerHTML = list
      .map((item, idx) => {
        const isMyRow =
          (item.deviceId && item.deviceId === myDeviceId) || (myPlayerKey && item.playerKey === myPlayerKey);
        return `
        <div class="score-row ${isMyRow ? 'highlight' : ''}">
          <span class="rank-badge">${getRankDisplay(idx)}</span>
          <span class="player-name">${escapeHtml(item.name)}</span>
          <span class="player-lvl">Sv. ${item.level}</span>
          <span class="player-pts">${item.score} P</span>
        </div>
      `;
      })
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

  // İğne Başına Süre & Hız Bonusu Hesaplama ve Görsel Güncelleme
  function calculatePinSpeedBonus(remainingSec = pinTimeLeft) {
    if (remainingSec <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, remainingSec / Math.max(0.1, pinTimeLimit)));
    return Math.max(2, Math.round(ratio * (8 + level * 2.5)));
  }

  function getTimerColor(ratio) {
    if (ratio > 0.5) return '#00f5d4';
    if (ratio > 0.25) return '#ffcc00';
    return '#ff3366';
  }

  let lastTimerText = '';
  let lastTimerTier = '';
  let lastPulseLow = false;

  function resetPinTimer() {
    pinTimeLeft = pinTimeLimit;
    thrownPinTimeLeft = pinTimeLimit;
    if (timerBarWrap && lastPulseLow) {
      timerBarWrap.classList.remove('pulse-low');
      lastPulseLow = false;
    }
    updateTimerUI(true);
  }

  function updateTimerUI(force = false) {
    if (!timerFill || !timerValue) return;
    const ratio = Math.max(0, Math.min(1, pinTimeLeft / Math.max(0.1, pinTimeLimit)));

    // GPU birleştirici (compositor) üzerinden sıfır DOM Reflow ile bar genişliği güncellemesi
    timerFill.style.transform = `scaleX(${ratio.toFixed(3)}) translateZ(0)`;

    const tier = ratio > 0.5 ? 'high' : ratio > 0.25 ? 'mid' : 'low';
    if (force || tier !== lastTimerTier) {
      lastTimerTier = tier;
      if (tier === 'high') {
        timerFill.style.background = 'linear-gradient(90deg, #00f5d4, #00e5ff)';
        timerValue.style.color = '#00f5d4';
      } else if (tier === 'mid') {
        timerFill.style.background = 'linear-gradient(90deg, #ffcc00, #ff9933)';
        timerValue.style.color = '#ffcc00';
      } else {
        timerFill.style.background = 'linear-gradient(90deg, #ff3366, #ff6b35)';
        timerValue.style.color = '#ff3366';
      }
    }

    const shouldPulse = tier === 'low' && ratio > 0 && gameState === 'PLAYING' && !activePin;
    if (timerBarWrap && shouldPulse !== lastPulseLow) {
      lastPulseLow = shouldPulse;
      if (shouldPulse) {
        timerBarWrap.classList.add('pulse-low');
      } else {
        timerBarWrap.classList.remove('pulse-low');
      }
    }

    const timeStr = pinTimeLeft.toFixed(1);
    if (force || timeStr !== lastTimerText) {
      lastTimerText = timeStr;
      const bonusPreview = calculatePinSpeedBonus(pinTimeLeft);
      timerValue.textContent = `${timeStr}s • ⚡+${bonusPreview} P`;
    }
  }

  // Responsive Fullscreen Canvas Setup (Mobil WebView, Android GPU & Safari Güvenli Boyutlandırma)
  function resizeCanvas() {
    try {
      const rect = canvas ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
      const docW = document.documentElement ? document.documentElement.clientWidth : 0;
      const docH = document.documentElement ? document.documentElement.clientHeight : 0;
      const screenW = typeof window.screen !== 'undefined' ? window.screen.width : 0;
      const screenH = typeof window.screen !== 'undefined' ? window.screen.height : 0;

      const fallbackW = window.innerWidth || docW || screenW || 360;
      const fallbackH = window.innerHeight || docH || screenH || 640;

      width = Math.max(280, rect.width || fallbackW);
      height = Math.max(420, rect.height || fallbackH);
      // Android cihazlarda yüksek çözünürlüklü ekranlarda GPU dolum (fill-rate) darboğazını önlemek için DPR sınırla
      const maxDpr = isAndroid ? 1.5 : 2.0;
      dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), maxDpr);

      if (canvas) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      if (ctx) {
        if (typeof ctx.setTransform === 'function') {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
          ctx.scale(dpr, dpr);
        }
      }

      const topHudBottom = 132;
      const usableHeight = Math.max(300, height - topHudBottom);
      const minDim = Math.min(width, usableHeight * 0.92);

      wheel.radius = Math.max(46, Math.min(76, minDim * 0.16));
      wheel.pinLength = Math.max(38, Math.min(60, minDim * 0.128));
      wheel.pinHeadRadius = Math.max(6.5, Math.min(8.6, minDim * 0.018));

      wheel.x = width / 2;
      const minWheelY = topHudBottom + wheel.radius + wheel.pinLength + 12;
      const idealWheelY = topHudBottom + usableHeight * 0.34;
      wheel.y = Math.max(minWheelY, idealWheelY);
    } catch (err) {
      width = width || 360;
      height = height || 640;
      wheel.x = width / 2;
      wheel.y = height * 0.42;
    }
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 120);
  });
  window.addEventListener('load', resizeCanvas);
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

  // Her bir iğne için çarkın dönüş hızına, yön değişimine ve rengin gelme süresine göre dinamik süre (~8.5 - 14.5 sn)
  function calculatePinTimeLimit(lvl, obstacles = 1) {
    let patternEfficiency = 1.0;
    let extraReverseAllowance = 0;

    if (wheel.pattern === 'GENTLE_WAVE') {
      patternEfficiency = 0.82;
    } else if (wheel.pattern === 'STEP_SEQUENCE') {
      // Yön değiştiren veya duraksayan bölümlerde rengin hedefe gelmesi için ek tolerans
      patternEfficiency = 0.72;
      extraReverseAllowance = 2.0;
    }

    const effectiveRadPerSec = Math.max(0.45, wheel.baseSpeed * 60 * patternEfficiency);
    const secondsPerFullTurn = (Math.PI * 2) / effectiveRadPerSec;

    // Doğru rengin gelmesini ve uygun boşluğu rahatça bekleyebilmek için ~1.5 tam tur + engel payı tanı
    const turnsAllowance = 1.45 + obstacles * 0.08;
    const calculatedSec = secondsPerFullTurn * turnsAllowance + extraReverseAllowance + 1.2;

    return Number(Math.max(8.5, Math.min(14.5, calculatedSec)).toFixed(1));
  }

  // Balanced & Gradual Progressive Difficulty Configuration (Full 360° Coverage & 10-Level Theme Shifts)
  function configureLevel(lvl) {
    const activeTheme = applyThemeForLevel(lvl);
    wheel.patternTimer = 0;
    wheel.stepIndex = 0;
    wheel.stepTraveled = 0;
    wheel.pauseTimer = 0;
    wheel.matchedSegmentIdx = -1;
    wheel.matchFlashAlpha = 0;

    // Gentle speed progression: starts at 0.0145 and rises smoothly (+0.00105 per level, max 0.035)
    const gentleBase = Math.min(0.0145 + (lvl - 1) * 0.00105, 0.035);
    wheel.baseSpeed = gentleBase;

    const isBoss = lvl % 5 === 0;
    let patternName = 'Tam Tur Rahat Dönüş';

    if (lvl <= 2) {
      wheel.pattern = 'STEADY';
      wheel.direction = lvl === 1 ? 1 : -1;
      wheel.steps = [];
      patternName = lvl === 1 ? 'Tam Tur Rahat Dönüş' : 'Ters Yön Tam Tur';
    } else if (lvl === 3) {
      wheel.pattern = 'STEP_SEQUENCE';
      wheel.steps = [
        { turns: 1.35, speedMult: 1.0, pause: 0.18 },
        { turns: -1.25, speedMult: 1.0, pause: 0.18 }
      ];
      patternName = '🔄 Tam Tur & Terse Dönüş';
    } else if (lvl === 4) {
      wheel.pattern = 'GENTLE_WAVE';
      wheel.direction = 1;
      wheel.steps = [];
      patternName = '🌊 Tam Tur Dalgalı Tempo';
    } else if (isBoss) {
      wheel.pattern = 'STEP_SEQUENCE';
      wheel.steps = [
        { turns: 1.3, speedMult: 1.12, pause: 0.15 },
        { turns: -0.55, speedMult: 1.05, pause: 0.14 },
        { turns: 1.25, speedMult: 1.15, pause: 0.15 },
        { turns: -1.35, speedMult: 1.1, pause: 0.16 }
      ];
      patternName = '👑 BOSS • Tam & Yarım Tur Kombo';
    } else if (lvl % 3 === 0) {
      wheel.pattern = 'STEP_SEQUENCE';
      wheel.steps = [
        { turns: 0.55, speedMult: 0.95, pause: 0.16 },
        { turns: 1.25, speedMult: 1.08, pause: 0.18 },
        { turns: -0.55, speedMult: 0.95, pause: 0.16 },
        { turns: -1.3, speedMult: 1.08, pause: 0.18 }
      ];
      patternName = '🎯 Yarım + Tam + Ters Tur';
    } else if (lvl % 2 === 1) {
      wheel.pattern = 'STEP_SEQUENCE';
      wheel.steps = [
        { turns: 1.35, speedMult: 1.05, pause: 0.16 },
        { turns: -1.2, speedMult: 1.05, pause: 0.16 }
      ];
      patternName = '🔄 Tam Tur İleri & Geri';
    } else {
      wheel.pattern = 'GENTLE_WAVE';
      wheel.direction = (lvl / 2) % 2 === 0 ? 1 : -1;
      wheel.steps = [];
      patternName = '🌊 Tam Tur Akıcı Tempo';
    }

    difficultyBanner.textContent = `Sv. ${lvl} (${activeTheme.name}) • ${patternName}`;

    // Pre-stuck pins: starts with 1 pin on Level 1, grows gradually up to max 6
    stuckPins = [];
    const obstacleCount = lvl === 1 ? 1 : Math.min(1 + Math.floor(lvl / 2.2), 6);
    for (let i = 0; i < obstacleCount; i++) {
      const rawAngle = (Math.PI * 2 * i) / obstacleCount + 0.25;
      const angle = normalizeAngle(rawAngle);
      const sliceCol = getSegmentColorAtAngle(angle);
      stuckPins.push({
        angle,
        color: sliceCol,
        isObstacle: true,
        scale: 1,
        matched: false
      });
    }

    // Bonus stars on wheel circumference
    bonusStars = [];
    const starCount = isBoss ? 3 : lvl >= 2 ? Math.min(1 + Math.floor(lvl / 3), 3) : 1;
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

    // Pins player must throw: starts at 6 and increases steadily with level up to 16
    totalPinsForLevel = Math.min(6 + Math.floor((lvl - 1) * 0.85), 16);
    pinsRemaining = totalPinsForLevel;
    activePin = null;

    // İğne başına fırlatma süresini çark hızı ve engel sayısına göre dinamik ayarla ve başlat
    pinTimeLimit = calculatePinTimeLimit(lvl, obstacleCount);
    resetPinTimer();

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

  // Action: Throw Pin (İğneyi fırlattığı an kalan süreyi kilitle ve sayacı yeni iğne için sıfırla)
  function throwPin() {
    if (gameState !== 'PLAYING') return;
    if (activePin || pinsRemaining <= 0) return;

    thrownPinTimeLeft = pinTimeLeft;
    pinTimeLeft = pinTimeLimit;
    if (timerBarWrap) timerBarWrap.classList.remove('pulse-low');
    updateTimerUI();

    activePin = {
      x: wheel.x,
      y: getLaunchY(),
      vy: -Math.max(1150, height * 1.9),
      color: getCurrentPinColor()
    };
    sfx.throwPin();
    trackAnalyticsEvent('pin_throw', {
      level,
      pins_remaining: pinsRemaining - 1,
      pin_time_left: Number(thrownPinTimeLeft.toFixed(2))
    });
  }

  // İğne süresi dolduğunda ceza puanı uygula, eldeki iğneyi kaçır ve yeni iğne için süreyi başlat
  function handlePinTimeout() {
    const penalty = 15 * level;
    score = Math.max(0, score - penalty);
    hudScore.textContent = score;
    combo = 0;
    colorMatchStreak = 0;

    sfx.timeoutPenalty();
    triggerShake(0.22, 6);
    triggerFlash('#ff6b35', 0.24);

    const launchY = getLaunchY();
    const missedColor = getCurrentPinColor();
    spawnParticles(wheel.x, launchY + wheel.pinLength * 0.7, missedColor, 20, 1.05);
    spawnFloatingText(wheel.x, launchY - 12, `⌛ SÜRE DOLDU! İĞNE KAÇTI (-${penalty} P)`, '#ff5252', 17);

    // Kaçırılan iğnenin yerine sıradaki farklı bir renk ver ve süreyi yeni iğne için sıfırla
    const curIdx = totalPinsForLevel - pinsRemaining;
    const nextPaletteIdx = (wheel.palette.indexOf(missedColor) + 1) % wheel.palette.length;
    pinQueueColors[curIdx] = wheel.palette[nextPaletteIdx >= 0 ? nextPaletteIdx : 0];

    resetPinTimer();

    trackAnalyticsEvent('pin_timeout_penalty', {
      level,
      penalty,
      score_after: score
    });
  }

  // Particle & Floating Text Helpers
  function spawnParticles(x, y, color, count = 18, speedMultiplier = 1) {
    const actualCount = isAndroid ? Math.max(6, Math.round(count * 0.55)) : count;
    const maxParticles = isAndroid ? 36 : 80;
    for (let i = 0; i < actualCount; i++) {
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
    if (particles.length > maxParticles) {
      particles.splice(0, particles.length - maxParticles);
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
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - dt * 1.5);
    if (wheel.matchFlashAlpha > 0) wheel.matchFlashAlpha = Math.max(0, wheel.matchFlashAlpha - dt * 1.8);
    wheel.pulseScale += (1 - wheel.pulseScale) * Math.min(1, dt * 14);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

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

    // Oyuncu elindeki iğneyi fırlatmak için beklerken İğne Başına Süre sayacını azalt
    if (gameState === 'PLAYING' && !activePin && pinsRemaining > 0) {
      pinTimeLeft = Math.max(0, pinTimeLeft - dt);
      updateTimerUI();
      if (pinTimeLeft <= 0) {
        handlePinTimeout();
      }
    }

    // Smooth, Full-360° Coverage Wheel Rotation Patterns
    wheel.patternTimer += dt;
    const baseRadPerSec = wheel.baseSpeed * 60;

    if (wheel.pattern === 'STEP_SEQUENCE' && wheel.steps.length > 0) {
      if (wheel.pauseTimer > 0) {
        wheel.pauseTimer = Math.max(0, wheel.pauseTimer - dt);
        wheel.currentSpeed = 0;
      } else {
        const currentStep = wheel.steps[wheel.stepIndex];
        const targetRad = Math.abs(currentStep.turns) * Math.PI * 2;
        const dir = currentStep.turns >= 0 ? 1 : -1;
        const remainingRad = Math.max(0, targetRad - wheel.stepTraveled);

        const easeZone = Math.min(0.45, targetRad * 0.25);
        let easeFactor = 1;
        if (wheel.stepTraveled < easeZone) {
          easeFactor = 0.28 + 0.72 * (wheel.stepTraveled / easeZone);
        } else if (remainingRad < easeZone) {
          easeFactor = 0.25 + 0.75 * (remainingRad / easeZone);
        }

        const speedMag = baseRadPerSec * (currentStep.speedMult || 1) * easeFactor;
        const stepDelta = speedMag * dt;
        wheel.currentSpeed = speedMag * dir;
        wheel.angle = normalizeAngle(wheel.angle + wheel.currentSpeed * dt);
        wheel.stepTraveled += stepDelta;

        if (wheel.stepTraveled >= targetRad) {
          wheel.stepTraveled = 0;
          wheel.pauseTimer = currentStep.pause || 0.15;
          wheel.stepIndex = (wheel.stepIndex + 1) % wheel.steps.length;
        }
      }
    } else if (wheel.pattern === 'GENTLE_WAVE') {
      const wave = 0.65 + 0.45 * Math.sin(wheel.patternTimer * 1.65);
      wheel.currentSpeed = baseRadPerSec * wave * wheel.direction;
      wheel.angle = normalizeAngle(wheel.angle + wheel.currentSpeed * dt);
    } else {
      wheel.currentSpeed = baseRadPerSec * wheel.direction;
      wheel.angle = normalizeAngle(wheel.angle + wheel.currentSpeed * dt);
    }

    bonusStars.forEach((s) => {
      s.pulse += dt * 5;
    });

    if (activePin && gameState === 'PLAYING') {
      activePin.y += activePin.vy * dt;

      const targetTipY = wheel.y + wheel.radius;
      if (activePin.y <= targetTipY) {
        const hitWorldAngle = Math.PI / 2;
        const relativeAngle = normalizeAngle(hitWorldAngle - wheel.angle);

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

    const now = performance.now();
    if (now - lastThrowTime < 1200) {
      combo = Math.min(combo + 1, 8);
    } else {
      combo = 1;
    }
    lastThrowTime = now;

    // Color Match Check
    const landedSegmentIdx = getSegmentIndexAtAngle(relativeAngle);
    const landedSegmentColor = wheel.palette[landedSegmentIdx];
    const isSliceMatch = landedSegmentColor.toLowerCase() === color.toLowerCase();

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
    const speedBonus = calculatePinSpeedBonus(thrownPinTimeLeft);
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

      trackAnalyticsEvent('color_match_bonus', {
        level,
        streak: colorMatchStreak,
        bonus_points: colorBonus
      });
    } else {
      colorMatchStreak = 0;
      if (starBonus === 0) {
        sfx.pinHit(combo);
      }
      spawnParticles(impactX, impactY, color, 14, 0.9);
    }

    const totalEarned = basePoints + colorBonus + speedBonus + starBonus;
    score += totalEarned;
    hudScore.textContent = score;
    updateHudBest();

    if (isSliceMatch && isNeighborPinMatch) {
      spawnFloatingText(
        impactX,
        impactY + 28,
        `🌈 SÜPER UYUM! +${basePoints + colorBonus} (⚡+${speedBonus})`,
        color,
        19
      );
    } else if (isColorMatched) {
      const streakTxt = colorMatchStreak > 1 ? ` x${colorMatchStreak}` : '';
      spawnFloatingText(
        impactX,
        impactY + 28,
        `🎨 RENK UYUMU${streakTxt}! +${basePoints + colorBonus} (⚡+${speedBonus})`,
        color,
        18
      );
    } else {
      const comboText = combo > 1 ? `🔥 x${combo} +${basePoints} (⚡+${speedBonus} Hız)` : `+${basePoints} (⚡+${speedBonus} Hız)`;
      spawnFloatingText(impactX, impactY + 26, comboText, '#ffffff', combo > 1 ? 17 : 15.5);
    }

    // Sonraki iğne için süreyi sıfırla
    resetPinTimer();

    // Check Level Clear
    if (pinsRemaining <= 0) {
      gameState = 'LEVEL_CLEAR';
      if (timerBarWrap) timerBarWrap.classList.remove('pulse-low');

      const levelBonus = 50 * level;
      score += levelBonus;
      hudScore.textContent = score;
      updateHudBest();

      const completedThemeChapter = level % 10 === 0;
      if (completedThemeChapter) {
        lives++;
        updateHudLives();
        sfx.lifeUp();
        triggerFlash('#ffcc00', 0.38);
        spawnParticles(wheel.x, wheel.y, '#ffcc00', 52, 1.65);
        spawnFloatingText(
          wheel.x,
          wheel.y - 16,
          `🎉 ${level}. SEVİYE GEÇİLDİ! YENİ TEMA & ❤️ +1 CAN!`,
          '#ffcc00',
          19
        );
        spawnFloatingText(wheel.x, wheel.y + 16, `SEVİYE BONUSU +${levelBonus}`, '#00f5d4', 18);
      } else {
        sfx.levelUp();
        triggerFlash(currentTheme.accentColor || '#00f5d4', 0.32);
        spawnParticles(wheel.x, wheel.y, currentTheme.accentColor || '#00f5d4', 40, 1.5);
        spawnFloatingText(
          wheel.x,
          wheel.y,
          `SEVİYE ${level} TAMAMLANDI! +${levelBonus}`,
          currentTheme.accentColor || '#00f5d4',
          20
        );
      }

      trackAnalyticsEvent('level_complete', {
        level,
        score,
        lives_remaining: lives,
        awarded_extra_life: completedThemeChapter
      });

      setTimeout(() => {
        if (gameState === 'LEVEL_CLEAR') {
          level++;
          configureLevel(level);
          gameState = 'PLAYING';
        }
      }, completedThemeChapter ? 1450 : 1150);
    }
  }

  function handleCollision(collidedPin) {
    const crashX = wheel.x;
    const crashY = wheel.y + wheel.radius + wheel.pinLength;

    // Can / Hak Sistemi: Oyuncunun canı varsa oyun bitmesin, 1 can eksilerek devam etsin
    if (lives > 0) {
      lives--;
      updateHudLives();
      activePin = null;
      combo = 0;
      colorMatchStreak = 0;
      resetPinTimer();

      sfx.lifeSaved();
      triggerShake(0.3, 9);
      triggerFlash('#ffcc00', 0.34);

      spawnParticles(crashX, crashY, '#ffcc00', 30, 1.3);
      spawnFloatingText(
        crashX,
        crashY - 18,
        `🛡️ 1 CAN KULLANILDI! (Kalan: ❤️ ${lives})`,
        '#ffcc00',
        18
      );

      trackAnalyticsEvent('life_used', {
        level,
        score,
        lives_remaining: lives
      });
      return;
    }

    gameState = 'GAME_OVER';
    if (timerBarWrap) timerBarWrap.classList.remove('pulse-low');
    sfx.collision();
    triggerShake(0.45, 14);
    triggerFlash('#ff1744', 0.45);

    spawnParticles(crashX, crashY, '#ff1744', 36, 1.4);
    spawnFloatingText(crashX, crashY - 20, 'ÇARPIŞMA!', '#ff5252', 24);
    collidedPin.color = '#ff1744';

    trackAnalyticsEvent('game_over', {
      final_score: score,
      final_level: level
    });

    setTimeout(() => {
      showGameOverModal();
    }, 650);
  }

  // Rendering (Şeffaf Canvas GPU Hatalarını Önlemek İçin Koyu Arka Planı Doğrudan Çiz)
  function draw() {
    if (!ctx) return;
    ctx.fillStyle = (currentTheme && currentTheme.bgDark) || '#071324';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    if (shakeTime > 0) {
      const dx = (Math.random() - 0.5) * 2 * shakeIntensity;
      const dy = (Math.random() - 0.5) * 2 * shakeIntensity;
      ctx.translate(dx, dy);
    }

    drawBackgroundDecor();
    drawStuckPins();
    drawBonusStars();
    drawWheel();
    drawActiveAndQueuedPins();
    drawParticlesAndTexts();

    ctx.restore();

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
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.06)';
    ctx.lineWidth = 1.5;
    const outerOrbit = wheel.radius + wheel.pinLength;
    ctx.beginPath();
    ctx.arc(wheel.x, wheel.y, outerOrbit, 0, Math.PI * 2);
    ctx.stroke();

    const currentReadyColor = getCurrentPinColor();
    const bottomRelativeAngle = normalizeAngle(Math.PI / 2 - wheel.angle);
    const bottomSliceColor = getSegmentColorAtAngle(bottomRelativeAngle);
    const isTargetMatchingNow =
      gameState === 'PLAYING' &&
      pinsRemaining > 0 &&
      currentReadyColor &&
      bottomSliceColor.toLowerCase() === currentReadyColor.toLowerCase();

    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([5, 7]);
    }
    ctx.strokeStyle = isTargetMatchingNow ? currentReadyColor : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = isTargetMatchingNow ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(wheel.x, wheel.y + wheel.radius + 8);
    ctx.lineTo(wheel.x, getLaunchY() - 14);
    ctx.stroke();

    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([]);
    }
    const targetY = wheel.y + wheel.radius + 6;
    if (isTargetMatchingNow) {
      if (!isAndroid) {
        ctx.shadowColor = currentReadyColor;
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = currentReadyColor;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(wheel.x, targetY + 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = isTargetMatchingNow ? currentReadyColor : 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(wheel.x, targetY - 3);
    ctx.lineTo(wheel.x - 6, targetY + 6);
    ctx.lineTo(wheel.x + 6, targetY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawStuckPins() {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < stuckPins.length; i++) {
      const p = stuckPins[i];
      p.scale += (1 - p.scale) * 0.18;
      const worldAngle = wheel.angle + p.angle;
      const cos = Math.cos(worldAngle);
      const sin = Math.sin(worldAngle);

      const innerX = wheel.x + cos * (wheel.radius - 4);
      const innerY = wheel.y + sin * (wheel.radius - 4);
      const outerDist = wheel.radius + wheel.pinLength * p.scale;
      const outerX = wheel.x + cos * outerDist;
      const outerY = wheel.y + sin * outerDist;
      const headR = wheel.pinHeadRadius * p.scale;

      ctx.strokeStyle = p.matched ? p.color : p.isObstacle ? 'rgba(225, 232, 238, 0.85)' : '#ffffff';
      ctx.lineWidth = p.matched ? 3.8 : 3.2;
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();

      // Android Skia'da shadowBlur yerine sıfır maliyetli neon hale (halo) çizimi
      if (isAndroid) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.matched ? 0.32 : 0.2;
        ctx.beginPath();
        ctx.arc(outerX, outerY, headR * (p.matched ? 1.55 : 1.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.matched ? 12 : 7;
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(outerX, outerY, headR, 0, Math.PI * 2);
      ctx.fill();

      if (!isAndroid) ctx.shadowBlur = 0;

      if (p.matched || p.isObstacle) {
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = p.matched ? '#ffffff' : 'rgba(255, 255, 255, 0.65)';
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(outerX - 2, outerY - 2, wheel.pinHeadRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

      if (isAndroid) {
        ctx.fillStyle = 'rgba(255, 204, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowColor = '#FFCC00';
        ctx.shadowBlur = 12;
      }

      ctx.fillStyle = '#FFCC00';
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

    for (let i = 0; i < segments; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, i * arcStep, (i + 1) * arcStep);
      ctx.closePath();
      ctx.fillStyle = wheel.palette[i];
      ctx.fill();

      if (i === wheel.matchedSegmentIdx && wheel.matchFlashAlpha > 0) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = wheel.matchFlashAlpha * 0.55;
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = wheel.hubColor || '#0b1830';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Çark Merkezinde İğne Süresi Halkası (Per-Pin Shot Clock Ring)
    const timeRatio = Math.max(0, Math.min(1, pinTimeLeft / Math.max(0.1, pinTimeLimit)));
    const ringRadius = r * 0.57;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(wheel.x, wheel.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (timeRatio > 0) {
      const ringColor = getTimerColor(timeRatio);
      ctx.strokeStyle = ringColor;
      if (!isAndroid) {
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = 8;
      }
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(wheel.x, wheel.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timeRatio);
      ctx.stroke();
    }
    ctx.restore();

    // Orta kısım kalan iğne sayısı ve etiketi (kenarlara değmeden tam ortaya şık yerleşim)
    ctx.save();
    const numFontSize = Math.round(r * (pinsRemaining >= 10 ? 0.31 : 0.35));
    const labelFontSize = Math.max(7, Math.round(r * 0.102));

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${numFontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pinsRemaining, wheel.x, wheel.y - r * 0.08);

    ctx.fillStyle = 'rgba(0, 245, 212, 0.88)';
    ctx.font = `700 ${labelFontSize}px system-ui, sans-serif`;
    ctx.fillText('KALAN İĞNE', wheel.x, wheel.y + r * 0.2);
    ctx.restore();
  }

  function drawSinglePinAt(x, tipY, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const headY = tipY + wheel.pinLength;
    const headR = wheel.pinHeadRadius * 1.12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, tipY);
    ctx.lineTo(x, headY);
    ctx.stroke();

    if (isAndroid) {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.26;
      ctx.beginPath();
      ctx.arc(x, headY, headR * 1.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    if (!isAndroid) ctx.shadowBlur = 0;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  function drawActiveAndQueuedPins() {
    const launchY = getLaunchY();

    if (activePin) {
      drawSinglePinAt(activePin.x, activePin.y, activePin.color, 1);
    }

    if (!activePin && pinsRemaining > 0 && gameState === 'PLAYING') {
      const nextColor = getCurrentPinColor();
      drawSinglePinAt(wheel.x, launchY, nextColor, 1);

      // Eldeki iğnenin baş kısmı etrafında geri sayım halkası
      const ratio = Math.max(0, Math.min(1, pinTimeLeft / Math.max(0.1, pinTimeLimit)));
      const headY = launchY + wheel.pinLength;
      const ringR = wheel.pinHeadRadius * 1.65;
      ctx.save();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = getTimerColor(ratio);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(wheel.x, headY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      ctx.restore();
    }

    const queueStartCount = activePin ? pinsRemaining : pinsRemaining - 1;
    const maxVisibleDots = Math.min(queueStartCount, 7);
    const dotStartY = Math.min(height - 18, launchY + wheel.pinLength + 22);

    ctx.save();
    for (let i = 0; i < maxVisibleDots; i++) {
      const colorIdx = totalPinsForLevel - queueStartCount + i;
      const col = pinQueueColors[colorIdx] || wheel.palette[colorIdx % wheel.palette.length];
      const offsetX = (i - (maxVisibleDots - 1) / 2) * 19;

      ctx.fillStyle = col;
      ctx.globalAlpha = 0.88 - i * 0.08;
      ctx.beginPath();
      ctx.arc(wheel.x + offsetX, dotStartY, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticlesAndTexts() {
    if (particles.length > 0) {
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      for (let i = 0; i < floatingTexts.length; i++) {
        const ft = floatingTexts[i];
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = `800 ${ft.size}px system-ui, sans-serif`;
        if (!isAndroid) {
          ctx.shadowColor = 'rgba(0,0,0,0.75)';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillText(ft.text, ft.x + 1, ft.y + 1.5);
        }
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.restore();
    }
  }

  // Modal & Flow Controls
  function startNewGame() {
    sfx.init();
    score = 0;
    level = 1;
    lives = 1;
    combo = 0;
    colorMatchStreak = 0;
    scoreSavedForRun = false;
    latestSavedKey = null;

    if (saveFeedback) {
      saveFeedback.style.display = 'none';
    }

    hudScore.textContent = '0';
    updateHudLives();
    updateHudBest();
    configureLevel(1);

    mainOverlay.classList.add('hidden');
    gameState = 'PLAYING';

    trackAnalyticsEvent('game_start', {
      viewport_width: width,
      viewport_height: height,
      initial_lives: lives
    });
  }

  function showGameOverModal() {
    const lockedName = getLockedDeviceName();

    modalTitle.textContent = 'OYUN BİTTİ!';
    modalSubtitle.textContent =
      score > 0
        ? lockedName
          ? `Cihaz kullanıcısı: "${lockedName}" • En yüksek rekorun otomatik kontrol ediliyor...`
          : 'Bu cihaz için tek bir kullanıcı adı (nickname) belirleyerek rekorunu Küresel İlk 10 tablosuna kaydet!'
        : 'İğneler birbirine çarptı! Kendi rengindeki dilimleri hedefleyerek tekrar dene.';

    endStats.style.display = 'grid';
    finalScoreEl.textContent = score;
    finalLevelEl.textContent = level;

    if (saveFeedback) {
      saveFeedback.style.display = 'none';
    }

    btnStartGame.textContent = '🔄 TEKRAR OYNA';
    mainOverlay.classList.remove('hidden');

    if (score > 0 && !scoreSavedForRun) {
      if (lockedName) {
        // Cihazda kayıtlı tek kullanıcı adı varsa farklı isim girilmesini engelle ve rekoru otomatik güncelle
        saveScoreForm.style.display = 'none';
        scoreSavedForRun = true;
        fetchGlobalScores()
          .then(() => saveScoreEntry(lockedName, score, level))
          .then(() => {
            modalSubtitle.textContent = `Cihaz kullanıcısı: "${lockedName}" • Yalnızca en yüksek rekorun tabloda yer alır.`;
          })
          .catch(() => {});
      } else {
        // Bu cihazdan ilk kez skor kaydediliyorsa tek seferlik kullanıcı adı seçimine izin ver
        saveScoreForm.style.display = 'flex';
        playerNameInput.readOnly = false;
        playerNameInput.value = '';
        playerNameInput.placeholder = 'Cihaz kullanıcı adını belirle...';
        if (btnSubmitScore) {
          btnSubmitScore.disabled = false;
          btnSubmitScore.textContent = 'Skoru Kaydet 🚀';
        }
        fetchGlobalScores();
      }
    } else {
      saveScoreForm.style.display = 'none';
      fetchGlobalScores();
    }
  }

  function openScoreboardModal() {
    trackAnalyticsEvent('leaderboard_view', { current_level: level, current_score: score });
    fetchGlobalScores();

    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      if (timerBarWrap) timerBarWrap.classList.remove('pulse-low');
      modalTitle.textContent = 'OYUN DURAKLATILDI';
      modalSubtitle.textContent = 'Küresel skor tablosuna göz atıyorsun. Kaldığın yerden devam edebilirsin.';
      endStats.style.display = 'none';
      saveScoreForm.style.display = 'none';
      if (saveFeedback) saveFeedback.style.display = 'none';
      btnStartGame.textContent = '▶ DEVAM ET';
      mainOverlay.classList.remove('hidden');
    } else {
      mainOverlay.classList.remove('hidden');
    }
  }

  // Event Listeners (Touch, Pointer, Keyboard - Eski & Yeni Mobil Tarayıcı Uyumlu)
  if (window.PointerEvent) {
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        throwPin();
      },
      { passive: false }
    );
  } else {
    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        throwPin();
      },
      { passive: false }
    );
    canvas.addEventListener('mousedown', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      throwPin();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
      if (document.activeElement === playerNameInput) return;
      if (gameState === 'PLAYING') {
        e.preventDefault();
        throwPin();
      } else if (mainOverlay && !mainOverlay.classList.contains('hidden') && e.code === 'Enter') {
        e.preventDefault();
        if (btnStartGame) btnStartGame.click();
      }
    }
  });

  if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
      if (gameState === 'PAUSED') {
        if (mainOverlay) mainOverlay.classList.add('hidden');
        gameState = 'PLAYING';
        updateTimerUI();
      } else {
        startNewGame();
      }
    });
  }

  if (btnScoreboard) {
    btnScoreboard.addEventListener('click', (e) => {
      e.stopPropagation();
      openScoreboardModal();
    });
  }

  if (btnSound) {
    btnSound.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = sfx.toggle();
      btnSound.textContent = on ? '🔊' : '🔇';
    });
  }

  if (saveScoreForm) {
    saveScoreForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (scoreSavedForRun) return;
      scoreSavedForRun = true;
      if (btnSubmitScore) {
        btnSubmitScore.disabled = true;
        btnSubmitScore.textContent = 'Kaydediliyor...';
      }
      saveScoreForm.style.display = 'none';
      saveScoreEntry(playerNameInput ? playerNameInput.value : 'Oyuncu', score, level).catch(() => {});
    });
  }

  if (btnRefreshScores) {
    btnRefreshScores.addEventListener('click', () => {
      fetchGlobalScores();
    });
  }

  // Main Animation Loop (Hata Korumalı - Oyunun Beyaz Ekranda Kalmasını veya Donmasını Önler)
  let lastFrameTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  function loop(now) {
    try {
      if (canvas && canvas.clientWidth > 200 && Math.abs(canvas.clientWidth - width) > 6) {
        resizeCanvas();
      }
      const currentNow =
        typeof now === 'number' ? now : typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const rawDt = (currentNow - lastFrameTime) / 1000;
      const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.05) : 0.016;
      lastFrameTime = currentNow;

      update(dt);
      draw();
    } catch (err) {
      // Tek bir karede hata oluşsa bile oyun döngüsünü kesintisiz sürdür
    }
    requestAnimationFrame(loop);
  }

  // Initialize (Güvenli Başlatma & Mobil Uygulama İçi Tarayıcı Boyut Kurtarma)
  try {
    resizeCanvas();
    updateHudLives();
    configureLevel(1);
    renderScoreboard();
    updateHudBest();
    fetchGlobalScores();

    // WhatsApp, Instagram, Telegram gibi uygulama içi WebView'larda ekran boyutu geç oturduğunda otomatik güncelle
    setTimeout(resizeCanvas, 60);
    setTimeout(resizeCanvas, 250);
    setTimeout(resizeCanvas, 700);
  } catch (err) {
    // Başlatma sırasında beklenmeyen bir depolama/tarayıcı hatası olursa varsayılanlarla devam et
  }
  requestAnimationFrame(loop);
})();
