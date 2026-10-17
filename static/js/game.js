/**
 * Motor Racing Game Engine
 * ========================
 * A full-featured 2D car dodging game on HTML5 Canvas.
 *
 * Features:
 *  - 3-lane road (Left / Centre / Right)
 *  - Arrow key controls with smooth lane transitions
 *  - Multiple opponent car types (5 colours)
 *  - Fuel system (pickups, gauge)
 *  - Coin collection for bonus score
 *  - Increasing speed + level progression
 *  - Particle explosion on collision
 *  - Collision detection (AABB)
 *  - Score = survival time + cars dodged bonus + coin bonus
 *  - Neon road with animated lane dashes
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const CANVAS_W     = 400;
const CANVAS_H     = 600;
const LANE_COUNT   = 3;
const ROAD_LEFT    = 60;   // pixels from canvas left where road starts
const ROAD_RIGHT   = 340;  // pixels from canvas left where road ends
const ROAD_W       = ROAD_RIGHT - ROAD_LEFT;
const LANE_W       = ROAD_W / LANE_COUNT;

// Derived lane centre X positions [0,1,2]
const LANE_X = [
  ROAD_LEFT + LANE_W * 0.5,
  ROAD_LEFT + LANE_W * 1.5,
  ROAD_LEFT + LANE_W * 2.5,
];

// Player car dimensions
const PLAYER_W = 42;
const PLAYER_H = 72;

// Opponent car dimensions
const OPP_W    = 40;
const OPP_H    = 68;

// Pickup (coin / fuel) dimensions
const PICKUP_R = 14;

// Physics
const INITIAL_SPEED   = 3.0;   // px/frame for objects coming toward player
const SPEED_INCREMENT = 0.08;  // increase per level
const LEVEL_SCORE_GAP = 800;   // score gap between levels

// Fuel
const MAX_FUEL        = 100;
const FUEL_DRAIN_RATE = 0.04;  // per frame
const FUEL_GAIN       = 30;    // per pickup

// Scoring
const COIN_VALUE       = 50;
const DODGE_BONUS      = 10;
const TIME_SCORE_RATE  = 0.05; // per frame (accumulated as float, floored)

// Spawn intervals (in frames)
const OPP_SPAWN_INTERVAL    = 80;
const PICKUP_SPAWN_INTERVAL = 150;

// Neon car palettes (body, window, accent)
const CAR_PALETTES = [
  { body: '#00cfff', window: '#003040', accent: '#80e8ff' }, // cyan
  { body: '#ff3366', window: '#300010', accent: '#ff99bb' }, // red
  { body: '#a855f7', window: '#180030', accent: '#d8a0ff' }, // purple
  { body: '#ff8c00', window: '#2a1500', accent: '#ffc060' }, // orange
  { body: '#00ff88', window: '#003020', accent: '#80ffcc' }, // green
];

// ─── Utility helpers ──────────────────────────────────────────────────────────
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const choose = arr => arr[randInt(0, arr.length - 1)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * AABB collision test between two rectangle-like objects.
 * Each must have { x (centre), y (centre), w, h }.
 */
function rectsOverlap(a, b, margin = 4) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - margin &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 - margin
  );
}

// ─── Particle System ─────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = rand(-5, 5);
    this.vy = rand(-8, 2);
    this.alpha = 1;
    this.size = rand(3, 8);
    this.color = color;
    this.decay = rand(0.02, 0.05);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.25; // gravity
    this.alpha -= this.decay;
    this.size *= 0.97;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  get alive() { return this.alpha > 0; }
}

function spawnExplosion(particles, x, y, colors) {
  const count = 30 + randInt(0, 20);
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, choose(colors)));
  }
}

// ─── Road Renderer ───────────────────────────────────────────────────────────
class Road {
  constructor() {
    this.dashOffset = 0;
    this.dashLen    = 40;
    this.dashGap    = 28;
    this.dashSpeed  = 0; // set externally each frame
  }

  update(speed) {
    this.dashOffset = (this.dashOffset + speed) % (this.dashLen + this.dashGap);
  }

  draw(ctx) {
    // Road base
    ctx.fillStyle = '#141824';
    ctx.fillRect(ROAD_LEFT, 0, ROAD_W, CANVAS_H);

    // Soft vignette on road edges
    const leftGrad = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_LEFT + 18, 0);
    leftGrad.addColorStop(0, 'rgba(5,8,16,0.6)');
    leftGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(ROAD_LEFT, 0, 18, CANVAS_H);

    const rightGrad = ctx.createLinearGradient(ROAD_RIGHT - 18, 0, ROAD_RIGHT, 0);
    rightGrad.addColorStop(0, 'transparent');
    rightGrad.addColorStop(1, 'rgba(5,8,16,0.6)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(ROAD_RIGHT - 18, 0, 18, CANVAS_H);

    // Road edges (solid neon lines)
    ctx.strokeStyle = '#00cfff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00cfff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT, 0); ctx.lineTo(ROAD_LEFT, CANVAS_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, CANVAS_H);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lane dividers (dashed)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([this.dashLen, this.dashGap]);
    ctx.lineDashOffset = -this.dashOffset;

    for (let i = 1; i < LANE_COUNT; i++) {
      const lx = ROAD_LEFT + LANE_W * i;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, CANVAS_H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Sidewalks
    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, ROAD_LEFT, CANVAS_H);
    ctx.fillRect(ROAD_RIGHT, 0, CANVAS_W - ROAD_RIGHT, CANVAS_H);

    // Sidewalk edge lines
    ctx.strokeStyle = 'rgba(0,207,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT - 8, 0); ctx.lineTo(ROAD_LEFT - 8, CANVAS_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ROAD_RIGHT + 8, 0); ctx.lineTo(ROAD_RIGHT + 8, CANVAS_H);
    ctx.stroke();
  }
}

// ─── Car Drawing Helpers ──────────────────────────────────────────────────────
/**
 * Draw a stylized top-down car.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx  centre x
 * @param {number} cy  centre y
 * @param {number} w   width
 * @param {number} h   height
 * @param {object} palette { body, window, accent }
 * @param {boolean} isPlayer  player gets extra glow + headlights
 * @param {boolean} flipped   opponent faces opposite direction
 */
function drawCar(ctx, cx, cy, w, h, palette, isPlayer = false, flipped = false) {
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.save();
  if (flipped) {
    ctx.translate(cx, cy);
    ctx.scale(1, -1);
    ctx.translate(-cx, -cy);
  }

  // Body glow
  if (isPlayer) {
    ctx.shadowColor = palette.body;
    ctx.shadowBlur = 18;
  }

  // Main body — rounded rect simulation
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  // Body gradient
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bodyGrad.addColorStop(0, palette.accent);
  bodyGrad.addColorStop(0.4, palette.body);
  bodyGrad.addColorStop(1, shadeColor(palette.body, -40));
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.shadowBlur = 0;

  // Windshield (top)
  ctx.fillStyle = palette.window;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 12);
  ctx.lineTo(x + w - 8, y + 12);
  ctx.lineTo(x + w - 10, y + 28);
  ctx.lineTo(x + 10, y + 28);
  ctx.closePath();
  ctx.fill();

  // Rear window (bottom)
  ctx.fillStyle = shadeColor(palette.window, 20);
  ctx.beginPath();
  ctx.moveTo(x + 8, y + h - 18);
  ctx.lineTo(x + w - 8, y + h - 18);
  ctx.lineTo(x + w - 12, y + h - 8);
  ctx.lineTo(x + 12, y + h - 8);
  ctx.closePath();
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#0a0c14';
  const wheelW = 8;
  const wheelH = 16;
  // front-left
  ctx.fillRect(x - 3, y + 10, wheelW, wheelH);
  // front-right
  ctx.fillRect(x + w - 5, y + 10, wheelW, wheelH);
  // rear-left
  ctx.fillRect(x - 3, y + h - 26, wheelW, wheelH);
  // rear-right
  ctx.fillRect(x + w - 5, y + h - 26, wheelW, wheelH);

  // Wheel rims
  ctx.fillStyle = palette.accent;
  ctx.beginPath(); ctx.arc(x + 1, y + 18, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w - 1, y + 18, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 1, y + h - 18, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w - 1, y + h - 18, 4, 0, Math.PI * 2); ctx.fill();

  if (isPlayer) {
    // Headlights
    ctx.fillStyle = '#ffffaa';
    ctx.shadowColor = '#ffffaa';
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(x + 10, y + 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 10, y + 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Tail-lights
    ctx.fillStyle = '#ff2244';
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 10;
    ctx.fillRect(x + 6, y + h - 5, 10, 4);
    ctx.fillRect(x + w - 16, y + h - 5, 10, 4);
    ctx.shadowBlur = 0;
  } else {
    // Headlights facing opposite (red taillights from player perspective)
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x + 10, y + 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 10, y + 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/** Simple colour shading utility (positive = lighter, negative = darker). */
function shadeColor(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = clamp(r + amount, 0, 255);
  g = clamp(g + amount, 0, 255);
  b = clamp(b + amount, 0, 255);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ─── Pickup Renderer ─────────────────────────────────────────────────────────
function drawCoin(ctx, x, y, r, frame) {
  const pulse = Math.sin(frame * 0.08) * 2;
  ctx.save();
  ctx.shadowColor = '#ffdd00';
  ctx.shadowBlur = 14 + pulse;

  // Outer ring
  ctx.strokeStyle = '#ffdd00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + pulse * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Inner fill
  const grad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, r);
  grad.addColorStop(0, '#fff5aa');
  grad.addColorStop(1, '#cc9900');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.fill();

  // $ symbol
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#664400';
  ctx.font = `bold ${r}px Orbitron, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', x, y + 1);

  ctx.restore();
}

function drawFuelPickup(ctx, x, y, r, frame) {
  const pulse = Math.sin(frame * 0.09) * 2;
  ctx.save();
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 14 + pulse;

  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + pulse * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  const grad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, r);
  grad.addColorStop(0, '#aaffdd');
  grad.addColorStop(1, '#006644');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#002211';
  ctx.font = `bold ${r * 0.85}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⛽', x, y + 1);

  ctx.restore();
}

// ─── Main Game State ─────────────────────────────────────────────────────────
/**
 * GameEngine manages all game state and the canvas render loop.
 * It communicates with the Vue app through callback functions.
 */
class GameEngine {
  constructor(canvas, callbacks) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.cbs     = callbacks; // { onScore, onFuel, onLevel, onCoins, onSpeed, onGameOver }

    this.road     = new Road();
    this.particles = [];

    this._resetState();
    this._bindKeys();
  }

  // ── Internals ─────────────────────────────────────────────────
  _resetState() {
    // Player
    this.player = {
      lane: 1,         // 0=left, 1=centre, 2=right
      x: LANE_X[1],
      y: CANVAS_H - 100,
      w: PLAYER_W,
      h: PLAYER_H,
      targetX: LANE_X[1],
      moving: false,
    };

    // Game metrics
    this.score        = 0;
    this.scoreFloat   = 0;
    this.level        = 1;
    this.fuel         = MAX_FUEL;
    this.coins        = 0;
    this.carsDodged   = 0;
    this.frame        = 0;
    this.speed        = INITIAL_SPEED;
    this.running      = false;
    this.crashed      = false;
    this.showCrash    = false;
    this.crashTimer   = 0;

    // Entity lists
    this.opponents = [];
    this.pickups   = [];
    this.particles = [];

    // Input state
    this.keyLeft  = false;
    this.keyRight = false;

    // Spawn counters
    this.oppTimer    = 0;
    this.pickupTimer = 0;
    this.nextOppInterval = OPP_SPAWN_INTERVAL;
  }

  _bindKeys() {
    this._onKeyDown = (e) => {
      if (!this.running) return;
      if (e.key === 'ArrowLeft'  && !this.keyLeft)  { this.keyLeft  = true; this._movePlayer(-1); }
      if (e.key === 'ArrowRight' && !this.keyRight) { this.keyRight = true; this._movePlayer( 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
    };
    this._onKeyUp = (e) => {
      if (e.key === 'ArrowLeft')  this.keyLeft  = false;
      if (e.key === 'ArrowRight') this.keyRight = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  _movePlayer(dir) {
    const newLane = clamp(this.player.lane + dir, 0, LANE_COUNT - 1);
    if (newLane !== this.player.lane) {
      this.player.lane    = newLane;
      this.player.targetX = LANE_X[newLane];
    }
  }

  // Mobile controls (called from Vue)
  moveLeft()  { if (this.running) this._movePlayer(-1); }
  moveRight() { if (this.running) this._movePlayer( 1); }

  // ── Lifecycle ─────────────────────────────────────────────────
  start() {
    this._resetState();
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  destroy() {
    this.stop();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }

  // ── Main Loop ─────────────────────────────────────────────────
  _loop() {
    if (!this.running) return;
    this._update();
    this._render();
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _update() {
    if (this.crashed) return;
    this.frame++;

    // ── Smooth player lane transition ──
    const dx = this.player.targetX - this.player.x;
    if (Math.abs(dx) > 0.5) {
      this.player.x += dx * 0.18;
    } else {
      this.player.x = this.player.targetX;
    }

    // ── Scoring (time-based) ──
    this.scoreFloat += TIME_SCORE_RATE * this.speed;
    const newScore = this.score + Math.floor(this.scoreFloat);
    this.scoreFloat -= Math.floor(this.scoreFloat);
    this.score = newScore;

    // ── Level progression ──
    const newLevel = 1 + Math.floor(this.score / LEVEL_SCORE_GAP);
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.cbs.onLevel(this.level);
    }

    // ── Speed increase ──
    this.speed = INITIAL_SPEED + (this.level - 1) * SPEED_INCREMENT * 10
               + this.frame * 0.0005;
    this.cbs.onSpeed(Math.round(this.speed * 20));

    // ── Road animation ──
    this.road.update(this.speed);

    // ── Fuel drain ──
    this.fuel = Math.max(0, this.fuel - FUEL_DRAIN_RATE);
    this.cbs.onFuel(this.fuel);
    if (this.fuel <= 0) {
      this._triggerCrash();
      return;
    }

    // ── Spawn opponents ──
    this.oppTimer++;
    if (this.oppTimer >= this.nextOppInterval) {
      this.oppTimer = 0;
      this.nextOppInterval = Math.max(35, OPP_SPAWN_INTERVAL - (this.level - 1) * 8);
      this._spawnOpponent();
    }

    // ── Spawn pickups ──
    this.pickupTimer++;
    if (this.pickupTimer >= PICKUP_SPAWN_INTERVAL) {
      this.pickupTimer = 0;
      this._spawnPickup();
    }

    // ── Update opponents ──
    for (let i = this.opponents.length - 1; i >= 0; i--) {
      const opp = this.opponents[i];
      opp.y += this.speed;

      if (opp.y > CANVAS_H + OPP_H) {
        // Passed player safely
        this.opponents.splice(i, 1);
        this.carsDodged++;
        this.score += DODGE_BONUS;
        this.cbs.onScore(this.score);
        continue;
      }

      // Collision check with player
      if (rectsOverlap(this.player, opp)) {
        this._triggerCrash();
        return;
      }
    }

    // ── Update pickups ──
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.y += this.speed * 0.85;

      if (pk.y > CANVAS_H + PICKUP_R * 2) {
        this.pickups.splice(i, 1);
        continue;
      }

      // Check if player collects pickup
      const dist = Math.hypot(this.player.x - pk.x, this.player.y - pk.y);
      if (dist < PLAYER_W / 2 + PICKUP_R - 4) {
        this.pickups.splice(i, 1);
        if (pk.type === 'coin') {
          this.coins++;
          this.score += COIN_VALUE;
          this.cbs.onCoins(this.coins);
          this.cbs.onScore(this.score);
          this._spawnCoinBurst(pk.x, pk.y);
        } else {
          this.fuel = Math.min(MAX_FUEL, this.fuel + FUEL_GAIN);
          this.cbs.onFuel(this.fuel);
          this._spawnFuelBurst(pk.x, pk.y);
        }
      }
    }

    // ── Particles ──
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (!this.particles[i].alive) this.particles.splice(i, 1);
    }

    // ── Broadcast score ──
    this.cbs.onScore(this.score);
  }

  // ── Spawners ──────────────────────────────────────────────────
  _spawnOpponent() {
    // Avoid spawning in same lane as upcoming opponent if too close
    const recentLanes = this.opponents
      .filter(o => o.y < 120)
      .map(o => o.lane);

    let lane;
    let attempts = 0;
    do {
      lane = randInt(0, LANE_COUNT - 1);
      attempts++;
    } while (recentLanes.includes(lane) && attempts < 5);

    const palette = choose(CAR_PALETTES);

    this.opponents.push({
      lane,
      x: LANE_X[lane],
      y: -OPP_H,
      w: OPP_W,
      h: OPP_H,
      palette,
    });
  }

  _spawnPickup() {
    const lane = randInt(0, LANE_COUNT - 1);
    const type = Math.random() < 0.65 ? 'coin' : 'fuel';
    this.pickups.push({
      lane,
      x: LANE_X[lane],
      y: -PICKUP_R * 2,
      r: PICKUP_R,
      type,
    });
  }

  // ── Effects ───────────────────────────────────────────────────
  _spawnCoinBurst(x, y) {
    spawnExplosion(this.particles, x, y, ['#ffdd00', '#fff5aa', '#cc9900', '#ffffff']);
  }

  _spawnFuelBurst(x, y) {
    spawnExplosion(this.particles, x, y, ['#00ff88', '#aaffdd', '#00cc66', '#ffffff']);
  }

  _triggerCrash() {
    this.crashed  = true;
    this.running  = false;
    this.showCrash = true;
    spawnExplosion(
      this.particles,
      this.player.x,
      this.player.y,
      ['#ff3366', '#ff8800', '#ffdd00', '#ff99bb', '#ffffff']
    );
    // Let particles render for a moment before notifying
    const renderCrash = () => {
      this._render();
      this.particles.forEach(p => p.update());
      this.particles = this.particles.filter(p => p.alive);
      if (this.particles.length > 0) {
        requestAnimationFrame(renderCrash);
      } else {
        this.cbs.onGameOver({
          score: this.score,
          level: this.level,
          carsDodged: this.carsDodged,
          coins: this.coins,
        });
      }
    };
    setTimeout(renderCrash, 50);
  }

  // ── Render ────────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    // Sky background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, '#050810');
    skyGrad.addColorStop(1, '#0d1020');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Road
    this.road.draw(ctx);

    // Pickups
    this.pickups.forEach(pk => {
      if (pk.type === 'coin')  drawCoin(ctx, pk.x, pk.y, pk.r, this.frame);
      else                     drawFuelPickup(ctx, pk.x, pk.y, pk.r, this.frame);
    });

    // Opponents
    this.opponents.forEach(opp => {
      drawCar(ctx, opp.x, opp.y, opp.w, opp.h, opp.palette, false, true);
    });

    // Player car (player palette = neon blue)
    if (!this.crashed) {
      drawCar(ctx, this.player.x, this.player.y,
              this.player.w, this.player.h,
              { body: '#00cfff', window: '#002030', accent: '#a0eaff' },
              true, false);
    }

    // Particles
    this.particles.forEach(p => p.draw(ctx));

    // Speed-lines (motion blur effect at high speed)
    if (this.speed > 6) {
      const alpha = clamp((this.speed - 6) / 10, 0, 0.25);
      ctx.save();
      ctx.strokeStyle = `rgba(0,207,255,${alpha})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const lx = ROAD_LEFT + rand(10, ROAD_W - 10);
        const ly = rand(0, CANVAS_H);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + rand(-2, 2), ly + rand(20, 50));
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
