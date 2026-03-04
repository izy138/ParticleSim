// Basic Phaser 3 platformer shell for your particle game.
// Open `index.html` in a browser to run.

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      // No gravity; player and particles are free to move anywhere on screen.
      gravity: { y: 0 },
      // Turn off debug so we don't see long velocity/body lines over particles.
      debug: false,
    },
  },
  scene: {
    preload,
    create,
    update,
  },
};

let game = new Phaser.Game(config);

function preload() {
  // Assets will go here later if you want sprites, sounds, etc.
}

function create() {
  const scene = this;

  // --- Player ---------------------------------------------------------------
  // Create player as a rectangle with physics
  scene.player = scene.add.rectangle(100, 450, 32, 32, 0x00ff00);
  scene.physics.add.existing(scene.player);
  scene.player.body.setCollideWorldBounds(true);
  scene.player.body.allowGravity = false;

  // Input
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.shootKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SPACE
  );

  // No platforms: open space, player can move anywhere within screen bounds.

  // --- Particle bullets -----------------------------------------------------
  scene.particles = scene.add.group();
  scene.lastShot = 0;

  // --- Multiple enemy swarms (different colors) ------------------------------
  // Helper: convert RGB [0-1] array to Phaser hex color
  function rgbToHex(rgb) {
    const r = Math.floor(rgb[0] * 255);
    const g = Math.floor(rgb[1] * 255);
    const b = Math.floor(rgb[2] * 255);
    return (r << 16) | (g << 8) | b;
  }

  // Species colors from particle-life-system.json
  const speciesConfigs = [
    { color: [0.411, 0.983, 0.096, 1], spawnPos: [600, 200] }, // Green
    { color: [0.653, 0.182, 0.188, 1], spawnPos: [200, 150] }, // Red
    { color: [0.127, 0.876, 0.699, 1], spawnPos: [700, 400] }, // Cyan
    { color: [0.260, 0.284, 0.792, 1], spawnPos: [150, 450] }, // Blue
    { color: [0.681, 0.510, 0.605, 1], spawnPos: [650, 500] }, // Pink
  ];

  scene.enemySwarms = [];

  function createSwarm(config, index) {
    const swarm = scene.physics.add.group();
    const ENEMY_COUNT = 100; // Smaller per swarm since we have multiple
    const [spawnX, spawnY] = config.spawnPos;
    const hexColor = rgbToHex(config.color);

    for (let i = 0; i < ENEMY_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 40 + Math.random() * 30;
      const x = spawnX + Math.cos(angle) * radius;
      const y = spawnY + Math.sin(angle) * radius;

      const p = scene.add.circle(x, y, 3, hexColor);
      scene.physics.add.existing(p);
      p.body.setBounce(0.5);
      p.body.setCollideWorldBounds(true);
      p.body.allowGravity = false;

      // Small random initial motion
      p.body.setVelocity(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      );

      swarm.add(p);
    }

    // Store swarm metadata
    swarm.swarmIndex = index;
    scene.enemySwarms.push(swarm);

    // Player takes damage on contact with swarm (when shield is down)
    scene.physics.add.overlap(swarm, scene.player, enemyHitsPlayer, null, scene);

    // Bullets interact with swarm
    scene.physics.add.overlap(
      scene.particles,
      swarm,
      bulletHitsEnemyParticle,
      null,
      scene
    );
  }

  // --- Shield ---------------------------------------------------------------
  scene.shieldEnergy = 100;
  scene.shieldActive = true;

  scene.shield = scene.add.circle(
    scene.player.x,
    scene.player.y,
    40,
    0x00ffff,
    0.2
  );
  scene.physics.add.existing(scene.shield);
  scene.shield.body.setCircle(40);
  scene.shield.body.allowGravity = false;
  scene.shield.body.setImmovable(true);

  // Create all swarms (after shield exists so overlaps work)
  speciesConfigs.forEach((config, index) => {
    createSwarm(config, index);
  });

  // All swarms interact with shield
  scene.enemySwarms.forEach((swarm) => {
    scene.physics.add.overlap(
      swarm,
      scene.shield,
      enemyHitsShield,
      null,
      scene
    );
  });
}

function update(time, delta) {
  const scene = this;
  if (!scene.player || !scene.cursors) return;

  // --- Player movement (free, no gravity) -----------------------------------
  const moveSpeed = 220;

  let vx = 0;
  let vy = 0;

  if (scene.cursors.left.isDown) vx -= moveSpeed;
  if (scene.cursors.right.isDown) vx += moveSpeed;
  if (scene.cursors.up.isDown) vy -= moveSpeed;
  if (scene.cursors.down.isDown) vy += moveSpeed;

  // Optional: support WASD in the future if you like.

  if (scene.player && scene.player.body) {
    scene.player.body.setVelocity(vx, vy);
  }

  // --- Shooting particles ---------------------------------------------------
  if (scene.shootKey.isDown && time > scene.lastShot + 200) {
    shootParticle.call(scene, scene.player.x, scene.player.y - 10);
    scene.lastShot = time;
  }

  // --- Shield follows player -------------------------------------------------
  if (scene.shield) {
    scene.shield.x = scene.player.x;
    scene.shield.y = scene.player.y;
  }

  // --- Enemy swarm behavior (all swarms) --------------------------------------
  if (scene.enemySwarms && scene.enemySwarms.length > 0) {
    const dt = delta / 1000;
    const playerX = scene.player.x;
    const playerY = scene.player.y;

    scene.enemySwarms.forEach((swarm) => {
      if (!swarm || swarm.getLength() === 0) return;

      // Compute swarm centroid
      let cx = 0;
      let cy = 0;
      let count = 0;
      swarm.children.each((p) => {
        if (!p.body) return;
        cx += p.x;
        cy += p.y;
        count++;
      });

      if (count === 0) return;
      cx /= count;
      cy /= count;

      swarm.children.each((p) => {
        if (!p.body) return;
        const dxC = cx - p.x;
        const dyC = cy - p.y;
        const distC = Math.hypot(dxC, dyC) || 1;

        const dxP = playerX - p.x;
        const dyP = playerY - p.y;
        const distP = Math.hypot(dxP, dyP) || 1;

        // Desired "cloud" radius around the centroid so they don't all
        // collapse to a single point.
        const targetRadius = 60;
        const innerRadius = 25;

        // Damping (friction) + speed clamp
        const damping = 0.9;
        const maxSpeed = 180; // Increased max speed

        let vx = p.body.velocity.x * damping;
        let vy = p.body.velocity.y * damping;

        // --- Force: keep particles in a band around the centroid ------------
        // If too close to center, push outward; if too far, pull inward.
        let fxC = 0;
        let fyC = 0;
        const nxC = dxC / distC;
        const nyC = dyC / distC;

        if (distC < innerRadius) {
          // Strong repulsion near center
          const strength = (innerRadius - distC) * 25;
          fxC -= nxC * strength;
          fyC -= nyC * strength;
        } else if (distC > targetRadius) {
          // Attraction back toward the centroid when far away
          const strength = (distC - targetRadius) * 10;
          fxC += nxC * strength;
          fyC += nyC * strength;
        }

        // --- Force: whole formation drifts toward the player -----------------
        // INCREASED attraction strength to reach player faster
        const nxP = dxP / distP;
        const nyP = dyP / distP;
        let fxP = 0;
        let fyP = 0;

        const playerAttractRadius = 600; // Increased range
        if (distP > innerRadius && distP < playerAttractRadius) {
          const strength = 45; // Increased from 18 to 45 for faster approach
          fxP += nxP * strength;
          fyP += nyP * strength;
        } else if (distP <= innerRadius) {
          // Mild repulsion if extremely close to avoid hard overlap.
          const strength = 25;
          fxP -= nxP * strength;
          fyP -= nyP * strength;
        }

        vx += (fxC + fxP) * dt;
        vy += (fyC + fyP) * dt;

        // Clamp speed so particles don't shoot off-screen
        const speed = Math.hypot(vx, vy);
        if (speed > maxSpeed) {
          const scale = maxSpeed / speed;
          vx *= scale;
          vy *= scale;
        }

        p.body.setVelocity(vx, vy);
      });
    });
  }
}

function shootParticle(x, y) {
  const scene = this;
  const particle = scene.add.circle(x, y, 4, 0x00ffff);

  scene.physics.add.existing(particle);
  particle.body.setVelocity(400, 0); // shoot to the right
  particle.body.allowGravity = false;

  scene.particles.add(particle);

  // Remove particle after some time
  scene.time.delayedCall(2000, () => {
    if (particle && particle.destroy) {
      particle.destroy();
    }
  });
}

// Enemy swarm vs player / shield / bullets -----------------------------------

function enemyHitsPlayer(enemy, player) {
  const scene = this;

  // If shield is active, let the shield handle it instead
  if (scene.shieldActive) return;

  // For now, just push the player back a bit to make the contact feel dangerous.
  if (player.body && enemy.body) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const push = 200;
    player.body.setVelocity((dx / len) * push, (dy / len) * push);
  }
}

function enemyHitsShield(enemy, shield) {
  const scene = this;

  if (!scene.shieldActive) return;

  // Enemy particle is annihilated, shield loses energy.
  if (enemy && enemy.destroy) {
    enemy.destroy();
  }

  scene.shieldEnergy -= 2;

  // Visual feedback: increase shield opacity briefly
  shield.setFillStyle(0x00ffff, 0.35);
  scene.time.delayedCall(80, () => {
    if (scene.shieldActive) {
      shield.setFillStyle(0x00ffff, 0.2);
    }
  });

  if (scene.shieldEnergy <= 0) {
    scene.shieldActive = false;
    if (scene.shield && scene.shield.body) {
      scene.shield.body.checkCollision.none = true;
      scene.shield.setVisible(false);
    }
  }
}

function bulletHitsEnemyParticle(bullet, enemy) {
  const scene = this;

  // Remove bullet
  if (bullet && bullet.destroy) {
    bullet.destroy();
  }

  // Either destroy or knock enemy away; for now, knockback then small chance to destroy.
  if (enemy && enemy.body) {
    const dx = enemy.x - scene.player.x;
    const dy = enemy.y - scene.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const knockback = 250;
    enemy.body.setVelocity((dx / len) * knockback, (dy / len) * knockback);

    if (Math.random() < 0.4 && enemy.destroy) {
      enemy.destroy();
    }
  }
}


