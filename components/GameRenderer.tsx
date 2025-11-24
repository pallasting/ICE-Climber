
import React, { useEffect, useRef, useCallback } from 'react';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, PHYSICS, COLORS, 
  COLS, PLAYER_SIZE, ENEMY_CONFIG, BIOME_CONFIG, ITEM_CONFIG, SHAKE_INTENSITY,
  BOSS_CONFIG, PROJECTILE_CONFIG, CLOUD_CONFIG
} from '../constants';
import { 
  Block, BlockType, Entity, GameState, Particle, Snowflake, 
  BiomeType, Enemy, EnemyType, Item, ItemType, FloatingText, Upgrades, UpgradeType, Boss, Projectile, ComboState
} from '../types';
import { audioManager } from '../utils/audio';

interface GameRendererProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  setHeat: React.Dispatch<React.SetStateAction<number>>;
  setAltitude: (val: number) => void;
  setBiome: (val: string) => void;
  upgrades: Upgrades;
  setBossStatus: (status: { active: boolean, hp: number, maxHp: number }) => void;
}

const GameRenderer: React.FC<GameRendererProps> = ({ 
  gameState, setGameState, setScore, setHeat, setAltitude, setBiome, upgrades, setBossStatus
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  const setGameStateRef = useRef(setGameState);
  useEffect(() => {
    setGameStateRef.current = setGameState;
  }, [setGameState]);

  // Input state
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Game World State
  const cameraYRef = useRef<number>(0);
  const maxScrollRef = useRef<number>(0);
  const highestGenYRef = useRef<number>(0); 
  const scoreRef = useRef<number>(0);
  const traumaRef = useRef<number>(0); // 0 to 1, controls screen shake
  const lastShopLevelRef = useRef<number>(0); // Track last level we visited shop
  const windOffsetRef = useRef<number>(0); // For blizzard visuals
  
  // JUICE States
  const hitStopRef = useRef<number>(0); // Frames to freeze physics
  const comboRef = useRef<ComboState>({ count: 0, timer: 0, multiplier: 1 });

  // Entities
  const playerRef = useRef<Entity>({
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE.width / 2,
    y: CANVAS_HEIGHT - 150,
    vx: 0,
    vy: 0,
    width: PLAYER_SIZE.width,
    height: PLAYER_SIZE.height,
    color: COLORS.player,
    isGrounded: false,
    lastGroundedTime: 0,
    facingRight: true,
    state: 'idle',
    hitCooldown: 0,
    isAttacking: false,
    attackTimer: 0,
    attackCooldown: 0,
    rotation: 0
  });

  const mapRef = useRef<Block[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const snowRef = useRef<Snowflake[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  // Boss State
  const bossRef = useRef<Boss>({
      x: CANVAS_WIDTH / 2 - BOSS_CONFIG.WIDTH / 2,
      y: -BOSS_CONFIG.LEVEL * TILE_SIZE * 4 - 300, // Spawn way up initially
      vx: BOSS_CONFIG.SPEED,
      vy: 0,
      width: BOSS_CONFIG.WIDTH,
      height: BOSS_CONFIG.HEIGHT,
      color: BOSS_CONFIG.COLOR,
      hp: BOSS_CONFIG.HP,
      maxHp: BOSS_CONFIG.HP,
      isActive: false,
      phase: 0,
      moveTimer: 0,
      isGrounded: false,
      lastGroundedTime: 0,
      facingRight: false,
      state: 'idle',
      hitCooldown: 0,
      isAttacking: false,
      attackTimer: 0,
      attackCooldown: 0
  });
  
  const projectilesRef = useRef<Projectile[]>([]);

  // --- HELPERS ---
  const addTrauma = (amount: number) => {
    traumaRef.current = Math.min(1.0, traumaRef.current + amount);
  };
  
  const triggerHitStop = (frames: number) => {
      hitStopRef.current = frames;
  };
  
  const incrementCombo = (x: number, y: number) => {
      comboRef.current.count++;
      comboRef.current.timer = 120; // 2 seconds
      comboRef.current.multiplier = Math.min(5, 1 + (comboRef.current.count * 0.1));
      
      if (comboRef.current.count > 1) {
          spawnFloatingText(x, y - 20, `${comboRef.current.count}x COMBO!`, '#fcd34d', 16);
      }
      return comboRef.current.multiplier;
  };
  
  const triggerPlayerDeath = () => {
      if (playerRef.current.state === 'die') return;
      playerRef.current.state = 'die';
      playerRef.current.vy = -12; // Pop up
      playerRef.current.isGrounded = false;
      addTrauma(SHAKE_INTENSITY.LARGE);
      audioManager.playHurt();
      // Don't set GAME_OVER yet, wait for fall
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string = 'white', size: number = 14) => {
    floatingTextsRef.current.push({
      x, y,
      text,
      life: 1.0,
      vx: (Math.random() - 0.5) * 1,
      vy: -2,
      color,
      size
    });
  };

  const getBiomeAtLevel = (level: number): BiomeType => {
    if (level >= BIOME_CONFIG[BiomeType.AURORA].startLevel) return BiomeType.AURORA;
    if (level >= BIOME_CONFIG[BiomeType.BLIZZARD].startLevel) return BiomeType.BLIZZARD;
    return BiomeType.ICE_CAVE;
  };

  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // --- GENERATION ---
  const generateRow = (rowY: number, level: number) => {
    const biome = getBiomeAtLevel(level);
    const newBlocks: Block[] = [];
    const isFloor = level === 0;
    
    // Boss Arena at specific level
    if (level === BOSS_CONFIG.LEVEL) {
         // Flat platform for boss fight
         for (let x = 0; x < COLS; x++) {
            newBlocks.push({
                id: `arena-${x}-${rowY}`,
                x: x * TILE_SIZE,
                y: rowY,
                width: TILE_SIZE,
                height: TILE_SIZE,
                type: BlockType.UNBREAKABLE,
                health: 1,
                biome,
            });
         }
         return newBlocks;
    }

    if (level === BOSS_CONFIG.LEVEL + 1) {
        // Empty space above arena
        newBlocks.push({
          id: `w-0-${rowY}`,
          x: 0,
          y: rowY,
          width: TILE_SIZE,
          height: TILE_SIZE,
          type: BlockType.UNBREAKABLE,
          health: 1,
          biome,
        });
        newBlocks.push({
          id: `w-end-${rowY}`,
          x: CANVAS_WIDTH - TILE_SIZE,
          y: rowY,
          width: TILE_SIZE,
          height: TILE_SIZE,
          type: BlockType.UNBREAKABLE,
          health: 1,
          biome,
        });
        return newBlocks;
    }
    
    if (isFloor) {
      for (let x = 0; x < COLS; x++) {
        newBlocks.push({
          id: `f-${x}-${rowY}`,
          x: x * TILE_SIZE,
          y: rowY,
          width: TILE_SIZE,
          height: TILE_SIZE,
          type: BlockType.UNBREAKABLE,
          health: 1,
          biome,
        });
      }
      return newBlocks;
    }

    const difficulty = Math.min(1, level / 100);
    const gapChance = 0.25 + (difficulty * 0.2); 
    const unbreakableChance = 0.1 + (difficulty * 0.2);
    const spikeChance = (biome === BiomeType.BLIZZARD ? 0.1 : (biome === BiomeType.AURORA ? 0.2 : 0));
    // Clouds appear in Aurora biome
    const useClouds = biome === BiomeType.AURORA && Math.random() < 0.6;
    const forcedGapIndex = Math.floor(Math.random() * (COLS - 2)) + 1;

    // Enemy & Item Logic
    const isSafeZone = level < 5;
    let maxEnemiesAllowed = 0;
    if (!isSafeZone) {
        if (level < 20) maxEnemiesAllowed = 2;
        else if (level < 50) maxEnemiesAllowed = 3;
        else maxEnemiesAllowed = 5;
    }

    if (useClouds) {
        // Spawn moving clouds instead of regular blocks row
        // 2 or 3 cloud platforms
        const numClouds = 2 + Math.floor(Math.random() * 2);
        const direction = Math.random() > 0.5 ? 1 : -1;
        const speed = CLOUD_CONFIG.SPEED * direction;
        
        for (let i = 0; i < numClouds; i++) {
             // Spread them out
             const startX = (CANVAS_WIDTH / numClouds) * i + Math.random() * 50;
             newBlocks.push({
                id: `c-${i}-${rowY}`,
                x: startX,
                y: rowY,
                width: TILE_SIZE * 2, // Clouds are wider
                height: TILE_SIZE / 2, // Clouds are thinner
                type: BlockType.CLOUD,
                health: 1,
                biome,
                vx: speed
             });
        }
        
        // Walls for containment (still needed?)
        newBlocks.push({
          id: `w-0-${rowY}`,
          x: 0,
          y: rowY,
          width: TILE_SIZE,
          height: TILE_SIZE,
          type: BlockType.UNBREAKABLE,
          health: 1,
          biome,
        });
        newBlocks.push({
          id: `w-end-${rowY}`,
          x: CANVAS_WIDTH - TILE_SIZE,
          y: rowY,
          width: TILE_SIZE,
          height: TILE_SIZE,
          type: BlockType.UNBREAKABLE,
          health: 1,
          biome,
        });

    } else {
        // Regular Block Generation
        for (let col = 0; col < COLS; col++) {
          if (col === 0 || col === COLS - 1) {
            newBlocks.push({
              id: `w-${col}-${rowY}`,
              x: col * TILE_SIZE,
              y: rowY,
              width: TILE_SIZE,
              height: TILE_SIZE,
              type: BlockType.UNBREAKABLE,
              health: 1,
              biome,
            });
            continue;
          }

          if (col === forcedGapIndex || Math.random() < gapChance) {
            // GAP: Chance for Enemies
            if (!isSafeZone && Math.random() < 0.08 && enemiesRef.current.length < maxEnemiesAllowed) {
                const enemyType = Math.random() > 0.6 ? EnemyType.YETI : EnemyType.BIRD; 
                const config = ENEMY_CONFIG[enemyType];
                const spawnY = rowY - config.height;
                enemiesRef.current.push({
                    x: col * TILE_SIZE,
                    y: spawnY, 
                    vx: config.speed,
                    vy: 0,
                    width: config.width,
                    height: config.height,
                    color: config.color,
                    isGrounded: false,
                    lastGroundedTime: 0,
                    facingRight: true,
                    state: 'run',
                    hitCooldown: 0,
                    type: enemyType,
                    patrolStart: 0,
                    patrolEnd: CANVAS_WIDTH,
                    spawnY: spawnY, 
                    isDead: false,
                    isAttacking: false,
                    attackTimer: 0,
                    attackCooldown: 0,
                    buildTimer: 0
                });
            }
            continue;
          }

          const isSpike = Math.random() < spikeChance;
          
          if (isSpike) {
              newBlocks.push({
                id: `s-${col}-${rowY}`,
                x: col * TILE_SIZE,
                y: rowY,
                width: TILE_SIZE,
                height: TILE_SIZE,
                type: BlockType.SPIKE,
                health: 1,
                biome,
              });
          } else {
              const type = Math.random() < unbreakableChance ? BlockType.UNBREAKABLE : BlockType.NORMAL;
              
              newBlocks.push({
                id: `b-${col}-${rowY}`,
                x: col * TILE_SIZE,
                y: rowY,
                width: TILE_SIZE,
                height: TILE_SIZE,
                type,
                health: 1,
                biome,
              });

              // Chance to spawn Item on top of block
              if (Math.random() < 0.15) {
                  const rand = Math.random();
                  let itemType = ItemType.EGGPLANT;
                  if (rand > 0.6) itemType = ItemType.CARROT;
                  if (rand > 0.9) itemType = ItemType.CABBAGE;

                  const iConfig = ITEM_CONFIG[itemType];
                  itemsRef.current.push({
                      id: `i-${col}-${rowY}`,
                      x: col * TILE_SIZE + (TILE_SIZE - iConfig.width)/2,
                      y: rowY - iConfig.height - 5,
                      type: itemType,
                      width: iConfig.width,
                      height: iConfig.height,
                      collected: false,
                      floatOffset: Math.random() * Math.PI * 2
                  });
              }
          }
        }
    }

    return newBlocks;
  };

  const initGame = useCallback(() => {
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - PLAYER_SIZE.width / 2,
      y: CANVAS_HEIGHT - TILE_SIZE * 3,
      vx: 0,
      vy: 0,
      width: PLAYER_SIZE.width,
      height: PLAYER_SIZE.height,
      color: COLORS.player,
      isGrounded: true,
      lastGroundedTime: Date.now(),
      facingRight: true,
      state: 'idle',
      hitCooldown: 0,
      isAttacking: false,
      attackTimer: 0,
      attackCooldown: 0,
      rotation: 0
    };

    // Reset Boss
    bossRef.current = {
      x: CANVAS_WIDTH / 2 - BOSS_CONFIG.WIDTH / 2,
      y: -BOSS_CONFIG.LEVEL * TILE_SIZE * 4 - 300,
      vx: BOSS_CONFIG.SPEED,
      vy: 0,
      width: BOSS_CONFIG.WIDTH,
      height: BOSS_CONFIG.HEIGHT,
      color: BOSS_CONFIG.COLOR,
      hp: BOSS_CONFIG.HP,
      maxHp: BOSS_CONFIG.HP,
      isActive: false,
      phase: 0,
      moveTimer: 0,
      isGrounded: false,
      lastGroundedTime: 0,
      facingRight: false,
      state: 'idle',
      hitCooldown: 0,
      isAttacking: false,
      attackTimer: 0,
      attackCooldown: 0
    };

    cameraYRef.current = 0;
    maxScrollRef.current = 0;
    highestGenYRef.current = CANVAS_HEIGHT - TILE_SIZE;
    scoreRef.current = 0;
    traumaRef.current = 0;
    lastShopLevelRef.current = 0;
    hitStopRef.current = 0;
    comboRef.current = { count: 0, timer: 0, multiplier: 1 };

    mapRef.current = [];
    enemiesRef.current = [];
    itemsRef.current = [];
    particlesRef.current = [];
    projectilesRef.current = [];
    floatingTextsRef.current = [];
    
    setBossStatus({ active: false, hp: 0, maxHp: 100 });

    // Generate initial rows
    for (let i = 0; i < 8; i++) {
      const level = i;
      const y = CANVAS_HEIGHT - TILE_SIZE - (i * TILE_SIZE * 4); 
      const newRow = generateRow(y, level);
      mapRef.current.push(...newRow);
      highestGenYRef.current = y;
    }

    snowRef.current = Array.from({ length: 100 }).map(() => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      speed: 1 + Math.random() * 3,
      size: 1 + Math.random() * 3,
      opacity: 0.3 + Math.random() * 0.7,
      wobble: Math.random() * Math.PI * 2,
    }));
  }, [setBossStatus]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && mapRef.current.length === 0) {
      initGame();
    }
  }, [gameState, initGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- PHYSICS ENGINE ---
  const checkRectOverlap = (r1: {x: number, y: number, width: number, height: number}, r2: {x: number, y: number, width: number, height: number}) => {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  };

  const spawnParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 1) * 10 - 2, // Upward bias
        life: 1.0,
        maxLife: 1.0,
        size: Math.random() * 8 + 4,
        color: color,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        gravity: 0.5,
        bounce: true
      });
    }
    // Dust
    for (let i = 0; i < 4; i++) {
         particlesRef.current.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 0.6,
            maxLife: 0.6,
            size: Math.random() * 4,
            color: 'rgba(255,255,255,0.5)',
            rotation: 0,
            rotSpeed: 0,
            gravity: 0,
            bounce: false
         });
    }
  };

  const breakBlock = (blockIndex: number) => {
    const block = mapRef.current[blockIndex];
    if (!block || block.type === BlockType.UNBREAKABLE) {
      return;
    }
    // Cannot break clouds or spikes from below
    if (block.type === BlockType.CLOUD || block.type === BlockType.SPIKE) return;
    
    const mult = incrementCombo(block.x + block.width/2, block.y);

    spawnParticles(block.x + block.width/2, block.y + block.height/2, COLORS.iceBase);
    addTrauma(SHAKE_INTENSITY.MEDIUM);
    audioManager.playBreak();
    triggerHitStop(3); // 3 frames freeze
    mapRef.current.splice(blockIndex, 1);
    
    const points = Math.floor(100 * mult);
    scoreRef.current += points;
    setScore(s => s + points);
  };

  const updatePhysics = (dt: number) => {
    const player = playerRef.current;
    
    // Death Logic
    if (player.state === 'die') {
        player.vy += PHYSICS.gravity;
        player.y += player.vy;
        player.x += player.vx;
        player.rotation = (player.rotation || 0) + 0.2;
        
        // Check dead zone
        if (player.y > cameraYRef.current + CANVAS_HEIGHT + 200) {
            setGameStateRef.current(GameState.GAME_OVER);
        }
        return;
    }

    // Determine Current Biome and apply Environmental Effects
    const currentLevel = Math.floor(Math.abs(Math.min(0, player.y)) / TILE_SIZE);
    const biome = getBiomeAtLevel(currentLevel);
    
    // Wind Force (Blizzard only)
    let windForce = 0;
    if (biome === BiomeType.BLIZZARD) {
        const time = Date.now() / 2000;
        windOffsetRef.current = Math.sin(time) * 100;
        // Periodic wind gusts
        if (Math.sin(time * 3) > 0.5) {
            windForce = Math.sin(time * 3) * 0.3; 
        }
    } else {
        windOffsetRef.current = 0;
    }

    // Apply Upgrades
    const activeFriction = player.isGrounded 
        ? (upgrades[UpgradeType.SPIKED_BOOTS] ? 0.7 : PHYSICS.friction) 
        : PHYSICS.airFriction;

    const activeGravity = upgrades[UpgradeType.FEATHERWEIGHT] ? PHYSICS.gravity * 0.7 : PHYSICS.gravity;
    const activeJumpForce = upgrades[UpgradeType.FEATHERWEIGHT] ? PHYSICS.jumpForce * 1.1 : PHYSICS.jumpForce;

    // Update Trauma
    traumaRef.current = Math.max(0, traumaRef.current - 0.02);
    
    // --- Update Moving Blocks (Clouds) ---
    for(const block of mapRef.current) {
        if (block.type === BlockType.CLOUD && block.vx) {
            block.x += block.vx;
            // Wrap around
            if (block.vx > 0 && block.x > CANVAS_WIDTH) block.x = -block.width;
            if (block.vx < 0 && block.x + block.width < 0) block.x = CANVAS_WIDTH;
        }
    }

    // --- 0. Combat Logic ---
    if (player.attackCooldown > 0) player.attackCooldown--;
    
    if ((keysPressed.current['KeyZ'] || keysPressed.current['KeyJ']) && !player.isAttacking && player.attackCooldown <= 0) {
        player.isAttacking = true;
        player.attackTimer = 15; // Attack lasts 15 frames (~0.25s)
        player.attackCooldown = 30; // 0.5s cooldown
        audioManager.playSwing();
    }

    if (player.isAttacking) {
        player.attackTimer--;
        if (player.attackTimer <= 0) {
            player.isAttacking = false;
        } else {
            // Check Hits
            const reach = upgrades[UpgradeType.POWER_HAMMER] ? 60 : 45; // Increased reach
            const hitbox = {
                x: player.facingRight ? player.x + player.width/2 : player.x + player.width/2 - reach,
                y: player.y,
                width: reach,
                height: player.height
            };
            
            // Hit Enemies
            enemiesRef.current.forEach(enemy => {
                if (enemy.isDead) return;
                if (checkRectOverlap(hitbox, enemy)) {
                    enemy.isDead = true;
                    spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                    addTrauma(SHAKE_INTENSITY.MEDIUM);
                    audioManager.playEnemyHit();
                    triggerHitStop(5);
                    
                    const mult = incrementCombo(enemy.x, enemy.y);
                    const points = Math.floor(500 * mult);
                    const heatGain = Math.floor(20 * mult);
                    scoreRef.current += points;
                    setScore(s => s + points);
                    setHeat(h => h + heatGain);
                    spawnFloatingText(enemy.x, enemy.y - 20, "SMASH!", "#ef4444", 16);
                    spawnFloatingText(enemy.x + 20, enemy.y - 40, `+${heatGain}🔥`, "#fbbf24", 12);
                }
            });

            // Hit Projectiles (Reflect)
            projectilesRef.current.forEach(proj => {
                if (proj.isReflected) return;
                if (checkRectOverlap(hitbox, proj)) {
                    proj.isReflected = true;
                    proj.vy = -PROJECTILE_CONFIG.REFLECT_SPEED; // Shoot up
                    proj.vx = (Math.random() - 0.5) * 2;
                    proj.color = '#ef4444'; // Turn red
                    audioManager.playEnemyHit(); // reused sound
                    triggerHitStop(4);
                    addTrauma(SHAKE_INTENSITY.MEDIUM);
                    spawnFloatingText(proj.x, proj.y, "REFLECT!", "#3b82f6", 12);
                }
            });
        }
    }

    // --- 0.5 Boss Logic ---
    const boss = bossRef.current;
    // Check if player is near level 19 arena
    const bossArenaY = -BOSS_CONFIG.LEVEL * TILE_SIZE * 4;
    // Activate boss when player is close
    if (!boss.isActive && player.y < bossArenaY + CANVAS_HEIGHT) {
        boss.isActive = true;
        boss.y = bossArenaY - 200; // Position boss
        setBossStatus({ active: true, hp: boss.hp, maxHp: boss.maxHp });
    }

    if (boss.isActive && boss.hp > 0) {
        boss.moveTimer++;
        boss.y = bossArenaY - 200 + Math.sin(boss.moveTimer * 0.05) * 20; // Hover
        boss.x += boss.vx;
        if (boss.x <= 0 || boss.x + boss.width >= CANVAS_WIDTH) boss.vx *= -1;
        
        // Attack
        if (boss.moveTimer % BOSS_CONFIG.ATTACK_INTERVAL === 0) {
            projectilesRef.current.push({
                x: boss.x + boss.width / 2 - PROJECTILE_CONFIG.WIDTH / 2,
                y: boss.y + boss.height,
                vx: (player.x - (boss.x + boss.width/2)) * 0.02, // Aim at player
                vy: 5,
                width: PROJECTILE_CONFIG.WIDTH,
                height: PROJECTILE_CONFIG.HEIGHT,
                color: '#a5f3fc',
                isGrounded: false,
                lastGroundedTime: 0,
                facingRight: false,
                state: 'fall',
                hitCooldown: 0,
                isAttacking: false,
                attackTimer: 0,
                attackCooldown: 0,
                id: Math.random(),
                isReflected: false,
                damage: 1,
                rotation: 0
            });
        }
    } else if (boss.hp <= 0 && boss.isActive) {
        // Boss Dead
        boss.isActive = false;
        setBossStatus({ active: false, hp: 0, maxHp: boss.maxHp });
        spawnParticles(boss.x + boss.width/2, boss.y + boss.height/2, boss.color);
        addTrauma(SHAKE_INTENSITY.LARGE);
        triggerHitStop(10);
        // Spawn rewards
        for(let i=0; i<10; i++) {
             itemsRef.current.push({
                  id: `boss-reward-${i}`,
                  x: boss.x + Math.random() * boss.width,
                  y: boss.y + Math.random() * boss.height,
                  type: ItemType.CABBAGE,
                  width: 20,
                  height: 20,
                  collected: false,
                  floatOffset: Math.random() * Math.PI
              });
        }
    }

    // --- 0.6 Projectile Logic ---
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const p = projectilesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += 0.1;
        
        if (p.isReflected) {
             // Check collision with Boss
             if (boss.isActive && checkRectOverlap(p, boss)) {
                 boss.hp -= 50;
                 setBossStatus({ active: true, hp: boss.hp, maxHp: boss.maxHp });
                 spawnParticles(p.x, p.y, '#ef4444');
                 audioManager.playBreak();
                 projectilesRef.current.splice(i, 1);
                 spawnFloatingText(boss.x + boss.width/2, boss.y, "-50", "#ef4444", 20);
                 triggerHitStop(4);
                 continue;
             }
        } else {
             // Check collision with Player
             if (checkRectOverlap(p, player)) {
                 triggerPlayerDeath();
             }
        }
        
        // Remove if out of bounds
        if (p.y > cameraYRef.current + CANVAS_HEIGHT || p.y < cameraYRef.current - 1000) {
            projectilesRef.current.splice(i, 1);
        }
    }

    // --- 1. Apply Gravity, Friction & Wind ---
    const accel = player.isGrounded ? PHYSICS.accel : PHYSICS.airAccel;
    
    // Input handling
    let inputVx = 0;
    if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
      inputVx = -6;
      player.facingRight = false;
      player.state = 'run';
    } else if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
      inputVx = 6;
      player.facingRight = true;
      player.state = 'run';
    } else {
      player.state = 'idle';
    }

    if (inputVx !== 0) {
        player.vx += (inputVx - player.vx) * accel;
    } else {
        player.vx *= activeFriction;
    }

    // Apply Wind
    if (!player.isGrounded) {
        player.vx += windForce;
    }

    // Vertical Gravity
    player.vy += activeGravity;
    if (player.vy > PHYSICS.terminalVelocity) player.vy = PHYSICS.terminalVelocity;

    // Jump Input
    const now = Date.now();
    const canJump = player.isGrounded || (now - player.lastGroundedTime < PHYSICS.coyoteTime);
    
    if ((keysPressed.current['ArrowUp'] || keysPressed.current['KeyW'] || keysPressed.current['Space']) && canJump) {
      if (player.vy >= 0) { 
          player.vy = activeJumpForce;
          player.isGrounded = false;
          player.lastGroundedTime = 0;
          player.state = 'jump';
          audioManager.playJump();
      }
    }

    // --- 2. X-AXIS MOVEMENT & COLLISION ---
    player.x += player.vx;
    
    // Cloud Carry Logic X
    if (player.isGrounded) {
         // Find if we are on a moving block
         // We do this by checking slightly below player
         const footCheck = { x: player.x, y: player.y + player.height + 1, width: player.width, height: 2 };
         for(const block of mapRef.current) {
             if (block.type === BlockType.CLOUD && block.vx && checkRectOverlap(footCheck, block)) {
                 player.x += block.vx;
                 break;
             }
         }
    }
    
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.width > CANVAS_WIDTH) { player.x = CANVAS_WIDTH - player.width; player.vx = 0; }

    for (const block of mapRef.current) {
      if (checkRectOverlap(player, block)) {
        if (block.type === BlockType.SPIKE) {
            triggerPlayerDeath();
            return;
        }
        
        // Cloud allow side entry? No, treat solid for now or jump through?
        // Original game: clouds are solid platforms you can jump through from bottom
        if (block.type === BlockType.CLOUD) {
            // No horizontal collision for clouds, pass through
        } else {
            if (player.vx > 0) {
               player.x = block.x - player.width - 0.01;
               player.vx = 0;
            } else if (player.vx < 0) {
               player.x = block.x + block.width + 0.01;
               player.vx = 0;
            }
        }
      }
    }

    // --- 3. Y-AXIS MOVEMENT & COLLISION ---
    const prevY = player.y; 
    player.y += player.vy;
    player.isGrounded = false; 

    for (let i = 0; i < mapRef.current.length; i++) {
      const block = mapRef.current[i];
      if (checkRectOverlap(player, block)) {
        if (block.type === BlockType.SPIKE) {
            triggerPlayerDeath();
            return;
        }

        const overlapX = Math.min(player.x + player.width, block.x + block.width) - Math.max(player.x, block.x);
        
        if (player.vy > 0) {
          // FALLING
          const wasAbove = prevY + player.height <= block.y + 16; 
          
          if (wasAbove) {
            player.y = block.y - player.height;
            player.vy = 0;
            player.isGrounded = true;
            player.lastGroundedTime = Date.now();
            player.state = Math.abs(player.vx) > 0.1 ? 'run' : 'idle';
            
            // Landing shake
            if (player.vy > 10) addTrauma(SHAKE_INTENSITY.SMALL);
          }
        } else if (player.vy < 0) {
          // JUMPING / HEAD BONK
          if (block.type === BlockType.CLOUD) {
               // Jump through clouds
          } else {
              if (overlapX < PHYSICS.cornerCorrection) {
                 if ((player.x + player.width/2) < (block.x + block.width/2)) {
                    player.x = block.x - player.width - 1; 
                 } else {
                    player.x = block.x + block.width + 1;
                 }
              } else {
                 player.y = block.y + block.height;
                 player.vy = 0;
                 breakBlock(i);
              }
          }
        }
      }
    }

    // --- 4. ITEM COLLECTION ---
    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
        const item = itemsRef.current[i];
        if (item.collected) continue;
        
        if (checkRectOverlap(player, item)) {
            const config = ITEM_CONFIG[item.type];
            item.collected = true;
            const mult = incrementCombo(item.x, item.y);
            const points = Math.floor(config.points * mult);
            
            scoreRef.current += points;
            setScore(s => s + points);
            setHeat(h => h + config.heat);
            spawnFloatingText(item.x, item.y, `+${config.heat}🔥`, '#fcd34d');
            audioManager.playCollect();
            
            // Particle burst on collect
            for(let j=0; j<5; j++) {
                particlesRef.current.push({
                    x: item.x + item.width/2,
                    y: item.y + item.height/2,
                    vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                    life: 0.5, maxLife: 0.5, size: 3, color: config.color,
                    rotation: 0, rotSpeed: 0, gravity: 0, bounce: false
                });
            }
            itemsRef.current.splice(i, 1);
        }
    }
  };

  const updateEnemies = () => {
      enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead) return;
          
          if (enemy.type === EnemyType.BIRD) {
              enemy.x += enemy.vx;
              const t = Date.now();
              enemy.y = enemy.spawnY + Math.sin(t * 0.005) * 15;
              if (enemy.vx > 0) enemy.facingRight = true;
              if (enemy.vx < 0) enemy.facingRight = false;
              if (enemy.x <= 0 || enemy.x + enemy.width >= CANVAS_WIDTH) enemy.vx *= -1;

          } else {
              // YETI AI
              enemy.vy += PHYSICS.gravity;
              enemy.x += enemy.vx;
              enemy.y += enemy.vy;

              if (enemy.vx > 0) enemy.facingRight = true;
              if (enemy.vx < 0) enemy.facingRight = false;
              
              // Patrol bounds (Screen edges)
              if (enemy.x <= 0) {
                   enemy.x = 0; enemy.vx *= -1;
              }
              if (enemy.x + enemy.width >= CANVAS_WIDTH) {
                   enemy.x = CANVAS_WIDTH - enemy.width; enemy.vx *= -1;
              }

              enemy.isGrounded = false;
              let onGround = false;
              
              for (const block of mapRef.current) {
                  if (checkRectOverlap(enemy, block)) {
                      if (enemy.vy > 0 && (enemy.y + enemy.height - enemy.vy <= block.y + 10)) {
                          enemy.y = block.y - enemy.height;
                          enemy.vy = 0;
                          enemy.isGrounded = true;
                          onGround = true;
                      } else if (Math.abs(enemy.vx) > 0) {
                          // Hit wall
                          const overlapY = Math.min(enemy.y + enemy.height, block.y + block.height) - Math.max(enemy.y, block.y);
                          if (overlapY > 5) enemy.vx *= -1;
                      }
                  }
              }

              // REPAIR LOGIC
              if (onGround && enemy.type === EnemyType.YETI) {
                  // Check if there is a hole ahead or we are at edge of platform
                  const lookAheadX = enemy.vx > 0 ? enemy.x + enemy.width + 5 : enemy.x - 5;
                  const lookAheadRect = { x: lookAheadX, y: enemy.y + enemy.height + 2, width: 5, height: 5 };
                  
                  // Also check for empty space directly in front (wall building)
                  const wallCheckRect = { x: lookAheadX, y: enemy.y, width: 5, height: enemy.height };

                  let hasGroundAhead = false;
                  let hasWallAhead = false;
                  
                  for(const b of mapRef.current) {
                      if (checkRectOverlap(lookAheadRect, b)) hasGroundAhead = true;
                      if (checkRectOverlap(wallCheckRect, b)) hasWallAhead = true;
                  }
                  
                  // If gap detected or wall ahead, turnaround or build
                  if (!hasGroundAhead || hasWallAhead) {
                      // 30% chance to build to fix gap/block player
                      if (enemy.state !== 'build' && Math.random() < 0.02) {
                          enemy.state = 'build';
                          enemy.buildTimer = ENEMY_CONFIG.YETI.buildTime;
                          enemy.vx = 0;
                      } else if (enemy.state !== 'build') {
                          enemy.vx *= -1;
                      }
                  }
              }
              
              if (enemy.state === 'build') {
                  enemy.buildTimer--;
                  if (enemy.buildTimer <= 0) {
                      enemy.state = 'run';
                      enemy.vx = enemy.facingRight ? ENEMY_CONFIG.YETI.speed : -ENEMY_CONFIG.YETI.speed;
                      
                      // Place block
                      const buildX = enemy.facingRight ? enemy.x + enemy.width : enemy.x - TILE_SIZE;
                      // Align to grid
                      const gridX = Math.round(buildX / TILE_SIZE) * TILE_SIZE;
                      const gridY = Math.round(enemy.y / TILE_SIZE) * TILE_SIZE; // Maybe slightly offset?
                      
                      // Check overlap with existing
                      const newBlock = { x: gridX, y: gridY + enemy.height, width: TILE_SIZE, height: TILE_SIZE };
                      let canBuild = true;
                      for(const b of mapRef.current) {
                          if (checkRectOverlap(newBlock, b)) { canBuild = false; break; }
                      }
                      
                      if (canBuild) {
                          mapRef.current.push({
                              id: `built-${Date.now()}`,
                              x: gridX, y: gridY + enemy.height, // Build floor extension? Or wall? Let's build floor extension.
                              width: TILE_SIZE, height: TILE_SIZE,
                              type: BlockType.NORMAL,
                              health: 1,
                              biome: BiomeType.ICE_CAVE
                          });
                          spawnParticles(gridX + TILE_SIZE/2, gridY + TILE_SIZE + TILE_SIZE/2, '#cbd5e1');
                          audioManager.playBreak(); // reuse sound
                      }
                  }
              }
          }

          if (checkRectOverlap(playerRef.current, enemy)) {
             triggerPlayerDeath();
          }
      });
  };

  const updateCamera = () => {
    const player = playerRef.current;
    
    const topGenThreshold = cameraYRef.current - CANVAS_HEIGHT;
    if (highestGenYRef.current > topGenThreshold) {
        for (let i = 0; i < 5; i++) {
            const y = highestGenYRef.current - (TILE_SIZE * 4);
            const level = Math.floor(Math.abs(y) / (TILE_SIZE * 4));
            const newRow = generateRow(y, level);
            mapRef.current.push(...newRow);
            highestGenYRef.current = y;
        }
        // Cleanup entities off screen
        const cleanupThreshold = cameraYRef.current + CANVAS_HEIGHT * 1.5;
        mapRef.current = mapRef.current.filter(b => b.y < cleanupThreshold);
        enemiesRef.current = enemiesRef.current.filter(e => e.y < cleanupThreshold);
        itemsRef.current = itemsRef.current.filter(i => i.y < cleanupThreshold);
    }

    // Focus on Boss if active
    let targetY = player.y - CANVAS_HEIGHT * 0.6;
    if (bossRef.current.isActive) {
         // Lock camera slightly to keep boss in view
         const bossCenter = bossRef.current.y + bossRef.current.height/2;
         targetY = bossCenter - CANVAS_HEIGHT * 0.3;
    }

    if (targetY < cameraYRef.current) {
        cameraYRef.current += (targetY - cameraYRef.current) * 0.1;
    }

    if (player.y > cameraYRef.current + CANVAS_HEIGHT + 50 && player.state !== 'die') {
        triggerPlayerDeath();
    }
    
    const currentAlt = Math.floor(Math.abs(Math.min(0, player.y)) / TILE_SIZE);
    if (currentAlt > maxScrollRef.current) {
        maxScrollRef.current = currentAlt;
        const scoreGain = (currentAlt - maxScrollRef.current) * 10;
        scoreRef.current += scoreGain;
        setScore(s => s + scoreGain);
        setAltitude(currentAlt);
        setBiome(getBiomeAtLevel(currentAlt));

        // Check Shop Trigger (Every 20 levels)
        if (currentAlt > 10 && currentAlt % 20 === 0 && currentAlt > lastShopLevelRef.current) {
            lastShopLevelRef.current = currentAlt;
            setGameStateRef.current(GameState.SHOP);
        }
    }
  };

  // --- DRAWING ---
  const drawBoss = (ctx: CanvasRenderingContext2D) => {
      const b = bossRef.current;
      if (!b.isActive || b.hp <= 0) return;
      
      const t = Date.now() / 200;
      
      ctx.save();
      ctx.translate(b.x + b.width/2, b.y + b.height/2);
      
      // Glow
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 20;
      
      // Body (Ice Golem)
      ctx.fillStyle = b.color;
      // Jagged shape
      ctx.beginPath();
      for(let i=0; i<8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const rad = (b.width/2) + Math.sin(t + i*2) * 5;
          ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
      }
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(-15, -10, 8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -10, 8, 0, Math.PI*2); ctx.fill();
      
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(-15, -10, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -10, 3, 0, Math.PI*2); ctx.fill();
      
      ctx.restore();
  };
  
  const drawProjectiles = (ctx: CanvasRenderingContext2D) => {
      projectilesRef.current.forEach(p => {
          ctx.save();
          ctx.translate(p.x + p.width/2, p.y + p.height/2);
          ctx.rotate(p.rotation);
          
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          
          ctx.beginPath();
          ctx.moveTo(-p.width/2, -p.height/2);
          ctx.lineTo(p.width/2, -p.height/2);
          ctx.lineTo(0, p.height/2); // Pointy tip
          ctx.fill();
          
          ctx.restore();
      });
  };

  const drawSpike = (ctx: CanvasRenderingContext2D, b: Block) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = '#e2e8f0'; // Spike color
      ctx.beginPath();
      // Draw 3 spikes
      ctx.moveTo(0, b.height);
      ctx.lineTo(b.width * 0.2, 0);
      ctx.lineTo(b.width * 0.4, b.height);
      ctx.lineTo(b.width * 0.6, 10);
      ctx.lineTo(b.width * 0.8, b.height);
      ctx.lineTo(b.width, 5);
      ctx.lineTo(b.width, b.height);
      ctx.fill();
      ctx.restore();
  };

  const drawCloud = (ctx: CanvasRenderingContext2D, b: Block) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = CLOUD_CONFIG.COLOR;
      
      // Fluffy shapes
      const puffs = 3;
      const puffW = b.width / puffs;
      ctx.beginPath();
      for(let i=0; i<puffs; i++) {
          ctx.arc(puffW/2 + i*puffW, b.height/2, b.height/1.5, 0, Math.PI*2);
      }
      ctx.fill();
      
      // Flat top for walking
      // ctx.fillRect(0, 0, b.width, b.height/2);
      
      ctx.restore();
  };

  const drawItem = (ctx: CanvasRenderingContext2D, item: Item) => {
      const t = Date.now() / 200;
      const bob = Math.sin(t + item.floatOffset) * 3;
      const config = ITEM_CONFIG[item.type];

      ctx.save();
      ctx.translate(item.x + item.width/2, item.y + item.height/2 + bob);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 12 - bob, 6, 2, 0, 0, Math.PI*2); ctx.fill();

      if (item.type === ItemType.EGGPLANT) {
          ctx.fillStyle = config.color;
          ctx.beginPath(); ctx.ellipse(0, 2, 8, 10, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#86efac'; // Stem
          ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(0, -10, 4, -6); ctx.lineTo(0, -4); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(2, -12); ctx.stroke();
      } else if (item.type === ItemType.CARROT) {
          ctx.fillStyle = config.color;
          ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.lineTo(0, 10); ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-3, -12); ctx.moveTo(0, -6); ctx.lineTo(3, -12); ctx.stroke();
      } else if (item.type === ItemType.CABBAGE) {
          ctx.fillStyle = config.color;
          ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#4ade80';
          ctx.beginPath(); ctx.arc(-2, 0, 5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(3, 3, 4, 0, Math.PI*2); ctx.fill();
      }
      
      ctx.restore();
  };

  const drawFloatingTexts = (ctx: CanvasRenderingContext2D) => {
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      floatingTextsRef.current.forEach(ft => {
          ctx.fillStyle = ft.color;
          ctx.globalAlpha = ft.life;
          ctx.fillText(ft.text, ft.x + 10, ft.y);
          
          // Outline
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'black';
          ctx.strokeText(ft.text, ft.x + 10, ft.y);
      });
      ctx.globalAlpha = 1;
  };

  const drawCombo = (ctx: CanvasRenderingContext2D) => {
      if (comboRef.current.timer > 0 && comboRef.current.count > 1) {
          ctx.save();
          const scale = 1 + (comboRef.current.timer / 120) * 0.2;
          ctx.translate(CANVAS_WIDTH - 20, 100);
          ctx.scale(scale, scale);
          ctx.rotate(-0.2);
          ctx.textAlign = 'right';
          
          ctx.font = 'bold 30px "Press Start 2P", monospace';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`${comboRef.current.count}x`, 0, 0);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#78350f';
          ctx.strokeText(`${comboRef.current.count}x`, 0, 0);
          
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = 'white';
          ctx.fillText(`MULTIPLIER`, 0, 15);
          
          ctx.restore();
      }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Entity) => {
    ctx.save();
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    ctx.translate(Math.floor(cx), Math.floor(cy));
    
    // Death Rotation
    if (p.state === 'die') {
        ctx.rotate(p.rotation || 0);
    }

    if (!p.facingRight) ctx.scale(-1, 1);

    const t = Date.now();
    const isRun = Math.abs(p.vx) > 0.1;
    const isJump = !p.isGrounded;
    const runCycle = isRun ? Math.sin(t * 0.02) : 0;
    const bounce = isRun ? Math.abs(Math.sin(t * 0.02)) * 2 : 0;

    const parkaMain = p.color;
    const parkaDark = '#2563eb'; 
    const fur = '#f8fafc';
    const skin = COLORS.playerSkin;
    const hammerWood = '#78350f';
    const hammerIron = '#64748b';

    // Hammer Logic
    // If attacking, rotate hammer 90 degrees down
    ctx.save();
    let armAngle = isRun ? -Math.PI/4 + runCycle * 0.5 : -Math.PI/4;
    
    if (p.isAttacking) {
        // Simple swing animation based on timer (15 -> 0)
        // Lerp from -45deg to +45deg
        const progress = 1 - (p.attackTimer / 15);
        armAngle = -Math.PI/4 + (Math.PI/2 * Math.sin(progress * Math.PI));
    }

    ctx.rotate(armAngle);
    ctx.translate(-6, 4);
    
    // Check for power hammer
    const isPower = upgrades[UpgradeType.POWER_HAMMER];
    
    ctx.fillStyle = hammerWood;
    ctx.fillRect(-2, -14, 4, 20);
    
    // Hammer head
    ctx.fillStyle = isPower ? '#f59e0b' : hammerIron; // Gold if power hammer
    if (isPower) {
         // Bigger head
         ctx.fillRect(-8, -22, 16, 12);
         // Glow
         ctx.shadowColor = '#f59e0b';
         ctx.shadowBlur = 10;
    } else {
         ctx.fillRect(-6, -18, 12, 8);
    }
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = parkaMain;
    ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Legs
    ctx.fillStyle = '#1e293b'; 
    if (isJump) {
        ctx.fillRect(-8, 12, 6, 6); 
        ctx.fillRect(2, 10, 6, 6); 
    } else {
        ctx.fillRect(-8 - runCycle * 3, 14, 6, 6); 
        ctx.fillRect(2 + runCycle * 3, 14, 6, 6);
    }

    // Body
    ctx.translate(0, -bounce);
    ctx.fillStyle = parkaMain;
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(10, -8);
    ctx.lineTo(12, 14);
    ctx.lineTo(-12, 14);
    ctx.fill();

    // Fur Trim
    ctx.fillStyle = fur;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-12, 12, 24, 5, 2);
    else ctx.rect(-12, 12, 24, 5);
    ctx.fill();

    // Head
    ctx.translate(0, -12);
    ctx.fillStyle = parkaDark;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = parkaMain;
    ctx.beginPath();
    ctx.arc(0, -1, 11, Math.PI, 0); 
    ctx.lineTo(11, 5);
    ctx.arc(0, 5, 11, 0, Math.PI); 
    ctx.fill();

    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.arc(0, 1, 9, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    if (p.facingRight) {
        ctx.ellipse(3, 0, 1.5, 2.5, 0, 0, Math.PI*2);
        ctx.ellipse(-1, 0, 1.5, 2.5, 0, 0, Math.PI*2);
    } else {
        ctx.ellipse(-3, 0, 1.5, 2.5, 0, 0, Math.PI*2);
        ctx.ellipse(1, 0, 1.5, 2.5, 0, 0, Math.PI*2);
    }
    ctx.fill();

    // Death eyes
    if (p.state === 'die') {
         ctx.strokeStyle = '#0f172a';
         ctx.lineWidth = 1.5;
         ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(1, 3); ctx.moveTo(1, -1); ctx.lineTo(-3, 3); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(3, -1); ctx.lineTo(7, 3); ctx.moveTo(7, -1); ctx.lineTo(3, 3); ctx.stroke();
    } else {
         ctx.fillStyle = 'rgba(244, 63, 94, 0.3)';
         ctx.beginPath();
         ctx.arc(4, 3, 2, 0, Math.PI*2);
         ctx.arc(-4, 3, 2, 0, Math.PI*2);
         ctx.fill();
    }

    ctx.restore();
  };

  const drawIceBlock = (ctx: CanvasRenderingContext2D, b: Block) => {
    if (b.type === BlockType.SPIKE) {
        drawSpike(ctx, b);
        return;
    }
    if (b.type === BlockType.CLOUD) {
        drawCloud(ctx, b);
        return;
    }

    const isUnbreakable = b.type === BlockType.UNBREAKABLE;
    
    let mainColor, lightColor, darkColor, snowColor;
    if (isUnbreakable) {
      mainColor = '#475569'; lightColor = '#94a3b8'; darkColor = '#1e293b'; snowColor = '#cbd5e1';
    } else {
      switch (b.biome) {
        case BiomeType.BLIZZARD: mainColor = '#64748b'; lightColor = '#cbd5e1'; darkColor = '#334155'; snowColor = '#f8fafc'; break;
        case BiomeType.AURORA: mainColor = '#7c3aed'; lightColor = '#c4b5fd'; darkColor = '#4c1d95'; snowColor = '#2dd4bf'; break;
        case BiomeType.ICE_CAVE: default: mainColor = '#06b6d4'; lightColor = '#67e8f9'; darkColor = '#0e7490'; snowColor = '#ecfeff'; break;
      }
    }

    const seed = b.x * 13 + b.y * 7; 
    ctx.save();

    const r = 6;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.width, b.height, r);
    else ctx.rect(b.x, b.y, b.width, b.height);
    ctx.clip(); 

    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height);
    grad.addColorStop(0, lightColor);
    grad.addColorStop(0.4, mainColor);
    grad.addColorStop(1, darkColor);
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, b.width, b.height);

    if (isUnbreakable) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for(let i=0; i<b.width; i+=8) ctx.fillRect(b.x + i, b.y, 2, b.height);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(b.x, b.y, b.width, 2);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        for(let i=0; i<3; i++) {
            const p1x = b.x + pseudoRandom(seed + i) * b.width;
            const p1y = b.y + pseudoRandom(seed + i + 1) * b.height;
            const p2x = b.x + pseudoRandom(seed + i + 2) * b.width;
            const p2y = b.y + pseudoRandom(seed + i + 3) * b.height;
            const p3x = b.x + pseudoRandom(seed + i + 4) * b.width;
            const p3y = b.y + pseudoRandom(seed + i + 5) * b.height;
            ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(p3x, p3y);
        }
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const cx = b.x + b.width/2;
        const cy = b.y + b.height/2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (pseudoRandom(seed)*20 - 10), cy + (pseudoRandom(seed+1)*20));
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x + r, b.y + 2); ctx.lineTo(b.x + b.width - r, b.y + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + r); ctx.lineTo(b.x + 2, b.y + b.height - r); ctx.stroke();

    const snowDepth = b.biome === BiomeType.BLIZZARD ? 10 : 6;
    ctx.fillStyle = snowColor;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + snowDepth);
    const waves = 4;
    const waveW = b.width / waves;
    for(let i=0; i<=waves; i++) {
        const wx = b.x + i * waveW;
        const wy = b.y + snowDepth + (pseudoRandom(seed + i + 10) * 4); 
        if (i === 0) ctx.moveTo(b.x, b.y + snowDepth);
        else {
           const prevX = b.x + (i-1) * waveW;
           const cx = (prevX + wx) / 2;
           ctx.quadraticCurveTo(cx, wy, wx, b.y + snowDepth);
        }
    }
    ctx.lineTo(b.x + b.width, b.y);
    ctx.lineTo(b.x, b.y);
    ctx.fill();
    ctx.restore();
  };

  const drawYeti = (ctx: CanvasRenderingContext2D, e: Enemy) => {
      const t = Date.now() / 150;
      const bounce = Math.sin(t) * 2;
      const walk = Math.cos(t) * 4;

      ctx.save();
      ctx.translate(e.x + e.width/2, e.y + e.height/2);
      if (!e.facingRight) ctx.scale(-1, 1);
      
      // Building animation
      if (e.state === 'build') {
          const buildProgress = 1 - (e.buildTimer / ENEMY_CONFIG.YETI.buildTime);
          const hammerAngle = Math.sin(buildProgress * Math.PI * 4) * 0.5;
          ctx.rotate(0.2); // Lean forward
          ctx.translate(0, 5); // Crouch
          
          // Hammer
          ctx.save();
          ctx.rotate(hammerAngle);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(10, 0, 8, 4);
          ctx.fillRect(14, -4, 4, 12);
          ctx.restore();
      }

      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath(); ctx.ellipse(0, 0 + bounce, 14, 13, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath(); ctx.arc(0, 6 + bounce, 10, 0, Math.PI); ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.ellipse(4, -2 + bounce, 2, 3, 0, 0, Math.PI*2); ctx.ellipse(0, -2 + bounce, 2, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath(); ctx.arc(2, 1 + bounce, 1.5, 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(8, 2 + bounce); ctx.lineTo(14, 6 + bounce + walk); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, 2 + bounce); ctx.lineTo(-10, 6 + bounce - walk); ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath(); ctx.ellipse(-6 + walk/2, 14, 4, 3, 0, 0, Math.PI*2); ctx.ellipse(6 - walk/2, 14, 4, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
  };

  const drawBird = (ctx: CanvasRenderingContext2D, e: Enemy) => {
      const t = Date.now() / 100;
      const flap = Math.sin(t) * 8;

      ctx.save();
      ctx.translate(e.x + e.width/2, e.y + e.height/2);
      if (!e.facingRight) ctx.scale(-1, 1);

      ctx.fillStyle = '#f472b6'; 
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = '#ec4899';
      ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(8, -2 - Math.abs(flap)); ctx.lineTo(4, 4); ctx.fill();

      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.arc(6, -4, 5, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = '#fcd34d'; 
      ctx.beginPath(); ctx.moveTo(9, -4); ctx.lineTo(16, -2); ctx.lineTo(9, 0); ctx.fill();

      ctx.fillStyle = 'black';
      ctx.beginPath(); ctx.arc(7, -5, 1.5, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = '#db2777';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -4); ctx.lineTo(-14, 4); ctx.fill();
      ctx.restore();
  };

  const drawEnvironment = (ctx: CanvasRenderingContext2D) => {
      const currentBiome = getBiomeAtLevel(Math.floor(Math.abs(cameraYRef.current) / (TILE_SIZE * 4)));
      const config = BIOME_CONFIG[currentBiome];
      const t = Date.now() / 1000;

      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, config.bgTop);
      grad.addColorStop(1, config.bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (currentBiome === BiomeType.AURORA) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for(let i=0; i<3; i++) {
              const shift = i * 100;
              const color = i % 2 === 0 ? 'rgba(45, 212, 191, 0.3)' : 'rgba(167, 139, 250, 0.3)'; 
              const auroraGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
              auroraGrad.addColorStop(0, 'rgba(0,0,0,0)');
              auroraGrad.addColorStop(0.5, color);
              auroraGrad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = auroraGrad;
              ctx.beginPath();
              ctx.moveTo(0, 100 + shift);
              const amp = 50 + Math.sin(t + i) * 30;
              for (let x = 0; x <= CANVAS_WIDTH; x+=20) {
                  const y = 100 + shift + Math.sin(x * 0.005 + t + i) * amp;
                  ctx.lineTo(x, y);
              }
              ctx.lineTo(CANVAS_WIDTH, 0); ctx.lineTo(0, 0); ctx.fill();
          }
          ctx.restore();
          ctx.fillStyle = 'white';
          for(let i=0; i<20; i++) {
              const sx = (Math.sin(i*132 + t*0.01) * CANVAS_WIDTH + CANVAS_WIDTH)%CANVAS_WIDTH;
              const sy = (Math.cos(i*53 + t*0.02) * CANVAS_HEIGHT/2 + CANVAS_HEIGHT/2);
              ctx.globalAlpha = 0.5 + Math.sin(t*2 + i)*0.5;
              ctx.fillRect(sx, sy, 2, 2);
          }
          ctx.globalAlpha = 1;
      } else if (currentBiome === BiomeType.BLIZZARD) {
           ctx.fillStyle = 'rgba(200, 210, 230, 0.1)';
           ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
           const cloudOffset = (t * 50) % CANVAS_WIDTH;
           const gradFog = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
           gradFog.addColorStop(0, 'rgba(255,255,255,0)');
           gradFog.addColorStop(0.5, 'rgba(255,255,255,0.05)');
           gradFog.addColorStop(1, 'rgba(255,255,255,0)');
           ctx.save();
           ctx.translate(-cloudOffset, 0);
           ctx.fillStyle = gradFog;
           ctx.fillRect(0, 0, CANVAS_WIDTH * 2, CANVAS_HEIGHT);
           ctx.restore();
      }
  };

  const drawSnow = (ctx: CanvasRenderingContext2D, biome: BiomeType) => {
      const t = Date.now() / 1000;
      
      snowRef.current.forEach(s => {
          let x, y, alpha;
          if (biome === BiomeType.BLIZZARD) {
              const speedX = s.speed * 4 + 5 + Math.abs(windOffsetRef.current * 0.1); // Add wind effect to speed
              const speedY = s.speed * 2;
              x = (s.x + t * speedX * 50) % CANVAS_WIDTH;
              y = (s.y + t * speedY * 50 - cameraYRef.current * 0.8) % CANVAS_HEIGHT;
              ctx.fillStyle = '#e2e8f0';
              ctx.globalAlpha = s.opacity * 0.8;
              ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 6); 
              ctx.fillRect(0, 0, s.size * 4, s.size / 2); ctx.restore();
          } else if (biome === BiomeType.AURORA) {
              const speedY = s.speed * 0.2;
              x = (s.x + Math.sin(t + s.wobble) * 30) % CANVAS_WIDTH;
              y = (s.y + t * speedY * 20 - cameraYRef.current * 0.2) % CANVAS_HEIGHT;
              alpha = 0.5 + Math.sin(t * 5 + s.wobble) * 0.5;
              ctx.fillStyle = '#2dd4bf'; ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(x, y - s.size); ctx.lineTo(x + s.size, y); ctx.lineTo(x, y + s.size); ctx.lineTo(x - s.size, y);
              ctx.fill();
          } else {
              const speedY = s.speed;
              x = (s.x + Math.sin(t + s.wobble) * 20) % CANVAS_WIDTH;
              y = (s.y + t * speedY * 60 - cameraYRef.current * 0.5) % CANVAS_HEIGHT;
              ctx.fillStyle = 'white'; ctx.globalAlpha = s.opacity;
              ctx.beginPath(); ctx.arc(x, y, s.size, 0, Math.PI * 2); ctx.fill();
          }
      });
      ctx.globalAlpha = 1;
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
      const wind = windOffsetRef.current * 0.05; // Wind force
      particlesRef.current.forEach(p => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          if (p.gravity > 0) {
             // Shards
             ctx.beginPath();
             ctx.moveTo(-p.size, -p.size); ctx.lineTo(p.size, 0); ctx.lineTo(0, p.size);
             ctx.fill();
          } else {
             // Dust
             ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
             p.x += wind; // Apply wind to dust
          }
          ctx.restore();
      });
  };

  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameState === GameState.PLAYING) {
        // HIT STOP: Skip physics updates if frozen
        if (hitStopRef.current > 0) {
             hitStopRef.current--;
             // Shake maintains through freeze for extra impact
        } else {
            updatePhysics(16);
            updateCamera();
            updateEnemies();
            
            // Combo Timer
            if (comboRef.current.timer > 0) {
                comboRef.current.timer--;
                if (comboRef.current.timer <= 0) {
                    comboRef.current.count = 0;
                    comboRef.current.multiplier = 1;
                }
            }

            // Update Particles
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.gravity > 0) p.vy += p.gravity;
                
                // Simple floor bounce
                if (p.bounce) {
                     for (const block of mapRef.current) {
                         if (p.x > block.x && p.x < block.x + block.width && p.y > block.y && p.y < block.y + block.height) {
                             p.y = block.y;
                             p.vy *= -0.5;
                             p.vx *= 0.8;
                             break;
                         }
                     }
                } else {
                    p.vy += 0.1;
                }

                p.rotation += p.rotSpeed;
                p.life -= 0.015;
                if (p.life <= 0) particlesRef.current.splice(i, 1);
            }

            // Update Floating Texts
            for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
                const ft = floatingTextsRef.current[i];
                ft.x += ft.vx;
                ft.y += ft.vy;
                ft.life -= 0.02;
                if (ft.life <= 0) floatingTextsRef.current.splice(i, 1);
            }
        }
    }

    ctx.save();
    
    // TRAUMA SHAKE APPLY
    const shakeC = traumaRef.current * traumaRef.current; // Non-linear falloff
    const shakeMag = shakeC * 15; // Max 15px shake
    const shakeX = (Math.random() - 0.5) * shakeMag;
    const shakeY = (Math.random() - 0.5) * shakeMag;
    ctx.translate(shakeX, shakeY);

    drawEnvironment(ctx);
    
    const currentBiome = getBiomeAtLevel(Math.floor(Math.abs(cameraYRef.current) / (TILE_SIZE * 4)));
    drawSnow(ctx, currentBiome);

    ctx.translate(0, -cameraYRef.current);
    
    drawCombo(ctx);

    // Draw Boss (Behind blocks sometimes?)
    drawBoss(ctx);

    mapRef.current.forEach(block => {
        if (block.y > cameraYRef.current + CANVAS_HEIGHT || block.y + block.height < cameraYRef.current) return;
        drawIceBlock(ctx, block);
    });

    itemsRef.current.forEach(item => {
        if (item.y > cameraYRef.current + CANVAS_HEIGHT || item.y + item.height < cameraYRef.current) return;
        drawItem(ctx, item);
    });

    enemiesRef.current.forEach(enemy => {
        if (enemy.isDead) return;
        if (enemy.type === EnemyType.YETI) drawYeti(ctx, enemy);
        else drawBird(ctx, enemy);
    });
    
    drawProjectiles(ctx);

    drawParticles(ctx);
    drawPlayer(ctx, playerRef.current);
    drawFloatingTexts(ctx);

    ctx.restore();
    
    requestRef.current = requestAnimationFrame(drawLoop);
  }, [gameState, initGame, upgrades]); 

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [drawLoop]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="block bg-black w-full h-full object-contain"
      style={{ 
          imageRendering: 'pixelated', 
          maxWidth: '100%'
      }}
    />
  );
};

export default GameRenderer;
