(() => {
  'use strict';

  // DOM - with error checking
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Canvas 2D context not available');
    return;
  }
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const levelEl = document.getElementById('level');
  const bestEl = document.getElementById('bestScore');
  const lastEl = document.getElementById('lastScore');
  const yearEl = document.getElementById('year');
  const overlay = document.getElementById('overlay');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnSound = document.getElementById('btnSound');
  
  // Check if all required elements exist
  if (!scoreEl || !comboEl || !levelEl || !bestEl || !lastEl || !yearEl || !overlay || !btnStart || !btnPause || !btnSound) {
    console.error('Required DOM elements not found');
    return;
  }
  
  const overlayTitle = overlay.querySelector('h1');
  const overlayText = overlay.querySelector('p.muted');
  const levelProgress = document.getElementById('levelProgress');
  const difficultyIndicator = document.getElementById('difficultyIndicator');
  const difficultyBar = document.getElementById('difficultyBar');
  const speedSelector = document.getElementById('speedSelector');
  const speedButtons = document.querySelectorAll('.speed-btn');
  
  if (!overlayTitle || !overlayText || !levelProgress || !difficultyIndicator || !difficultyBar || !speedSelector) {
    console.error('Overlay elements not found');
    return;
  }

  // Initialize year and scores
  try {
    yearEl.textContent = String(new Date().getFullYear());
    const best0 = Number(localStorage.getItem('sbs_best') || '0');
    const last0 = Number(localStorage.getItem('sbs_last') || '0');
    bestEl.textContent = String(best0);
    lastEl.textContent = String(last0);
    
    // Initialize UI indicators
    updateLevelProgress(1);
    updateDifficultyIndicator(1);
    
    // Load saved speed preference
    selectedSpeed = localStorage.getItem('sbs_speed') || 'normal';
    updateSpeedButtons();
  } catch (e) {
    console.warn('Error initializing scores:', e);
  }

  // DPR-aware canvas sizing
  const state = {
    running: false,
    paused: false,
    width: 0,
    height: 0,
    offsetX: 0, // Horizontal offset for centering game area on desktop
    dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    mode: 'ready', // ready | aiming | playing | level_complete | game_over
    ballR: 10,
  };

  function resizeCanvas() {
    try {
      const rect = canvas.getBoundingClientRect();
      const actualWidth = Math.floor(rect.width);
      const actualHeight = Math.floor(rect.height);
      
      // Constrain game area on desktop for better gameplay
      const isDesktop = actualWidth > 768;
      if (isDesktop) {
        // Fixed game area width on desktop for consistent gameplay
        state.width = Math.min(600, actualWidth);
        state.height = actualHeight;
        // Center the game area
        state.offsetX = (actualWidth - state.width) / 2;
      } else {
        // Full width on mobile
        state.width = actualWidth;
        state.height = actualHeight;
        state.offsetX = 0;
      }
      
      canvas.width = Math.floor(actualWidth * state.dpr);
      canvas.height = Math.floor(actualHeight * state.dpr);
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      
      // responsive ball radius based on game area
      const minDim = Math.min(state.width, state.height);
      state.ballR = clamp(Math.floor(minDim * 0.018), 6, 12);
    } catch (e) {
      console.error('Error resizing canvas:', e);
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Utility
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const now = () => performance.now();
  
  // UI Helper Functions
  function updateLevelProgress(currentLevel) {
    try {
      levelProgress.innerHTML = '';
      for (let i = 1; i <= 10; i++) {
        const dot = document.createElement('div');
        dot.className = 'level-dot';
        if (i < currentLevel) {
          dot.classList.add('completed');
        } else if (i === currentLevel) {
          dot.classList.add('current');
        }
        levelProgress.appendChild(dot);
      }
    } catch (e) {
      console.warn('Error updating level progress:', e);
    }
  }
  
  function updateDifficultyIndicator(level) {
    try {
      difficultyBar.innerHTML = '';
      const difficulty = Math.min(10, Math.ceil(level / 2)); // 1-5 difficulty scale
      
      for (let i = 1; i <= 5; i++) {
        const segment = document.createElement('div');
        segment.className = 'difficulty-segment';
        if (i <= difficulty) {
          segment.classList.add('active');
          if (i <= 2) segment.classList.add('easy');
          else if (i <= 3) segment.classList.add('medium');
          else segment.classList.add('hard');
        }
        difficultyBar.appendChild(segment);
      }
    } catch (e) {
      console.warn('Error updating difficulty indicator:', e);
    }
  }
  
  function updateSpeedButtons() {
    try {
      speedButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.speed === selectedSpeed) {
          btn.classList.add('active');
        }
      });
    } catch (e) {
      console.warn('Error updating speed buttons:', e);
    }
  }

  // Game constants
  const PADDLE_WIDTH = 140;
  const PADDLE_HEIGHT = 16;
  const PADDLE_RADIUS = 8;
  const BALL_RADIUS = 10;
  const BALL_SPEED = 360; // px/s base speed
  const BULLET_SPEED = -800;
  const METEOR_SPEED = -520;
  const MAX_COMBO_TIME = 1400; // ms
  
  // Speed settings
  const SPEED_MULTIPLIERS = {
    slow: 0.7,
    normal: 1.0,
    fast: 1.4
  };
  let selectedSpeed = 'normal';

  // Pools
  function createPool(factory, initial = 0) {
    const free = [];
    for (let i = 0; i < initial; i++) free.push(factory());
    return {
      acquire() { return free.pop() || factory(); },
      release(obj) { free.push(obj); },
      size() { return free.length; }
    };
  }

  // Enhanced input handling: touch + mouse with better mobile support
  const input = {
    isDown: false,
    x: 0,
    y: 0,
    lastTouchTime: 0,
    isInsideGameArea: false,
  };
  
  function handlePointer(e) {
    try {
      // Don't prevent default for right-click events (allow context menu)
      if (e && typeof e.preventDefault === 'function' && e.button !== 2) e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        input.lastTouchTime = now();
      } else if (e.clientX !== undefined) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return;
      }
      
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      
      // Check if mouse is inside game area
      const isInsideGameArea = mouseX >= state.offsetX && mouseX <= state.offsetX + state.width;
      input.isInsideGameArea = isInsideGameArea;
      
      // Update cursor based on position
      if (isInsideGameArea) {
        canvas.style.cursor = 'crosshair';
        // Update input position when inside game area
        input.x = clamp(mouseX - state.offsetX, 0, state.width);
        input.y = mouseY;
        
        // Update aim angle when ball is on paddle
        if (world.ballOnPaddle && state.mode === 'aiming') {
          const paddleCenterX = world.paddleX + world.paddleW * 0.5;
          const paddleCenterY = world.paddleY;
          const dx = input.x - paddleCenterX;
          const dy = input.y - paddleCenterY;
          
          // Calculate angle, constrain to upward directions only
          let angle = Math.atan2(dy, dx);
          angle = clamp(angle, -Math.PI * 0.9, -Math.PI * 0.1);
          world.aimAngle = angle;
        }
      } else {
        canvas.style.cursor = 'default';
        // Keep last known position when outside - don't update input.x or input.y
      }
    } catch (err) {
      console.warn('Error handling pointer:', err);
    }
  }
  
  // Enhanced touch event handling
  canvas.addEventListener('touchstart', e => { 
    input.isDown = true; 
    handlePointer(e);
    
    // Launch ball if in aiming mode
    if (state.mode === 'aiming' && world.ballOnPaddle) {
      launchBall();
    }
  }, { passive: false });
  
  canvas.addEventListener('touchmove', e => { 
    // Always handle touch movement for paddle control
    handlePointer(e); 
  }, { passive: false });
  
  canvas.addEventListener('touchend', () => { 
    input.isDown = false; 
  }, { passive: true });
  
  canvas.addEventListener('touchcancel', () => { 
    input.isDown = false; 
  }, { passive: true });
  
  // Mouse events for desktop
  canvas.addEventListener('mousedown', e => { 
    // Only handle left mouse button for game controls
    if (e.button === 0) { // Left click only
      input.isDown = true; 
      handlePointer(e);
      
      // Launch ball if in aiming mode and inside game area
      if (state.mode === 'aiming' && world.ballOnPaddle && input.isInsideGameArea) {
        launchBall();
      }
    }
    // Right-click (button 2) will naturally show context menu since we don't prevent default
  }, { passive: false });
  
  canvas.addEventListener('mousemove', e => {
    // Always track mouse movement for paddle control
    handlePointer(e);
  }, { passive: false });
  
  canvas.addEventListener('mouseup', e => { 
    // Only handle left mouse button for game controls
    if (e.button === 0) {
      input.isDown = false; 
    }
  }, { passive: true });
  
  canvas.addEventListener('mouseleave', () => { 
    input.isDown = false; 
  }, { passive: true });

  // Entities
  const world = {
    paddleX: 0,
    paddleY: 0,
    paddleW: PADDLE_WIDTH,
    paddleH: PADDLE_HEIGHT,
    paddleVX: 0,
    ballX: 0,
    ballY: 0,
    ballVX: 0,
    ballVY: 0,
    currentBallSpeed: BALL_SPEED,
    levelConfig: null,
    aimAngle: -Math.PI / 4, // Default aim angle
    ballOnPaddle: true,
    bullets: [],
    meteors: [],
    particles: [],
    blocks: [],
    powerups: [],
    level: 1,
    score: 0,
    combo: 1,
    lastHitAt: 0,
    shooterUntil: 0,
    meteorUntil: 0,
    lastBulletAt: 0,
  };

  const bulletPool = createPool(() => ({ x:0, y:0, vy:BULLET_SPEED, active:false, life:0 }), 32);
  const meteorPool = createPool(() => ({ x:0, y:0, vy:METEOR_SPEED, active:false }), 16);
  const particlePool = createPool(() => ({ x:0, y:0, vx:0, vy:0, life:0, color:'#fff', size:2, active:false }), 128);

  function resetBall() {
    try {
      // Place ball on paddle initially
      world.ballOnPaddle = true;
      world.ballX = world.paddleX + world.paddleW * 0.5;
      world.ballY = world.paddleY - state.ballR - 2;
      world.ballVX = 0;
      world.ballVY = 0;
      world.aimAngle = -Math.PI / 4; // Default upward angle
    } catch (e) {
      console.error('Error resetting ball:', e);
    }
  }
  
  function launchBall() {
    try {
      world.ballOnPaddle = false;
      world.ballVX = Math.cos(world.aimAngle) * world.currentBallSpeed;
      world.ballVY = Math.sin(world.aimAngle) * world.currentBallSpeed;
      state.mode = 'playing';
    } catch (e) {
      console.error('Error launching ball:', e);
    }
  }

  function placePaddle() {
    try {
      world.paddleW = clamp(state.width * 0.28, 100, 220);
      world.paddleH = PADDLE_HEIGHT;
      world.paddleX = state.width * 0.5 - world.paddleW * 0.5;
      world.paddleY = state.height - world.paddleH - 18;
    } catch (e) {
      console.error('Error placing paddle:', e);
    }
  }

  // Level configurations for 10 levels with progressive difficulty
  const LEVEL_CONFIGS = [
    { pattern: 'simple', hp: 1, ballSpeed: 1.0, meteorChance: 0.15 }, // Level 1
    { pattern: 'rows', hp: 2, ballSpeed: 1.1, meteorChance: 0.18 }, // Level 2
    { pattern: 'checkerboard', hp: 2, ballSpeed: 1.2, meteorChance: 0.20 }, // Level 3
    { pattern: 'diamond', hp: 3, ballSpeed: 1.3, meteorChance: 0.22 }, // Level 4
    { pattern: 'cross', hp: 3, ballSpeed: 1.4, meteorChance: 0.25 }, // Level 5
    { pattern: 'spiral', hp: 4, ballSpeed: 1.5, meteorChance: 0.28 }, // Level 6
    { pattern: 'fortress', hp: 4, ballSpeed: 1.6, meteorChance: 0.30 }, // Level 7
    { pattern: 'maze', hp: 5, ballSpeed: 1.7, meteorChance: 0.32 }, // Level 8
    { pattern: 'pyramid', hp: 5, ballSpeed: 1.8, meteorChance: 0.35 }, // Level 9
    { pattern: 'chaos', hp: 6, ballSpeed: 2.0, meteorChance: 0.40 }  // Level 10
  ];
  
  // Power-up tracking
  let powerupsUsedThisGame = 0;
  const MAX_POWERUPS_PER_GAME = 3;

  function spawnLevel(level) {
    try {
      world.blocks.length = 0;
      const config = LEVEL_CONFIGS[Math.min(level - 1, LEVEL_CONFIGS.length - 1)];
      
      // Better block sizing for desktop and mobile
      const isDesktop = state.width >= 600;
      let blockSize, cols, gap, actualBlockSize;
      
      if (isDesktop) {
        // Desktop: optimal block size for 600px game area
        cols = 12; // Fixed columns for consistent gameplay
        blockSize = Math.floor((state.width - 40) / cols);
        gap = 3;
        actualBlockSize = blockSize - gap;
      } else {
        // Mobile: responsive sizing
        const maxCols = Math.floor(state.width / 50);
        cols = Math.min(8, maxCols);
        blockSize = Math.floor((state.width - 40) / cols);
        gap = 4;
        actualBlockSize = blockSize - gap;
      }
      
      const yStart = 70;
      
      // Generate pattern based on level configuration
      const pattern = generateBlockPattern(config.pattern, cols, level);
      
      pattern.forEach((row, r) => {
        row.forEach((shouldPlace, c) => {
          if (shouldPlace) {
            const x = 20 + c * blockSize + gap / 2;
            const y = yStart + r * blockSize + gap / 2;
            const hp = config.hp; // Standardized HP - no random variation
            const scratchSeed = Math.floor((x + y + level * 131) % 2147483647);
            
            world.blocks.push({ 
              x, y, 
              w: actualBlockSize, 
              h: actualBlockSize, // Square blocks
              type: 'rect', 
              hp, 
              maxHp: hp, 
              crack: 0, 
              scratchSeed,
              level: level,
              hitEffect: 0 // For realistic shading
            });
          }
        });
      });
      
      // Update ball speed based on level and selected speed
      world.currentBallSpeed = BALL_SPEED * config.ballSpeed * SPEED_MULTIPLIERS[selectedSpeed];
      world.levelConfig = config;
      
    } catch (e) {
      console.error('Error spawning level:', e);
    }
  }
  
  function generateBlockPattern(patternType, cols, level) {
    const rows = Math.min(8, 4 + Math.floor(level / 2));
    const pattern = Array(rows).fill().map(() => Array(cols).fill(false));
    
    switch (patternType) {
      case 'simple':
        for (let r = 0; r < 3; r++) {
          for (let c = 2; c < cols - 2; c++) {
            pattern[r][c] = true;
          }
        }
        break;
        
      case 'rows':
        for (let r = 0; r < 4; r++) {
          for (let c = 1; c < cols - 1; c++) {
            if (r % 2 === 0 || c % 2 === 1) pattern[r][c] = true;
          }
        }
        break;
        
      case 'checkerboard':
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < cols; c++) {
            if ((r + c) % 2 === 0) pattern[r][c] = true;
          }
        }
        break;
        
      case 'diamond':
        const centerR = Math.floor(rows / 2);
        const centerC = Math.floor(cols / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
            if (dist <= 3 && dist >= 1) pattern[r][c] = true;
          }
        }
        break;
        
      case 'cross':
        const midR = Math.floor(rows / 2);
        const midC = Math.floor(cols / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (r === midR || c === midC || Math.abs(r - midR) === Math.abs(c - midC)) {
              pattern[r][c] = true;
            }
          }
        }
        break;
        
      case 'spiral':
        let x = 0, y = 0, dx = 1, dy = 0;
        for (let i = 0; i < Math.min(30, rows * cols / 2); i++) {
          if (x >= 0 && x < cols && y >= 0 && y < rows) {
            pattern[y][x] = true;
          }
          if (x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows || 
              (x + dx >= 0 && x + dx < cols && y + dy >= 0 && y + dy < rows && pattern[y + dy][x + dx])) {
            [dx, dy] = [-dy, dx]; // Turn right
          }
          x += dx; y += dy;
        }
        break;
        
      case 'fortress':
        // Outer walls
        for (let c = 0; c < cols; c++) {
          pattern[0][c] = true;
          if (rows > 3) pattern[3][c] = true;
        }
        for (let r = 1; r < Math.min(4, rows); r++) {
          pattern[r][0] = true;
          pattern[r][cols - 1] = true;
          if (cols > 4) {
            pattern[r][2] = true;
            pattern[r][cols - 3] = true;
          }
        }
        break;
        
      case 'maze':
        // Create maze-like pattern
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((r % 2 === 0 && c % 3 !== 1) || (c % 2 === 0 && r % 3 !== 1)) {
              pattern[r][c] = true;
            }
          }
        }
        break;
        
      case 'pyramid':
        for (let r = 0; r < Math.min(6, rows); r++) {
          const width = Math.min(cols, 2 * r + 3);
          const start = Math.floor((cols - width) / 2);
          for (let c = start; c < start + width; c++) {
            pattern[r][c] = true;
          }
        }
        break;
        
      case 'chaos':
        // Random but structured chaos
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const noise = Math.sin(r * 0.7 + c * 0.5 + level) * Math.cos(c * 0.3 + r * 0.8);
            if (noise > -0.3) pattern[r][c] = true;
          }
        }
        break;
    }
    
    return pattern;
  }

  // Damage visuals
  function hpColor(hp, maxHp) {
    const t = hp / maxHp;
    // green -> yellow -> red
    if (t > 0.66) return '#60ff9f';
    if (t > 0.33) return '#ffcc66';
    return '#ff6b6b';
  }

  // Powerups
  function dropPowerup(x, y) {
    // Only drop powerups if we haven't reached the limit
    if (powerupsUsedThisGame >= MAX_POWERUPS_PER_GAME) return;
    
    // Much lower chance, only rockets now
    if (Math.random() < 0.05) {
      world.powerups.push({ x, y, vy: 120, kind: 'shooter', active: true });
    }
  }

  function collectPowerup(p) {
    powerupsUsedThisGame++;
    if (p.kind === 'shooter') {
      world.shooterUntil = Math.max(world.shooterUntil, now()) + 6000;
    }
    // Removed meteor power-up functionality - only rockets now
  }

  // Particles
  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const p = particlePool.acquire();
      p.x = x; p.y = y;
      p.vx = rand(-120, 120); p.vy = rand(-220, -40);
      p.life = 500 + Math.random() * 500;
      p.color = color; p.size = rand(1.5, 3.5);
      p.active = true;
      world.particles.push(p);
    }
  }

  // Init
  placePaddle();
  resetBall();
  spawnLevel(world.level);

  // Score/Combo
  function addScore(base) {
    const t = now();
    if (t - world.lastHitAt < MAX_COMBO_TIME) {
      world.combo = Math.min(8, world.combo + 1);
    } else {
      world.combo = 1;
    }
    world.lastHitAt = t;
    world.score += base * world.combo;
  }

  // Collisions
  function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  // Emit multiple upward rocks (meteors) from a point
  function spawnRockBurst(x, y, countMin = 3, countMax = 6) {
    const n = Math.floor(rand(countMin, countMax + 1));
    for (let i = 0; i < n; i++) {
      const m = meteorPool.acquire();
      m.x = clamp(x + rand(-10, 10), 8, state.width - 8);
      m.y = y;
      m.vy = METEOR_SPEED * rand(0.9, 1.3);
      m.active = true;
      world.meteors.push(m);
    }
  }

  // Update
  let lastTime = now();
  function update() {
    try {
      const t = now();
      const dt = Math.min(32, t - lastTime) / 1000; // clamp dt for stability
      lastTime = t;

      if (!state.running || state.paused) return;

      // Smooth paddle movement towards input.x (only when cursor is inside game area)
      if (input.isInsideGameArea) {
        const targetX = clamp(input.x - world.paddleW * 0.5, 0, state.width - world.paddleW);
        const follow = state.mode === 'playing' ? 25 : 20; // Slightly more responsive during gameplay
        world.paddleX += (targetX - world.paddleX) * Math.min(1, follow * dt);
      }
      world.paddleY = state.height - world.paddleH - 18;

      // Ball physics and walls
      if (world.ballOnPaddle) {
        // Keep ball on paddle during aiming
        world.ballX = world.paddleX + world.paddleW * 0.5;
        world.ballY = world.paddleY - state.ballR - 2;
      } else {
        // Normal ball physics when launched
        world.ballX += world.ballVX * dt;
        world.ballY += world.ballVY * dt;
        if (world.ballX < state.ballR) { world.ballX = state.ballR; world.ballVX *= -1; }
        if (world.ballX > state.width - state.ballR) { world.ballX = state.width - state.ballR; world.ballVX *= -1; }
        if (world.ballY < state.ballR) { world.ballY = state.ballR; world.ballVY *= -1; }
        if (world.ballY > state.height + 40) { // miss -> restart level
          restartLevel();
          return;
        }
      }

      // Paddle bounce (only when ball is not on paddle)
      if (!world.ballOnPaddle && circleRectOverlap(world.ballX, world.ballY, state.ballR, world.paddleX, world.paddleY, world.paddleW, world.paddleH)) {
        world.ballY = world.paddleY - state.ballR - 0.1;
        // reflect and add spin based on hit position
        const hit = (world.ballX - (world.paddleX + world.paddleW * 0.5)) / (world.paddleW * 0.5);
        const speed = Math.hypot(world.ballVX, world.ballVY);
        const angle = -Math.PI * 0.25 - hit * 0.55; // steerable up to ~±32°
        world.ballVX = Math.cos(angle) * speed;
        world.ballVY = Math.sin(angle) * speed;
      }

      // Blocks collisions
      for (let i = world.blocks.length - 1; i >= 0; i--) {
        const b = world.blocks[i];
        if (!circleRectOverlap(world.ballX, world.ballY, state.ballR, b.x, b.y, b.w, b.h)) continue;
        // simple collision response: reflect by deciding axis of minimum penetration
        const prevX = world.ballX - world.ballVX * dt;
        const prevY = world.ballY - world.ballVY * dt;
        const hitX = prevX < b.x || prevX > b.x + b.w;
        const hitY = prevY < b.y || prevY > b.y + b.h;
        if (hitX) world.ballVX *= -1; else world.ballVY *= -1;

        b.hp -= 1;
        b.crack = Math.min(1, b.crack + 0.34);
        b.hitEffect = 1.0; // Add hit effect for realistic shading
        addScore(10);
        burst(world.ballX, world.ballY, hpColor(b.hp, b.maxHp));
        // chance to burst extra rocks upward when a brick is struck by the ball
        const meteorChance = world.levelConfig ? world.levelConfig.meteorChance : 0.18;
        if (Math.random() < meteorChance) {
          spawnRockBurst(b.x + b.w * 0.5, b.y + b.h * 0.5, 3, 5);
        }
        if (b.hp <= 0) {
          dropPowerup(b.x + b.w * 0.5, b.y + b.h * 0.5);
          world.blocks.splice(i, 1);
        }
      }

      // Bullets (auto when shooter active)
      if (world.shooterUntil > t && t - world.lastBulletAt > 120) {
        world.lastBulletAt = t;
        const b = bulletPool.acquire();
        b.x = world.paddleX + world.paddleW * 0.5;
        b.y = world.paddleY - 6;
        b.vy = BULLET_SPEED;
        b.life = 900;
        b.active = true;
        world.bullets.push(b);
      }
      for (let i = world.bullets.length - 1; i >= 0; i--) {
        const blt = world.bullets[i];
        blt.y += blt.vy * dt;
        blt.life -= dt * 1000;
        if (blt.y < -20 || blt.life <= 0) { world.bullets.splice(i,1); blt.active=false; bulletPool.release(blt); continue; }
        // bullet vs blocks
        for (let j = world.blocks.length - 1; j >= 0; j--) {
          const b = world.blocks[j];
          if (blt.x >= b.x && blt.x <= b.x + b.w && blt.y >= b.y && blt.y <= b.y + b.h) {
            b.hp -= 1; b.crack = Math.min(1, b.crack + 0.5);
            addScore(6);
            burst(blt.x, blt.y, '#3bd1ff');
            if (Math.random() < 0.12) {
              spawnRockBurst(b.x + b.w * 0.5, b.y + b.h * 0.5, 2, 4);
            }
            if (b.hp <= 0) { dropPowerup(b.x + b.w*0.5, b.y + b.h*0.5); world.blocks.splice(j,1); }
            world.bullets.splice(i,1); blt.active=false; bulletPool.release(blt);
            break;
          }
        }
      }

      // Meteors
      for (let i = world.meteors.length - 1; i >= 0; i--) {
        const m = world.meteors[i];
        m.y += m.vy * dt;
        if (m.y < -40) { world.meteors.splice(i,1); m.active=false; meteorPool.release(m); continue; }
        for (let j = world.blocks.length - 1; j >= 0; j--) {
          const b = world.blocks[j];
          if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
            b.hp -= 1; b.crack = Math.min(1, b.crack + 0.5);
            addScore(12);
            burst(m.x, m.y, '#ff6b6b');
            if (b.hp <= 0) { dropPowerup(b.x + b.w*0.5, b.y + b.h*0.5); world.blocks.splice(j,1); }
            world.meteors.splice(i,1); m.active=false; meteorPool.release(m);
            break;
          }
        }
      }

      // Powerups fall and collect
      for (let i = world.powerups.length - 1; i >= 0; i--) {
        const p = world.powerups[i];
        p.y += p.vy * dt;
        if (p.y > state.height + 30) { world.powerups.splice(i,1); continue; }
        if (p.x >= world.paddleX && p.x <= world.paddleX + world.paddleW && p.y >= world.paddleY && p.y <= world.paddleY + world.paddleH) {
          collectPowerup(p);
          world.powerups.splice(i,1);
        }
      }

      // Particles
      for (let i = world.particles.length - 1; i >= 0; i--) {
        const p = world.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; // gravity
        p.life -= dt * 1000;
        if (p.life <= 0) { world.particles.splice(i,1); p.active=false; particlePool.release(p); }
      }
      
      // Update block hit effects (fade over time)
      for (const b of world.blocks) {
        if (b.hitEffect > 0) {
          b.hitEffect = Math.max(0, b.hitEffect - dt * 3); // Fade over ~0.33 seconds
        }
      }

      // Level progression: show overlay for Next Level or Game Complete
      if (world.blocks.length === 0 && state.mode === 'playing') {
        if (world.level >= 10) {
          // Game completed!
          state.mode = 'game_complete';
          state.running = false;
          overlayTitle.textContent = '🎉 Congratulations! 🎉';
          overlayText.textContent = `You've completed all 10 levels! Final Score: ${world.score}`;
          btnStart.textContent = 'Play Again';
          overlay.classList.remove('hidden');
        } else {
          state.mode = 'level_complete';
          state.running = false;
          overlayTitle.textContent = `Level ${world.level} Complete!`;
          overlayText.textContent = `Great job! Score: ${world.score}. Ready for Level ${world.level + 1}?`;
          btnStart.textContent = 'Next Level';
          overlay.classList.remove('hidden');
        }
      }

      // Update HUD
      scoreEl.textContent = `Score: ${world.score}`;
      comboEl.textContent = `Combo x${world.combo}`;
    } catch (e) {
      console.error('Error in update loop:', e);
    }
  }

  // Render
  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  
  // Color manipulation helpers for realistic shading
  function lightenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.floor(255 * amount));
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.floor(255 * amount));
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.floor(255 * amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  function darkenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.floor(255 * amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.floor(255 * amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.floor(255 * amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function render() {
    try {
      if (!state.running) return;
      
      // Clear entire canvas
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Apply offset for centering on desktop
      ctx.save();
      ctx.translate(state.offsetX, 0);
      
      // Draw game area background on desktop
      if (state.offsetX > 0) {
        ctx.fillStyle = 'rgba(18, 24, 38, 0.3)';
        ctx.fillRect(0, 0, state.width, state.height);
      }

      // Background grid subtle
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = '#1a2738';
      for (let y = 60; y < state.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.width, y); ctx.stroke();
      }
      ctx.restore();

      // Paddle (skateboard)
      ctx.fillStyle = '#9aa0a6';
      drawRoundedRect(world.paddleX, world.paddleY, world.paddleW, world.paddleH, PADDLE_RADIUS);
      ctx.fill();
      // wheels
      ctx.fillStyle = '#2d333b';
      ctx.beginPath(); ctx.arc(world.paddleX + 16, world.paddleY + world.paddleH, 6, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(world.paddleX + world.paddleW - 16, world.paddleY + world.paddleH, 6, 0, Math.PI*2); ctx.fill();

      // Ball (metallic radial gradient)
      const g = ctx.createRadialGradient(world.ballX - 4, world.ballY - 4, 2, world.ballX, world.ballY, state.ballR);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, '#d0d5db');
      g.addColorStop(1, '#8a94a6');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(world.ballX, world.ballY, state.ballR, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#c0c7d1'; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1;
      
      // Aiming line when ball is on paddle
      if (world.ballOnPaddle && state.mode === 'aiming') {
        const aimLength = 80;
        const endX = world.ballX + Math.cos(world.aimAngle) * aimLength;
        const endY = world.ballY + Math.sin(world.aimAngle) * aimLength;
        
        // Draw aiming line with gradient
        const aimGradient = ctx.createLinearGradient(world.ballX, world.ballY, endX, endY);
        aimGradient.addColorStop(0, 'rgba(59, 209, 255, 0.8)');
        aimGradient.addColorStop(1, 'rgba(59, 209, 255, 0.2)');
        
        ctx.strokeStyle = aimGradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(world.ballX, world.ballY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
        
        // Draw arrow at the end
        const arrowSize = 8;
        const arrowAngle = world.aimAngle;
        const arrowX1 = endX - Math.cos(arrowAngle - 0.5) * arrowSize;
        const arrowY1 = endY - Math.sin(arrowAngle - 0.5) * arrowSize;
        const arrowX2 = endX - Math.cos(arrowAngle + 0.5) * arrowSize;
        const arrowY2 = endY - Math.sin(arrowAngle + 0.5) * arrowSize;
        
        ctx.fillStyle = '#3bd1ff';
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(arrowX1, arrowY1);
        ctx.lineTo(arrowX2, arrowY2);
        ctx.closePath();
        ctx.fill();
        
        // Instruction text
        ctx.fillStyle = '#e6edf3';
        ctx.font = '16px Montserrat';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.8;
        ctx.fillText('Aim and tap to launch!', state.width / 2, state.height - 60);
        ctx.globalAlpha = 1;
      }

      // Blocks with realistic shading
      for (const b of world.blocks) {
        ctx.save();
        
        // Base color with health-based tinting
        const healthRatio = b.hp / b.maxHp;
        const baseColor = hpColor(b.hp, b.maxHp);
        
        // Create gradient for 3D effect
        const gradient = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
        gradient.addColorStop(0, lightenColor(baseColor, 0.3));
        gradient.addColorStop(0.5, baseColor);
        gradient.addColorStop(1, darkenColor(baseColor, 0.4));
        
        ctx.fillStyle = gradient;
        drawRoundedRect(b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        
        // Hit effect - white flash that fades
        if (b.hitEffect > 0) {
          ctx.globalAlpha = b.hitEffect * 0.6;
          ctx.fillStyle = '#ffffff';
          drawRoundedRect(b.x, b.y, b.w, b.h, 6);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        
        // Top highlight for 3D effect
        ctx.fillStyle = lightenColor(baseColor, 0.5);
        ctx.globalAlpha = 0.7;
        drawRoundedRect(b.x + 2, b.y + 2, b.w - 4, Math.max(2, b.h * 0.2), 4);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Bottom shadow for depth
        ctx.fillStyle = darkenColor(baseColor, 0.6);
        ctx.globalAlpha = 0.5;
        drawRoundedRect(b.x + 2, b.y + b.h - Math.max(2, b.h * 0.2), b.w - 4, Math.max(2, b.h * 0.2), 4);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Subtle stone texture
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#0b0e14';
        for (let gx = b.x + 3; gx < b.x + b.w - 3; gx += 8) {
          for (let gy = b.y + 3; gy < b.y + b.h - 3; gy += 8) {
            ctx.fillRect(gx + (gy % 4), gy + (gx % 4), 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        
        // Edge stroke
        ctx.strokeStyle = darkenColor(baseColor, 0.8);
        ctx.lineWidth = 1;
        drawRoundedRect(b.x, b.y, b.w, b.h, 6);
        ctx.stroke();
        
        // Damage cracks: more visible with more damage
        const hitsTaken = b.maxHp - b.hp;
        const scratchesToShow = hitsTaken * 3;
        if (scratchesToShow > 0) {
          function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}};
          const rnd = mulberry32(b.scratchSeed || 1);
          ctx.strokeStyle = '#2d333b';
          ctx.globalAlpha = 0.8;
          
          for (let s = 0; s < scratchesToShow; s++) {
            const px = b.x + 4 + rnd() * (b.w - 8);
            const py = b.y + 4 + rnd() * (b.h - 8);
            const len = 4 + rnd() * 8;
            const ang = (rnd() * Math.PI * 2);
            const ex = px + Math.cos(ang) * len;
            const ey = py + Math.sin(ang) * len;
            ctx.lineWidth = 1 + rnd() * 1.5;
            ctx.beginPath(); 
            ctx.moveTo(px, py); 
            ctx.lineTo(ex, ey); 
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        
        ctx.restore();
      }

      // Bullets with trail
      for (const blt of world.bullets) {
        const grad = ctx.createLinearGradient(blt.x, blt.y - 16, blt.x, blt.y);
        grad.addColorStop(0, 'rgba(59, 209, 255, 0)');
        grad.addColorStop(1, 'rgba(59, 209, 255, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(blt.x - 2, blt.y - 16, 4, 16);
      }

      // Meteors
      for (const m of world.meteors) {
        const grad = ctx.createLinearGradient(m.x, m.y - 20, m.x, m.y + 4);
        grad.addColorStop(0, 'rgba(255,107,107,0)');
        grad.addColorStop(1, 'rgba(255,107,107,1)');
        ctx.fillStyle = grad;
        ctx.fillRect(m.x - 3, m.y - 20, 6, 24);
      }

      // Powerups
      for (const p of world.powerups) {
        ctx.fillStyle = p.kind === 'shooter' ? '#3bd1ff' : '#ff6b6b';
        drawRoundedRect(p.x - 10, p.y - 10, 20, 20, 6);
        ctx.fill();
      }

      // Particles
      for (const p of world.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 800));
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }
      
      // Restore transform (close the translation offset)
      ctx.restore();
    } catch (e) {
      console.error('Error in render:', e);
    }
  }

  // Game loop
  function loop() {
    try {
      update();
      render();
      requestAnimationFrame(loop);
    } catch (e) {
      console.error('Error in game loop:', e);
    }
  }

  // Pause/Resume
  btnPause.addEventListener('click', () => {
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? '▶' : '❚❚';
  });
  // Keyboard pause (Space or P)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key.toLowerCase() === 'p') {
      e.preventDefault();
      state.paused = !state.paused;
      btnPause.textContent = state.paused ? '▶' : '❚❚';
    }
  });

  // Sound placeholder toggle
  let soundOn = true;
  btnSound.addEventListener('click', () => {
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? '🔊' : '🔈';
  });

  // Speed selector event handlers
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSpeed = btn.dataset.speed;
      localStorage.setItem('sbs_speed', selectedSpeed);
      updateSpeedButtons();
      
      // Update current ball speed if game is running
      if (state.running && world.levelConfig) {
        world.currentBallSpeed = BALL_SPEED * world.levelConfig.ballSpeed * SPEED_MULTIPLIERS[selectedSpeed];
      }
    });
  });

  // Start
  function startGame() {
    try {
      // High scores
      const best = Number(localStorage.getItem('sbs_best') || '0');
      const last = Number(localStorage.getItem('sbs_last') || '0');
      bestEl.textContent = String(best);
      lastEl.textContent = String(last);

      overlay.classList.add('hidden');
      state.running = true;
      state.paused = false;
      state.mode = 'aiming'; // Start in aiming mode
      btnPause.textContent = '❚❚';
      
      // Reset ball to paddle
      resetBall();
    } catch (e) {
      console.error('Error starting game:', e);
    }
  }
  function resetWorld() {
    try {
      world.bullets.length = 0;
      world.meteors.length = 0;
      world.particles.length = 0;
      world.powerups.length = 0;
      world.combo = 1;
      world.shooterUntil = 0;
      world.meteorUntil = 0;
      world.lastBulletAt = 0;
      placePaddle();
      resetBall();
    } catch (e) {
      console.error('Error resetting world:', e);
    }
  }
  function restartLevel() {
    try {
      overlayTitle.textContent = `Level ${world.level} - Try Again`;
      overlayText.textContent = 'You missed the ball. Tap Restart to try this level again!';
      btnStart.textContent = 'Restart';
      overlay.classList.remove('hidden');
      state.running = false;
      state.paused = false;
      state.mode = 'level_restart';
    } catch (e) {
      console.error('Error restarting level:', e);
    }
  }
  
  function endGame() {
    try {
      // save scores
      const best = Number(localStorage.getItem('sbs_best') || '0');
      if (world.score > best) localStorage.setItem('sbs_best', String(world.score));
      localStorage.setItem('sbs_last', String(world.score));
      bestEl.textContent = String(Number(localStorage.getItem('sbs_best') || '0'));
      lastEl.textContent = String(world.score);
      overlayTitle.textContent = 'Game Over';
      overlayText.textContent = 'You missed the ball. Tap Replay to try again!';
      btnStart.textContent = 'Replay';
      overlay.classList.remove('hidden');
      state.running = false;
      state.paused = false;
      state.mode = 'game_over';
    } catch (e) {
      console.error('Error ending game:', e);
    }
  }
  btnStart.addEventListener('click', () => {
    try {
      if (state.mode === 'level_complete') {
        world.level += 1;
        levelEl.textContent = `Level ${world.level}`;
        btnStart.textContent = 'Play';
        updateLevelProgress(world.level);
        updateDifficultyIndicator(world.level);
        overlay.classList.add('hidden');
        resetWorld();
        spawnLevel(world.level);
        startGame();
        return;
      }
      if (state.mode === 'level_restart') {
        // Restart current level without losing progress
        btnStart.textContent = 'Play';
        overlay.classList.add('hidden');
        resetWorld();
        spawnLevel(world.level); // Same level
        startGame();
        return;
      }
      if (state.mode === 'game_complete') {
        // Reset to level 1 for replay
        world.score = 0;
        world.level = 1;
        levelEl.textContent = 'Level 1';
        btnStart.textContent = 'Play';
        overlay.classList.add('hidden');
        resetWorld();
        spawnLevel(1);
        startGame();
        return;
      }
      // regular start/reset
      overlayTitle.textContent = 'Skate Ball Smash';
      overlayText.textContent = 'Aim with your finger/mouse, then tap to launch the ball!';
      world.score = 0; world.level = 1; levelEl.textContent = 'Level 1';
      powerupsUsedThisGame = 0; // Reset powerup counter
      updateLevelProgress(1);
      updateDifficultyIndicator(1);
      resetWorld(); spawnLevel(1);
      startGame();
    } catch (e) {
      console.error('Error handling start button:', e);
    }
  });

  // Prevent context menu on long press (mobile)
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    return false;
  });
  
  // Prevent double-tap zoom on mobile
  let lastTapTime = 0;
  canvas.addEventListener('touchend', e => {
    const currentTime = now();
    if (currentTime - lastTapTime < 300) {
      e.preventDefault();
    }
    lastTapTime = currentTime;
  }, { passive: false });

  // Save scores on unload
  window.addEventListener('beforeunload', () => {
    try {
      const best = Number(localStorage.getItem('sbs_best') || '0');
      localStorage.setItem('sbs_best', String(Math.max(best, world.score)));
      localStorage.setItem('sbs_last', String(world.score));
    } catch (e) {
      console.warn('Error saving scores:', e);
    }
  });

  // Pause when tab hidden, resume when visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.paused = true;
      btnPause.textContent = '▶';
    }
  });

  // Orientation change / resize adjust
  window.addEventListener('orientationchange', () => {
    try {
      resizeCanvas();
      placePaddle();
    } catch (e) {
      console.error('Error handling orientation change:', e);
    }
  });

  // Initialize game state
  function initGame() {
    try {
      input.x = state.width * 0.5;
      world.score = 0;
      world.level = 1;
      levelEl.textContent = 'Level 1';
      placePaddle();
      resetBall();
      spawnLevel(1);
      startGame();
    } catch (e) {
      console.error('Error initializing game:', e);
    }
  }

  // Start game loop only after everything is ready
  try {
    requestAnimationFrame(loop);
    // Auto-start after a short delay to ensure everything is loaded
    setTimeout(initGame, 100);
  } catch (e) {
    console.error('Error starting game loop:', e);
  }
})();


