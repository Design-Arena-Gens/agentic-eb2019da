"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 960;
const HEIGHT = 600;

const BASE_UPGRADES = [
  {
    id: "rapid-fire",
    name: "Rapid Fire Injectors",
    description: "+25% fire rate, -10% weapon heat build-up",
    apply: (player) => {
      player.fireRate *= 1.25;
      player.weaponHeatDecay *= 1.1;
    }
  },
  {
    id: "plasma-rounds",
    name: "Plasma Shredders",
    description: "+30% projectile damage",
    apply: (player) => {
      player.bulletDamage *= 1.3;
    }
  },
  {
    id: "twin-barrel",
    name: "Twin Barrel Array",
    description: "+1 projectile, +10% spread",
    apply: (player) => {
      player.multiShot += 1;
      player.spread += 0.1;
    }
  },
  {
    id: "thruster-overdrive",
    name: "Thruster Overdrive",
    description: "+25% move speed, +20% dash distance",
    apply: (player) => {
      player.maxSpeed *= 1.25;
      player.dashDistance *= 1.2;
    }
  },
  {
    id: "nanite-armor",
    name: "Nanite Armor Plating",
    description: "+40 max hull, passive repair over time",
    apply: (player) => {
      player.maxHp += 40;
      player.hp += 40;
      player.passiveRegen += 1;
    }
  },
  {
    id: "flux-shield",
    name: "Flux Shield Matrix",
    description: "+60 shield, +30% recharge speed",
    apply: (player) => {
      player.maxShield += 60;
      player.shield += 60;
      player.shieldRechargeRate *= 1.3;
    }
  },
  {
    id: "quantum-crit",
    name: "Quantum Trigger",
    description: "+15% crit chance, +75% crit damage",
    apply: (player) => {
      player.critChance += 0.15;
      player.critMultiplier += 0.75;
    }
  },
  {
    id: "overclock-core",
    name: "Overclock Reactor",
    description: "+8% global cooldown reduction",
    apply: (player) => {
      player.fireRate *= 1.08;
      player.shieldRechargeDelay *= 0.92;
      player.dashCooldown *= 0.92;
    }
  },
  {
    id: "galactic-lotto",
    name: "Galactic Lottery",
    description: "Gain 200 credits, passive income +2/s",
    apply: (player) => {
      player.score += 200;
      player.creditIncome += 2;
    }
  },
  {
    id: "gravity-well",
    name: "Gravity Well Mines",
    description: "Fires gravity mines every 3s that slow enemies",
    apply: (player) => {
      player.supportSystems.gravityWell = true;
    }
  }
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandom(arr, count) {
  const pool = arr.slice();
  const picks = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

function initGame(context) {
  const stars = Array.from({ length: 200 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    depth: Math.random() * 0.9 + 0.1,
    twinkle: Math.random()
  }));

  return {
    ctx: context,
    player: createPlayer(),
    enemies: [],
    playerBullets: [],
    enemyBullets: [],
    particles: [],
    mines: [],
    stars,
    difficulty: 1,
    timeSinceStart: 0,
    spawnTimer: 0,
    eliteSpawnTimer: 12,
    paused: false,
    levelUpPending: false,
    lastUiSync: 0,
    lastMineFire: 0
  };
}

function createPlayer() {
  return {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    maxSpeed: 240,
    acceleration: 420,
    friction: 0.9,
    fireCooldown: 0,
    fireRate: 3,
    spread: 0.1,
    multiShot: 1,
    bulletSpeed: 520,
    bulletDamage: 30,
    critChance: 0.08,
    critMultiplier: 1.5,
    hp: 220,
    maxHp: 220,
    shield: 140,
    maxShield: 140,
    shieldRechargeRate: 32,
    shieldDelayTimer: 0,
    shieldRechargeDelay: 3,
    passiveRegen: 0,
    dashCooldown: 4,
    dashTimer: 0,
    dashDistance: 160,
    invulnerableTimer: 0,
    level: 1,
    xp: 0,
    xpToLevel: 120,
    score: 0,
    combo: 1,
    comboTimer: 0,
    creditIncome: 4,
    weaponHeat: 0,
    weaponHeatMax: 120,
    weaponHeatDecay: 14,
    overheated: false,
    supportSystems: {
      gravityWell: false
    }
  };
}

function updateGame(game, dt, keys, requestUpgrade, signalGameOver, syncUi) {
  if (!game) return;

  const { ctx, player } = game;
  if (!ctx) return;

  if (game.paused) {
    drawGame(game);
    return;
  }

  game.timeSinceStart += dt;
  game.difficulty = 1 + game.timeSinceStart * 0.12;
  game.spawnTimer -= dt;
  game.eliteSpawnTimer -= dt;
  player.comboTimer += dt;
  player.dashTimer -= dt;
  player.invulnerableTimer -= dt;
  player.shieldDelayTimer -= dt;

  if (player.combo > 1 && player.comboTimer > 3) {
    player.combo = Math.max(1, player.combo - dt * 0.5);
  }

  // Passive income and regen
  player.score += player.creditIncome * dt;
  if (player.passiveRegen > 0) {
    player.hp = Math.min(player.maxHp, player.hp + player.passiveRegen * dt);
  }

  // Weapon heat decay
  if (!player.overheated) {
    player.weaponHeat = Math.max(0, player.weaponHeat - player.weaponHeatDecay * dt);
  } else {
    player.weaponHeat = Math.max(0, player.weaponHeat - player.weaponHeatDecay * dt * 1.8);
    if (player.weaponHeat <= 0) player.overheated = false;
  }

  handleInput(game, dt, keys);
  updatePlayer(game, dt);
  spawnEnemies(game);
  updateEnemies(game, dt);
  updateBullets(game, dt);
  updateParticles(game, dt);
  updateMines(game, dt);

  if (player.hp <= 0 && !game.paused) {
    game.paused = true;
    signalGameOver({
      score: Math.floor(player.score),
      time: game.timeSinceStart.toFixed(1),
      level: player.level
    });
  }

  // Sync UI at 15 fps
  game.lastUiSync += dt;
  if (game.lastUiSync >= 1 / 15) {
    game.lastUiSync = 0;
    syncUi({
      score: Math.floor(player.score),
      hp: Math.round(player.hp),
      maxHp: Math.round(player.maxHp),
      shield: Math.round(player.shield),
      maxShield: Math.round(player.maxShield),
      level: player.level,
      xp: player.xp,
      xpToLevel: player.xpToLevel,
      difficulty: game.difficulty,
      overheated: player.overheated,
      combo: player.combo
    });
  }

  drawGame(game);

  // Level up check
  if (!game.levelUpPending && player.xp >= player.xpToLevel) {
    player.level += 1;
    player.xp -= player.xpToLevel;
    player.xpToLevel = Math.floor(player.xpToLevel * 1.25 + 40);
    game.levelUpPending = true;
    game.paused = true;
    requestUpgrade(pickRandom(BASE_UPGRADES, 3));
  }
}

function handleInput(game, dt, keys) {
  const { player } = game;
  const accel = player.acceleration;

  let inputX = 0;
  let inputY = 0;
  if (keys.current["KeyA"] || keys.current["ArrowLeft"]) inputX -= 1;
  if (keys.current["KeyD"] || keys.current["ArrowRight"]) inputX += 1;
  if (keys.current["KeyW"] || keys.current["ArrowUp"]) inputY -= 1;
  if (keys.current["KeyS"] || keys.current["ArrowDown"]) inputY += 1;

  const mag = Math.hypot(inputX, inputY);
  if (mag > 0) {
    inputX /= mag;
    inputY /= mag;
    player.vx += inputX * accel * dt;
    player.vy += inputY * accel * dt;
    player.angle = Math.atan2(player.vy, player.vx);
  }

  // Shooting
  if ((keys.current["Space"] || keys.current["KeyJ"] || keys.current["KeyK"]) && !player.overheated) {
    if (player.fireCooldown <= 0) {
      firePlayerWeapon(game);
    }
  }

  // Dash
  if ((keys.current["ShiftLeft"] || keys.current["ShiftRight"] || keys.current["KeyL"]) && player.dashTimer <= 0) {
    const dirMag = Math.hypot(player.vx, player.vy);
    if (dirMag > 20) {
      const dashMagnitude = player.dashDistance / Math.max(dirMag, 100);
      player.vx *= dashMagnitude;
      player.vy *= dashMagnitude;
    } else {
      player.vx += Math.cos(player.angle) * player.dashDistance * 2;
      player.vy += Math.sin(player.angle) * player.dashDistance * 2;
    }
    player.dashTimer = player.dashCooldown;
    player.invulnerableTimer = 0.4;
    spawnRingParticles(game, player.x, player.y, "#8ef9ff", 28);
  }
}

function firePlayerWeapon(game) {
  const { player, playerBullets } = game;
  const baseAngle = Math.atan2(player.vy, player.vx);
  const aimAngle = Number.isFinite(baseAngle) ? baseAngle : player.angle;

  const totalShots = player.multiShot;
  const spread = player.spread;
  for (let i = 0; i < totalShots; i += 1) {
    const offset = (i - (totalShots - 1) / 2) * spread;
    const angle = aimAngle + offset;
    const speed = player.bulletSpeed;
    playerBullets.push({
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 6,
      damage: player.bulletDamage,
      life: 1.8,
      crit: Math.random() < player.critChance
    });
  }

  player.fireCooldown = 1 / player.fireRate;
  player.weaponHeat += 14 + player.multiShot * 4;
  if (player.weaponHeat >= player.weaponHeatMax) {
    player.overheated = true;
  }
  spawnMuzzleFlash(game, player);
}

function spawnMuzzleFlash(game, player) {
  const angle = Math.atan2(player.vy, player.vx) || player.angle;
  for (let i = 0; i < 12; i += 1) {
    const spread = (Math.random() - 0.5) * Math.PI / 5;
    game.particles.push({
      x: player.x + Math.cos(angle) * 18,
      y: player.y + Math.sin(angle) * 18,
      vx: Math.cos(angle + spread) * rand(120, 260),
      vy: Math.sin(angle + spread) * rand(120, 260),
      life: rand(0.2, 0.35),
      radius: rand(2, 4),
      color: Math.random() < 0.4 ? "#fffd71" : "#ff9e45"
    });
  }
}

function updatePlayer(game, dt) {
  const { player } = game;
  player.fireCooldown -= dt;

  player.vx *= 1 - player.friction * dt;
  player.vy *= 1 - player.friction * dt;

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > player.maxSpeed) {
    const scale = player.maxSpeed / speed;
    player.vx *= scale;
    player.vy *= scale;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < 40) player.x = 40;
  if (player.x > WIDTH - 40) player.x = WIDTH - 40;
  if (player.y < 40) player.y = 40;
  if (player.y > HEIGHT - 40) player.y = HEIGHT - 40;

  if (player.shieldDelayTimer <= 0 && player.shield < player.maxShield) {
    player.shield = Math.min(player.maxShield, player.shield + player.shieldRechargeRate * dt);
  }
}

function spawnEnemies(game) {
  if (game.spawnTimer > 0) return;
  const difficulty = game.difficulty;
  const spawnInterval = Math.max(0.4, 2.2 / Math.sqrt(difficulty + 1));
  game.spawnTimer = spawnInterval * rand(0.6, 1.2);

  const typeRoll = Math.random();
  const isElite = game.eliteSpawnTimer <= 0 && Math.random() < 0.6;

  const enemy = createEnemy(typeRoll, difficulty, isElite);
  positionEnemyAtEdge(enemy);
  game.enemies.push(enemy);

  if (game.eliteSpawnTimer <= 0) {
    game.eliteSpawnTimer = Math.max(7, 15 - difficulty * 0.6);
  }
}

function createEnemy(typeRoll, difficulty, isElite) {
  const baseHp = 60 + difficulty * 14;
  if (typeRoll < 0.55) {
    return {
      type: "chaser",
      hp: baseHp * (isElite ? 4 : 1),
      maxHp: baseHp * (isElite ? 4 : 1),
      speed: 90 + difficulty * 12,
      damage: 26 * (isElite ? 1.6 : 1),
      radius: isElite ? 26 : 18,
      fireCooldown: rand(2, 3) / (isElite ? 1.8 : 1),
      isElite
    };
  }
  if (typeRoll < 0.85) {
    return {
      type: "strafer",
      hp: baseHp * 0.85 * (isElite ? 3 : 1),
      maxHp: baseHp * 0.85 * (isElite ? 3 : 1),
      speed: 160 + difficulty * 20,
      damage: 18 * (isElite ? 1.4 : 1),
      radius: isElite ? 24 : 16,
      fireCooldown: rand(1.4, 2) / (isElite ? 1.7 : 1),
      isElite
    };
  }
  return {
    type: "artillery",
    hp: baseHp * 1.6 * (isElite ? 2.5 : 1),
    maxHp: baseHp * 1.6 * (isElite ? 2.5 : 1),
    speed: 70 + difficulty * 8,
    damage: 42 * (isElite ? 1.5 : 1),
    radius: isElite ? 30 : 22,
    fireCooldown: rand(3, 4.5) / (isElite ? 1.5 : 1),
    isElite
  };
}

function positionEnemyAtEdge(enemy) {
  const side = Math.floor(Math.random() * 4);
  const padding = 30;
  if (side === 0) {
    enemy.x = rand(-padding, WIDTH + padding);
    enemy.y = -padding;
  } else if (side === 1) {
    enemy.x = WIDTH + padding;
    enemy.y = rand(-padding, HEIGHT + padding);
  } else if (side === 2) {
    enemy.x = rand(-padding, WIDTH + padding);
    enemy.y = HEIGHT + padding;
  } else {
    enemy.x = -padding;
    enemy.y = rand(-padding, HEIGHT + padding);
  }
  enemy.vx = 0;
  enemy.vy = 0;
}

function updateEnemies(game, dt) {
  const { enemies, player, enemyBullets } = game;
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (enemy.type === "chaser") {
      const accel = 180;
      enemy.vx = (dx / dist) * enemy.speed;
      enemy.vy = (dy / dist) * enemy.speed;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (dist < enemy.radius + 16) {
        collideWithPlayer(game, enemy.damage * dt * 4);
        spawnExplosion(game, enemy.x, enemy.y, "#ff8f7a", 20);
        enemy.hp = 0;
      }
    } else if (enemy.type === "strafer") {
      const desiredDistance = 240;
      const angle = Math.atan2(dy, dx);
      const perpAngle = angle + Math.PI / 2;
      const followFactor = Math.min(1, enemy.speed * dt / desiredDistance);
      enemy.vx += (Math.cos(angle) * Math.min(dist - desiredDistance, 120) - enemy.vx) * followFactor;
      enemy.vy += (Math.sin(angle) * Math.min(dist - desiredDistance, 120) - enemy.vy) * followFactor;
      enemy.vx += Math.cos(perpAngle) * enemy.speed * 0.4 * dt * (enemy.isElite ? 1.4 : 1);
      enemy.vy += Math.sin(perpAngle) * enemy.speed * 0.4 * dt * (enemy.isElite ? 1.4 : 1);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.fireCooldown <= 0) {
        enemy.fireCooldown = enemy.type === "strafer" ? 0.65 : 1.2;
        const bulletAngle = angle + rand(-0.12, 0.12);
        const bulletSpeed = 320 + (enemy.isElite ? 120 : 0);
        enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(bulletAngle) * bulletSpeed,
          vy: Math.sin(bulletAngle) * bulletSpeed,
          radius: 6,
          damage: enemy.damage,
          life: 3,
          color: enemy.isElite ? "#ff4689" : "#ffcc55"
        });
      }
    } else if (enemy.type === "artillery") {
      const desiredDistance = 320;
      const moveDir = dist > desiredDistance ? 1 : -1;
      enemy.vx = (dx / dist) * enemy.speed * moveDir;
      enemy.vy = (dy / dist) * enemy.speed * moveDir;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.fireCooldown <= 0) {
        enemy.fireCooldown = 2.8;
        const bulletAngle = Math.atan2(dy, dx);
        const bulletSpeed = 260;
        enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(bulletAngle) * bulletSpeed,
          vy: Math.sin(bulletAngle) * bulletSpeed,
          radius: 10,
          damage: enemy.damage * 1.6,
          life: 4,
          color: "#71a9ff"
        });
        spawnRingParticles(game, enemy.x, enemy.y, "#71a9ff", enemy.isElite ? 32 : 20);
      }
    }

    enemy.fireCooldown -= dt;
    enemy.x = Math.max(-60, Math.min(WIDTH + 60, enemy.x));
    enemy.y = Math.max(-60, Math.min(HEIGHT + 60, enemy.y));

    if (enemy.hp <= 0) {
      enemies.splice(i, 1);
      handleEnemyDeath(game, enemy);
    }
  }
}

function handleEnemyDeath(game, enemy) {
  const { player } = game;
  const xpGain = (enemy.maxHp / 10 + enemy.damage) * (enemy.isElite ? 2.4 : 1);
  player.xp += xpGain;
  player.score += xpGain * 3;
  player.combo = Math.min(player.combo + 0.12, 4.5);
  player.comboTimer = 0;
  spawnExplosion(game, enemy.x, enemy.y, enemy.isElite ? "#ff71f1" : "#ffbf71", enemy.isElite ? 55 : 35);
}

function updateBullets(game, dt) {
  const { playerBullets, enemyBullets, enemies, player } = game;

  for (let i = playerBullets.length - 1; i >= 0; i -= 1) {
    const bullet = playerBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) {
      playerBullets.splice(i, 1);
      continue;
    }
    if (bullet.x < -20 || bullet.x > WIDTH + 20 || bullet.y < -20 || bullet.y > HEIGHT + 20) {
      playerBullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const dist = Math.hypot(dx, dy);
      if (dist < enemy.radius + bullet.radius) {
        const damage = bullet.crit ? bullet.damage * (player.critMultiplier + 1) : bullet.damage;
        enemy.hp -= damage * (1 + (player.combo - 1) * 0.2);
        playerBullets.splice(i, 1);
        spawnHitParticles(game, enemy.x, enemy.y, bullet.crit);
        break;
      }
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) {
      enemyBullets.splice(i, 1);
      continue;
    }
    if (
      bullet.x < -40 ||
      bullet.x > WIDTH + 40 ||
      bullet.y < -40 ||
      bullet.y > HEIGHT + 40
    ) {
      enemyBullets.splice(i, 1);
      continue;
    }
    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    const dist = Math.hypot(dx, dy);
    if (dist < bullet.radius + 16) {
      enemyBullets.splice(i, 1);
      collideWithPlayer(game, bullet.damage);
      spawnHitParticles(game, player.x, player.y, false);
    }
  }
}

function collideWithPlayer(game, damage) {
  const { player } = game;
  if (player.invulnerableTimer > 0) return;
  player.shieldDelayTimer = player.shieldRechargeDelay;
  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, damage);
    player.shield -= absorbed;
    damage -= absorbed;
  }
  if (damage > 0) {
    player.hp -= damage;
  }
}

function updateParticles(game, dt) {
  const { particles } = game;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function spawnExplosion(game, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(40, 280);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.4, 0.8),
      radius: rand(2, 6),
      color
    });
  }
}

function spawnRingParticles(game, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const speed = rand(120, 220);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.3, 0.5),
      radius: rand(1.5, 3),
      color
    });
  }
}

function spawnHitParticles(game, x, y, crit) {
  const color = crit ? "#f8faff" : "#ffedcf";
  for (let i = 0; i < (crit ? 26 : 16); i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(40, 260);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.2, 0.45),
      radius: rand(1, 3),
      color
    });
  }
}

function updateMines(game, dt) {
  const { player, mines, enemies } = game;
  if (!player.supportSystems.gravityWell) return;

  game.lastMineFire += dt;
  if (game.lastMineFire >= 3) {
    game.lastMineFire = 0;
    mines.push({
      x: player.x,
      y: player.y,
      radius: 14,
      life: 3.5,
      slowRadius: 150
    });
  }

  for (let i = mines.length - 1; i >= 0; i -= 1) {
    const mine = mines[i];
    mine.life -= dt;
    if (mine.life <= 0) {
      spawnRingParticles(game, mine.x, mine.y, "#8df5ff", 40);
      mines.splice(i, 1);
      continue;
    }
    for (let j = 0; j < enemies.length; j += 1) {
      const enemy = enemies[j];
      const dx = enemy.x - mine.x;
      const dy = enemy.y - mine.y;
      const dist = Math.hypot(dx, dy);
      if (dist < mine.slowRadius) {
        const pull = (mine.slowRadius - dist) / mine.slowRadius;
        enemy.vx = (enemy.vx || 0) * (1 - 0.8 * pull);
        enemy.vy = (enemy.vy || 0) * (1 - 0.8 * pull);
      }
    }
  }
}

function updateStars(game, dt) {
  const { stars } = game;
  for (let i = 0; i < stars.length; i += 1) {
    const star = stars[i];
    star.y += star.depth * 30 * dt;
    if (star.y > HEIGHT) {
      star.y = 0;
      star.x = Math.random() * WIDTH;
      star.depth = Math.random() * 0.9 + 0.1;
    }
  }
}

function drawGame(game) {
  const { ctx, player, enemies, playerBullets, enemyBullets, particles, stars, mines } = game;
  updateStars(game, 1 / 60);

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Background gradient
  const gradient = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    100,
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT
  );
  gradient.addColorStop(0, "#04061a");
  gradient.addColorStop(1, "#02030c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stars
  for (let i = 0; i < stars.length; i += 1) {
    const star = stars[i];
    const alpha = 0.4 + Math.sin((performance.now() / 500 + star.twinkle) * 2 * Math.PI) * 0.2;
    ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
    ctx.fillRect(star.x, star.y, 1.5 + star.depth * 1.5, 1.5 + star.depth * 1.5);
  }

  // Mines
  ctx.strokeStyle = "rgba(140, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  mines.forEach((mine) => {
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, mine.slowRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(150, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(Math.atan2(player.vy, player.vx) || player.angle);
  ctx.fillStyle = player.overheated ? "#ff7766" : "#7ef9f5";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-16, 12);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-16, -12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Player aura for shield
  if (player.shield > 0) {
    ctx.strokeStyle = "rgba(120, 210, 255, 0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 26 + (player.shield / player.maxShield) * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Player bullets
  playerBullets.forEach((bullet) => {
    ctx.fillStyle = bullet.crit ? "#fffdf2" : "#ffcf7a";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Enemy bullets
  enemyBullets.forEach((bullet) => {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Enemies
  enemies.forEach((enemy) => {
    const color = enemy.isElite ? "#ff4fe7" : "#ff7754";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    // Health bar
    const hpRatio = enemy.hp / enemy.maxHp;
    ctx.fillStyle = enemy.isElite ? "#fff5d4" : "#ffe8c6";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y + enemy.radius + 4, enemy.radius * 2 * hpRatio, 3);
  });

  // Particles
  particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

export default function HomePage() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const animationRef = useRef(null);
  const keys = useRef({});

  const [uiState, setUiState] = useState({
    score: 0,
    hp: 0,
    maxHp: 0,
    shield: 0,
    maxShield: 0,
    level: 1,
    xp: 0,
    xpToLevel: 0,
    difficulty: 1,
    overheated: false,
    combo: 1
  });
  const [upgradeChoices, setUpgradeChoices] = useState([]);
  const [gameOver, setGameOver] = useState(null);
  const [sessionId, setSessionId] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const game = initGame(ctx);
    gameRef.current = game;

    const handleKeyDown = (event) => {
      keys.current[event.code] = true;
      if (event.code === "Space") {
        event.preventDefault();
      }
    };
    const handleKeyUp = (event) => {
      keys.current[event.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      updateGame(
        gameRef.current,
        dt,
        keys,
        (choices) => setUpgradeChoices(choices),
        (info) => setGameOver(info),
        (ui) => setUiState(ui)
      );
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [sessionId]);

  useEffect(() => {
    if (gameOver) {
      gameRef.current.paused = true;
    }
  }, [gameOver]);

  const handleUpgrade = (upgrade) => {
    const game = gameRef.current;
    if (!game || !upgrade) return;
    upgrade.apply(game.player);
    game.levelUpPending = false;
    game.paused = false;
    setUpgradeChoices([]);
  };

  const handleContinue = () => {
    const game = gameRef.current;
    if (game) {
      game.levelUpPending = false;
      game.paused = false;
    }
    setUpgradeChoices([]);
  };

  const resetGame = () => {
    setSessionId((id) => id + 1);
    setGameOver(null);
    setUpgradeChoices([]);
    setUiState({
      score: 0,
      hp: 0,
      maxHp: 0,
      shield: 0,
      maxShield: 0,
      level: 1,
      xp: 0,
      xpToLevel: 0,
      difficulty: 1,
      overheated: false,
      combo: 1
    });
  };

  return (
    <main className="page">
      <div className="hud">
        <div className="hud-left">
          <div className="stat">
            <span className="label">SCORE</span>
            <span className="value">{uiState.score.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="label">LEVEL</span>
            <span className="value">{uiState.level}</span>
          </div>
          <div className="bar">
            <span className="label">HULL</span>
            <div className="bar-track">
              <div
                className="bar-fill hull"
                style={{ width: `${uiState.maxHp ? (uiState.hp / uiState.maxHp) * 100 : 0}%` }}
              />
            </div>
            <span className="value">
              {Math.round(uiState.hp)}/{uiState.maxHp}
            </span>
          </div>
          <div className="bar">
            <span className="label">SHIELD</span>
            <div className="bar-track">
              <div
                className="bar-fill shield"
                style={{
                  width: `${uiState.maxShield ? (uiState.shield / uiState.maxShield) * 100 : 0}%`
                }}
              />
            </div>
            <span className="value">
              {Math.round(uiState.shield)}/{uiState.maxShield}
            </span>
          </div>
          <div className="bar">
            <span className="label">XP</span>
            <div className="bar-track">
              <div
                className="bar-fill xp"
                style={{ width: `${uiState.xpToLevel ? (uiState.xp / uiState.xpToLevel) * 100 : 0}%` }}
              />
            </div>
            <span className="value">{Math.floor(uiState.xp)}/{uiState.xpToLevel}</span>
          </div>
        </div>

        <div className="hud-right">
          <div className="stat">
            <span className="label">DIFFICULTY</span>
            <span className="value">{uiState.difficulty.toFixed(2)}x</span>
          </div>
          <div className="stat">
            <span className="label">COMBO</span>
            <span className="value">{uiState.combo.toFixed(2)}x</span>
          </div>
          <div className={`stat ${uiState.overheated ? "warning" : ""}`}>
            <span className="label">WEAPON TEMP</span>
            <span className="value">{uiState.overheated ? "OVERHEATED" : "STABLE"}</span>
          </div>
          <div className="instructions">
            <span>WASD / Arrows to move</span>
            <span>Space/J/K to fire</span>
            <span>Shift/L to dash</span>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="game-canvas" />

      {upgradeChoices.length > 0 && (
        <div className="overlay">
          <div className="upgrade-panel">
            <h2>Choose Your Upgrade</h2>
            <div className="upgrade-grid">
              {upgradeChoices.map((upgrade) => (
                <button
                  key={upgrade.id}
                  className="upgrade-card"
                  onClick={() => handleUpgrade(upgrade)}
                >
                  <h3>{upgrade.name}</h3>
                  <p>{upgrade.description}</p>
                </button>
              ))}
            </div>
            <button className="secondary" onClick={handleContinue}>
              Skip Upgrade
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="overlay">
          <div className="gameover-panel">
            <h2>Run Terminated</h2>
            <p>Level Reached: {gameOver.level}</p>
            <p>Final Score: {Math.floor(gameOver.score).toLocaleString()}</p>
            <p>Survival Time: {gameOver.time}s</p>
            <button onClick={resetGame}>Launch New Run</button>
          </div>
        </div>
      )}
    </main>
  );
}
