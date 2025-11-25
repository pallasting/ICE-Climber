
import React, { useEffect, useRef, useCallback } from 'react';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, PHYSICS, COLORS, 
  COLS, PLAYER_SIZE, ENEMY_CONFIG, BIOME_CONFIG, ITEM_CONFIG, SHAKE_INTENSITY,
  BOSS_CONFIG, PROJECTILE_CONFIG, CLOUD_CONFIG, BOSS_PHASES, PLAYER_COLORS
} from '../constants';
import { 
  Block, BlockType, Entity, GameState, Particle, Snowflake, 
  BiomeType, Enemy, EnemyType, Item, ItemType, FloatingText, Upgrades, UpgradeType, Boss, Projectile, ComboState
} from '../types';
import { audioManager } from '../utils/audio';

interface GameRendererProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScores: React.Dispatch<React.SetStateAction<{ p1: number, p2: number }>>;
  setHeat: React.Dispatch<React.SetStateAction<number>>;
  setAltitude: (val: number) => void;
  setBiome: (val: string) => void;
  upgrades: Upgrades;
  setBossStatus: (status: { active: boolean, hp: number, maxHp: number }) => void;
  playerCount: number;
}

const GameRenderer: React.FC<GameRendererProps> = ({ 
  gameState, setGameState, setScores, setHeat, setAltitude, setBiome, upgrades, setBossStatus, playerCount
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
  const scoreRef = useRef<{ p1: number, p2: number }>({ p1: 0, p2: 0 });
  const traumaRef = useRef<number>(0); 
  const lastShopLevelRef = useRef<number>(0);
  const windOffsetRef = useRef<number>(0);
  
  // JUICE States
  const hitStopRef = useRef<number>(0); 
  // Map combo for each player: 0 for P1, 1 for P2
  const combosRef = useRef<ComboState[]>([{ count: 0, timer: 0, multiplier: 1 }, { count: 0, timer: 0, multiplier: 1 }]);
  const lastBiomeRef = useRef<BiomeType>(BiomeType.ICE_CAVE);

  // Entities - Now an Array!
  const playersRef = useRef<Entity[]>([]);

  const mapRef = useRef<Block[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const snowRef = useRef<Snowflake[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  const bossRef = useRef<Boss>({
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
    });
  
  const projectilesRef = useRef<Projectile[]>([]);

  // --- HELPERS ---
  const addTrauma = (amount: number) => {
    traumaRef.current = Math.min(1.0, traumaRef.current + amount);
  };
  
  const triggerHitStop = (frames: number) => {
      hitStopRef.current = frames;
  };
  
  const incrementCombo = (playerId: number, x: number, y: number) => {
      const combo = combosRef.current[playerId];
      combo.count++;
      combo.timer = 120; // 2 seconds
      combo.multiplier = Math.min(5, 1 + (combo.count * 0.1));
      
      if (combo.count > 1) {
          spawnFloatingText(x, y - 20, `${combo.count}x COMBO!`, '#fcd34d', 16);
      }
      return combo.multiplier;
  };
  
  const triggerPlayerDeath = (player: Entity) => {
      if (player.state === 'die' || player.state === 'ghost') return;
      player.state = 'die';
      player.vy = -12; // Pop up
      player.isGrounded = false;
      addTrauma(SHAKE_INTENSITY.LARGE);
      audioManager.playHurt();
      // Only trigger GAME OVER if ALL players are dead
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
    
    if (level === BOSS_CONFIG.LEVEL) {
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
    const useClouds = biome === BiomeType.AURORA && Math.random() < 0.6;
    const forcedGapIndex = Math.floor(Math.random() * (COLS - 2)) + 1;

    const isSafeZone = level < 5;
    let maxEnemiesAllowed = 0;
    if (!isSafeZone) {
        if (level < 20) maxEnemiesAllowed = 2;
        else if (level < 50) maxEnemiesAllowed = 3;
        else maxEnemiesAllowed = 5;
    }

    if (useClouds) {
        const numClouds = 2 + Math.floor(Math.random() * 2);
        const direction = Math.random() > 0.5 ? 1 : -1;
        const speed = CLOUD_CONFIG.SPEED * direction;
        
        for (let i = 0; i < numClouds; i++) {
             const startX = (CANVAS_WIDTH / numClouds) * i + Math.random() * 50;
             newBlocks.push({
                id: `c-${i}-${rowY}`,
                x: startX,
                y: rowY,
                width: TILE_SIZE * 2, 
                height: TILE_SIZE / 2, 
                type: BlockType.CLOUD,
                health: 1,
                biome,
                vx: speed
             });
        }
        
        newBlocks.push({ id: `w-0-${rowY}`, x: 0, y: rowY, width: TILE_SIZE, height: TILE_SIZE, type: BlockType.UNBREAKABLE, health: 1, biome });
        newBlocks.push({ id: `w-end-${rowY}`, x: CANVAS_WIDTH - TILE_SIZE, y: rowY, width: TILE_SIZE, height: TILE_SIZE, type: BlockType.UNBREAKABLE, health: 1, biome });

    } else {
        for (let col = 0; col < COLS; col++) {
          if (col === 0 || col === COLS - 1) {
            newBlocks.push({ id: `w-${col}-${rowY}`, x: col * TILE_SIZE, y: rowY, width: TILE_SIZE, height: TILE_SIZE, type: BlockType.UNBREAKABLE, health: 1, biome });
            continue;
          }

          if (col === forcedGapIndex || Math.random() < gapChance) {
            if (!isSafeZone && Math.random() < 0.08 && enemiesRef.current.length < maxEnemiesAllowed) {
                const enemyType = Math.random() > 0.6 ? EnemyType.YETI : EnemyType.BIRD; 
                const config = ENEMY_CONFIG[enemyType];
                const spawnY = rowY - config.height;
                enemiesRef.current.push({
                    x: col * TILE_SIZE, y: spawnY, vx: config.speed, vy: 0, width: config.width, height: config.height, color: config.color, isGrounded: false, lastGroundedTime: 0, facingRight: true, state: 'run', hitCooldown: 0, type: enemyType, patrolStart: 0, patrolEnd: CANVAS_WIDTH, spawnY: spawnY, isDead: false, isAttacking: false, attackTimer: 0, attackCooldown: 0, buildTimer: 0, aggro: false
                });
            }
            continue;
          }

          const isSpike = Math.random() < spikeChance;
          if (isSpike) {
              newBlocks.push({ id: `s-${col}-${rowY}`, x: col * TILE_SIZE, y: rowY, width: TILE_SIZE, height: TILE_SIZE, type: BlockType.SPIKE, health: 1, biome });
          } else {
              const type = Math.random() < unbreakableChance ? BlockType.UNBREAKABLE : BlockType.NORMAL;
              newBlocks.push({ id: `b-${col}-${rowY}`, x: col * TILE_SIZE, y: rowY, width: TILE_SIZE, height: TILE_SIZE, type, health: 1, biome });

              if (Math.random() < 0.15) {
                  const rand = Math.random();
                  let itemType = ItemType.EGGPLANT;
                  if (rand > 0.6) itemType = ItemType.CARROT;
                  if (rand > 0.9) itemType = ItemType.CABBAGE;

                  const iConfig = ITEM_CONFIG[itemType];
                  itemsRef.current.push({
                      id: `i-${col}-${rowY}`, x: col * TILE_SIZE + (TILE_SIZE - iConfig.width)/2, y: rowY - iConfig.height - 5, type: itemType, width: iConfig.width, height: iConfig.height, collected: false, floatOffset: Math.random() * Math.PI * 2
                  });
              }
          }
        }
    }
    return newBlocks;
  };

  const initGame = useCallback(() => {
    // INIT PLAYERS
    const newPlayers: Entity[] = [];
    for(let i=0; i<playerCount; i++) {
        newPlayers.push({
            id: i,
            x: CANVAS_WIDTH / 2 - PLAYER_SIZE.width / 2 + (i === 1 ? 40 : -40),
            y: CANVAS_HEIGHT - TILE_SIZE * 3,
            vx: 0,
            vy: 0,
            width: PLAYER_SIZE.width,
            height: PLAYER_SIZE.height,
            color: PLAYER_COLORS[i].main,
            isGrounded: true,
            lastGroundedTime: Date.now(),
            facingRight: i === 0, // Face each other? or Right?
            state: 'idle',
            hitCooldown: 0,
            isAttacking: false,
            attackTimer: 0,
            attackCooldown: 0,
            rotation: 0
        });
    }
    playersRef.current = newPlayers;

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
    scoreRef.current = { p1: 0, p2: 0 };
    traumaRef.current = 0;
    lastShopLevelRef.current = 0;
    hitStopRef.current = 0;
    combosRef.current = [{ count: 0, timer: 0, multiplier: 1 }, { count: 0, timer: 0, multiplier: 1 }];
    lastBiomeRef.current = BiomeType.ICE_CAVE;

    mapRef.current = [];
    enemiesRef.current = [];
    itemsRef.current = [];
    particlesRef.current = [];
    projectilesRef.current = [];
    floatingTextsRef.current = [];
    
    setBossStatus({ active: false, hp: 0, maxHp: 100 });

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
  }, [setBossStatus, playerCount]);

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
        x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 1) * 10 - 2, life: 1.0, maxLife: 1.0, size: Math.random() * 8 + 4, color: color, rotation: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.5, gravity: 0.5, bounce: true
      });
    }
    for (let i = 0; i < 4; i++) {
         particlesRef.current.push({
            x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.6, maxLife: 0.6, size: Math.random() * 4, color: 'rgba(255,255,255,0.5)', rotation: 0, rotSpeed: 0, gravity: 0, bounce: false
         });
    }
  };

  const breakBlock = (playerIdx: number, blockIndex: number) => {
    const block = mapRef.current[blockIndex];
    if (!block || block.type === BlockType.UNBREAKABLE || block.type === BlockType.CLOUD || block.type === BlockType.SPIKE) return;
    
    const mult = incrementCombo(playerIdx, block.x + block.width/2, block.y);

    spawnParticles(block.x + block.width/2, block.y + block.height/2, COLORS.iceBase);
    addTrauma(SHAKE_INTENSITY.MEDIUM);
    audioManager.playBreak();
    triggerHitStop(3); 
    mapRef.current.splice(blockIndex, 1);
    
    const points = Math.floor(100 * mult);
    if (playerIdx === 0) {
        scoreRef.current.p1 += points;
        setScores(s => ({ ...s, p1: s.p1 + points }));
    } else {
        scoreRef.current.p2 += points;
        setScores(s => ({ ...s, p2: s.p2 + points }));
    }
  };

  const updatePhysics = (dt: number) => {
    // Loop through ALL players
    let allDead = true;
    
    // Environmental / Biome Logic (Shared)
    // Use Camera Y to determine general biome if players are dead or scattered
    const currentLevel = Math.floor(Math.abs(Math.min(0, cameraYRef.current)) / TILE_SIZE);
    const biome = getBiomeAtLevel(currentLevel);
    if (biome !== lastBiomeRef.current) {
        lastBiomeRef.current = biome;
        let biomeName = "ICE CAVERN";
        if (biome === BiomeType.BLIZZARD) biomeName = "DEATH ZONE";
        if (biome === BiomeType.AURORA) biomeName = "AURORA PEAK";
        spawnFloatingText(CANVAS_WIDTH/2, cameraYRef.current + CANVAS_HEIGHT/2 - 100, `ENTERING ${biomeName}`, '#fff', 30);
        addTrauma(SHAKE_INTENSITY.MEDIUM);
        audioManager.playSelect();
    }
    
    let windForce = 0;
    if (biome === BiomeType.BLIZZARD) {
        const time = Date.now() / 2000;
        windOffsetRef.current = Math.sin(time) * 100;
        if (Math.sin(time * 3) > 0.5) windForce = Math.sin(time * 3) * 0.3; 
    } else {
        windOffsetRef.current = 0;
    }

    const isMultiplayer = playersRef.current.length > 1;

    // --- PLAYER LOOP ---
    playersRef.current.forEach((player, idx) => {
        if (player.state === 'die') {
            player.vy += PHYSICS.gravity;
            player.y += player.vy;
            player.x += player.vx;
            player.rotation = (player.rotation || 0) + 0.2;
            // Off screen check
            if (player.y > cameraYRef.current + CANVAS_HEIGHT + 300) {
                 // Permanently dead, switch to ghost if multiplayer or game over if single
                 if (isMultiplayer) {
                     player.state = 'ghost';
                     player.vy = 0;
                     player.x = cameraYRef.current + CANVAS_WIDTH/2;
                     player.y = cameraYRef.current + CANVAS_HEIGHT - 100;
                 }
            } else {
                // Still falling
            }
            return;
        }

        if (player.state === 'ghost') {
            allDead = false; // Ghost counts as "not all dead" for game over logic in MP, wait... no. At least one must be alive.
            // Ghost Physics
            player.vx *= 0.9; player.vy *= 0.9;
            const speed = 4;
            let inputX = 0; let inputY = 0;
             if (idx === 0) {
                if (keysPressed.current['KeyA']) inputX = -1;
                if (keysPressed.current['KeyD']) inputX = 1;
                if (keysPressed.current['KeyW']) inputY = -1;
                if (keysPressed.current['KeyS']) inputY = 1;
            } else {
                if (keysPressed.current['ArrowLeft']) inputX = -1;
                if (keysPressed.current['ArrowRight']) inputX = 1;
                if (keysPressed.current['ArrowUp']) inputY = -1;
                if (keysPressed.current['ArrowDown']) inputY = 1;
            }
            player.vx += inputX * 0.5; player.vy += inputY * 0.5;
            player.x += player.vx; player.y += player.vy;
            
            // Constrain ghost to screen
            if (player.x < 0) player.x = 0; if (player.x > CANVAS_WIDTH) player.x = CANVAS_WIDTH;
            if (player.y < cameraYRef.current) player.y = cameraYRef.current; 
            if (player.y > cameraYRef.current + CANVAS_HEIGHT) player.y = cameraYRef.current + CANVAS_HEIGHT;
            return;
        }
        
        allDead = false;

        const activeFriction = player.isGrounded ? (upgrades[UpgradeType.SPIKED_BOOTS] ? 0.7 : PHYSICS.friction) : PHYSICS.airFriction;
        const activeGravity = upgrades[UpgradeType.FEATHERWEIGHT] ? PHYSICS.gravity * 0.7 : PHYSICS.gravity;
        const activeJumpForce = upgrades[UpgradeType.FEATHERWEIGHT] ? PHYSICS.jumpForce * 1.1 : PHYSICS.jumpForce;

        // --- Combat ---
        if (player.attackCooldown > 0) player.attackCooldown--;
        
        let attackPressed = false;
        if (idx === 0) attackPressed = keysPressed.current['KeyZ'] || keysPressed.current['KeyJ'] || keysPressed.current['KeyC'];
        if (idx === 1) attackPressed = keysPressed.current['Enter']; // P2 Attack

        if (attackPressed && !player.isAttacking && player.attackCooldown <= 0) {
            player.isAttacking = true;
            player.attackTimer = 15;
            player.attackCooldown = 30;
            audioManager.playSwing();
        }

        if (player.isAttacking) {
            player.attackTimer--;
            if (player.attackTimer <= 0) {
                player.isAttacking = false;
            } else {
                const reach = upgrades[UpgradeType.POWER_HAMMER] ? 60 : 45;
                const hitbox = {
                    x: player.facingRight ? player.x + player.width/2 : player.x + player.width/2 - reach,
                    y: player.y,
                    width: reach,
                    height: player.height
                };
                
                enemiesRef.current.forEach(enemy => {
                    if (enemy.isDead) return;
                    if (checkRectOverlap(hitbox, enemy)) {
                        enemy.isDead = true;
                        spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                        addTrauma(SHAKE_INTENSITY.MEDIUM);
                        audioManager.playEnemyHit();
                        triggerHitStop(5);
                        
                        const mult = incrementCombo(idx, enemy.x, enemy.y);
                        const points = Math.floor(500 * mult);
                        const heatGain = Math.floor(20 * mult);
                        
                        if (idx === 0) {
                             scoreRef.current.p1 += points;
                             setScores(s => ({ ...s, p1: s.p1 + points }));
                        } else {
                             scoreRef.current.p2 += points;
                             setScores(s => ({ ...s, p2: s.p2 + points }));
                        }
                        
                        setHeat(h => h + heatGain);
                        spawnFloatingText(enemy.x, enemy.y - 20, "SMASH!", "#ef4444", 16);
                        spawnFloatingText(enemy.x + 20, enemy.y - 40, `+${heatGain}🔥`, "#fbbf24", 12);
                    }
                });

                projectilesRef.current.forEach(proj => {
                    if (proj.isReflected) return;
                    if (checkRectOverlap(hitbox, proj)) {
                        proj.isReflected = true;
                        proj.vy = -PROJECTILE_CONFIG.REFLECT_SPEED;
                        proj.vx = (Math.random() - 0.5) * 2;
                        proj.color = '#ef4444';
                        audioManager.playEnemyHit();
                        triggerHitStop(4);
                        addTrauma(SHAKE_INTENSITY.MEDIUM);
                        spawnFloatingText(proj.x, proj.y, "REFLECT!", "#3b82f6", 12);
                    }
                });
            }
        }

        // --- Movement ---
        const accel = player.isGrounded ? PHYSICS.accel : PHYSICS.airAccel;
        let inputVx = 0;
        let jumpPressed = false;

        if (idx === 0) { // P1
            // Use arrow keys ONLY in single player. In multiplayer, arrows are reserved for P2.
            const moveLeft = keysPressed.current['KeyA'] || (!isMultiplayer && keysPressed.current['ArrowLeft']);
            const moveRight = keysPressed.current['KeyD'] || (!isMultiplayer && keysPressed.current['ArrowRight']);
            const jump = keysPressed.current['KeyW'] || keysPressed.current['Space'] || (!isMultiplayer && keysPressed.current['ArrowUp']);

            if (moveLeft) {
              inputVx = -6; player.facingRight = false; player.state = 'run';
            } else if (moveRight) {
              inputVx = 6; player.facingRight = true; player.state = 'run';
            }
            jumpPressed = jump;
        } else { // P2
            if (keysPressed.current['ArrowLeft']) {
              inputVx = -6; player.facingRight = false; player.state = 'run';
            } else if (keysPressed.current['ArrowRight']) {
              inputVx = 6; player.facingRight = true; player.state = 'run';
            }
            jumpPressed = keysPressed.current['ArrowUp'];
        }

        if (inputVx === 0) player.state = 'idle';

        if (inputVx !== 0) {
            player.vx += (inputVx - player.vx) * accel;
        } else {
            player.vx *= activeFriction;
        }

        if (!player.isGrounded) player.vx += windForce;
        player.vy += activeGravity;
        if (player.vy > PHYSICS.terminalVelocity) player.vy = PHYSICS.terminalVelocity;

        const now = Date.now();
        const canJump = player.isGrounded || (now - player.lastGroundedTime < PHYSICS.coyoteTime);
        if (jumpPressed && canJump && player.vy >= 0) { 
              player.vy = activeJumpForce;
              player.isGrounded = false;
              player.lastGroundedTime = 0;
              player.state = 'jump';
              audioManager.playJump();
        }

        player.x += player.vx;

        // Cloud Carry
        if (player.isGrounded) {
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
                triggerPlayerDeath(player);
                return;
            }
            if (block.type !== BlockType.CLOUD) {
                if (player.vx > 0) { player.x = block.x - player.width - 0.01; player.vx = 0; } 
                else if (player.vx < 0) { player.x = block.x + block.width + 0.01; player.vx = 0; }
            }
          }
        }

        const prevY = player.y; 
        player.y += player.vy;
        player.isGrounded = false; 

        for (let i = 0; i < mapRef.current.length; i++) {
          const block = mapRef.current[i];
          if (checkRectOverlap(player, block)) {
            if (block.type === BlockType.SPIKE) {
                triggerPlayerDeath(player);
                return;
            }
            const overlapX = Math.min(player.x + player.width, block.x + block.width) - Math.max(player.x, block.x);
            
            if (player.vy > 0) {
              const wasAbove = prevY + player.height <= block.y + 16; 
              if (wasAbove) {
                player.y = block.y - player.height;
                player.vy = 0;
                player.isGrounded = true;
                player.lastGroundedTime = Date.now();
                if (Math.abs(player.vx) > 0.1) player.state = 'run';
                if (player.vy > 10) addTrauma(SHAKE_INTENSITY.SMALL);
              }
            } else if (player.vy < 0) {
              if (block.type !== BlockType.CLOUD) {
                  if (overlapX < PHYSICS.cornerCorrection) {
                     if ((player.x + player.width/2) < (block.x + block.width/2)) {
                        player.x = block.x - player.width - 1; 
                     } else {
                        player.x = block.x + block.width + 1;
                     }
                  } else {
                     player.y = block.y + block.height;
                     player.vy = 0;
                     breakBlock(idx, i);
                  }
              }
            }
          }
        }

        // --- Items ---
        for (let i = itemsRef.current.length - 1; i >= 0; i--) {
            const item = itemsRef.current[i];
            if (item.collected) continue;
            if (checkRectOverlap(player, item)) {
                const config = ITEM_CONFIG[item.type];
                item.collected = true;
                const mult = incrementCombo(idx, item.x, item.y);
                const points = Math.floor(config.points * mult);
                
                if (idx === 0) {
                     scoreRef.current.p1 += points;
                     setScores(s => ({ ...s, p1: s.p1 + points }));
                } else {
                     scoreRef.current.p2 += points;
                     setScores(s => ({ ...s, p2: s.p2 + points }));
                }

                setHeat(h => h + config.heat);
                spawnFloatingText(item.x, item.y, `+${config.heat}🔥`, '#fcd34d');
                audioManager.playCollect();
                itemsRef.current.splice(i, 1);
            }
        }
    }); // End Player Loop

    if (allDead) {
        setGameStateRef.current(GameState.GAME_OVER);
    }

    traumaRef.current = Math.max(0, traumaRef.current - 0.02);

    // --- Boss Logic (Shared) ---
    const boss = bossRef.current;
    // Find closest player for boss aggro/aim
    let closestPlayer = playersRef.current.find(p => p.state !== 'die' && p.state !== 'ghost');
    if (!closestPlayer) closestPlayer = playersRef.current[0];

    const bossArenaY = -BOSS_CONFIG.LEVEL * TILE_SIZE * 4;
    // Activate if any alive player is close
    if (!boss.isActive && closestPlayer.y < bossArenaY + CANVAS_HEIGHT) {
        boss.isActive = true;
        boss.y = bossArenaY - 200; 
        setBossStatus({ active: true, hp: boss.hp, maxHp: boss.maxHp });
    }

    if (boss.isActive && boss.hp > 0) {
        const hpPercent = boss.hp / boss.maxHp;
        let newPhase = 0;
        if (hpPercent < BOSS_PHASES.P3_THRESHOLD) newPhase = 2; 
        else if (hpPercent < BOSS_PHASES.P2_THRESHOLD) newPhase = 1; 
        
        if (newPhase !== boss.phase) {
             boss.phase = newPhase;
             spawnParticles(boss.x + boss.width/2, boss.y + boss.height/2, boss.color);
             // Bigger particles for phase up
             spawnParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffffff');
             addTrauma(SHAKE_INTENSITY.LARGE);
             spawnFloatingText(boss.x + boss.width/2, boss.y + boss.height, "PHASE UP!", "#fff", 20);
        }

        let currentSpeed = BOSS_CONFIG.SPEED;
        let currentAttackInterval = BOSS_PHASES.P1_INTERVAL;

        if (boss.phase === 1) { 
             currentSpeed *= 1.5; boss.color = '#a855f7'; currentAttackInterval = BOSS_PHASES.P2_INTERVAL;
        } else if (boss.phase === 2) { 
             currentSpeed *= 2.5; boss.color = '#ef4444'; currentAttackInterval = BOSS_PHASES.P3_INTERVAL;
             if (Math.random() < 0.1) addTrauma(0.05);
        }

        boss.moveTimer++;
        boss.y = bossArenaY - 200 + Math.sin(boss.moveTimer * 0.05) * 20; 
        boss.x += boss.vx * (currentSpeed / BOSS_CONFIG.SPEED); 
        if (boss.x <= 0 || boss.x + boss.width >= CANVAS_WIDTH) boss.vx *= -1;
        
        if (boss.moveTimer % currentAttackInterval === 0) {
            const spawnProjectile = (vx: number, vy: number) => {
                projectilesRef.current.push({
                    id: Math.random(),
                    x: boss.x + boss.width / 2 - PROJECTILE_CONFIG.WIDTH / 2, y: boss.y + boss.height,
                    vx: vx, vy: vy, width: PROJECTILE_CONFIG.WIDTH, height: PROJECTILE_CONFIG.HEIGHT, color: '#a5f3fc',
                    isGrounded: false, lastGroundedTime: 0, facingRight: false, state: 'fall',
                    hitCooldown: 0, isAttacking: false, attackTimer: 0, attackCooldown: 0, isReflected: false, damage: 1, rotation: 0
                });
            };
            
            // Shake on firing if phase 2 (berserk)
            if (boss.phase === 2) addTrauma(0.1);

            const aimVx = (closestPlayer.x - (boss.x + boss.width/2)) * 0.02;
            if (boss.phase === 0) spawnProjectile(aimVx, 5);
            else if (boss.phase === 1) { spawnProjectile(aimVx - 2, 5); spawnProjectile(aimVx + 2, 5); }
            else { spawnProjectile(aimVx, 6); spawnProjectile(aimVx - 3, 5); spawnProjectile(aimVx + 3, 5); }
        }
    } else if (boss.hp <= 0 && boss.isActive) {
        boss.isActive = false;
        setBossStatus({ active: false, hp: 0, maxHp: boss.maxHp });
        spawnParticles(boss.x + boss.width/2, boss.y + boss.height/2, boss.color);
        addTrauma(SHAKE_INTENSITY.LARGE);
        triggerHitStop(10);
        for(let i=0; i<10; i++) {
             itemsRef.current.push({
                  id: `boss-reward-${i}`, x: boss.x + Math.random() * boss.width, y: boss.y + Math.random() * boss.height,
                  type: ItemType.CABBAGE, width: 20, height: 20, collected: false, floatOffset: Math.random() * Math.PI
              });
        }
    }

    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const p = projectilesRef.current[i];
        p.x += p.vx; p.y += p.vy; p.rotation += 0.1;
        
        if (p.isReflected) {
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
             playersRef.current.forEach(pl => {
                 if (pl.state !== 'die' && pl.state !== 'ghost' && checkRectOverlap(p, pl)) triggerPlayerDeath(pl);
             });
        }
        if (p.y > cameraYRef.current + CANVAS_HEIGHT || p.y < cameraYRef.current - 1000) projectilesRef.current.splice(i, 1);
    }

    // Clouds
    for(const block of mapRef.current) {
        if (block.type === BlockType.CLOUD && block.vx) {
            block.x += block.vx;
            if (block.vx > 0 && block.x > CANVAS_WIDTH) block.x = -block.width;
            if (block.vx < 0 && block.x + block.width < 0) block.x = CANVAS_WIDTH;
        }
    }
  };

  const updateEnemies = () => {
      // Find closest ALIVE player
      const activePlayers = playersRef.current.filter(p => p.state !== 'die' && p.state !== 'ghost');
      if (activePlayers.length === 0) return;

      enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead) return;
          
          // Target closest player
          let target = activePlayers[0];
          let minDist = 9999;
          activePlayers.forEach(p => {
              const d = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
              if (d < minDist) { minDist = d; target = p; }
          });

          if (enemy.type === EnemyType.BIRD) {
              enemy.x += enemy.vx;
              const distX = Math.abs((target.x + target.width/2) - (enemy.x + enemy.width/2));
              const distY = target.y - enemy.y; 
              
              // Only aggro if visible on screen to avoid cheap off-screen dives
              const isVisible = enemy.y > cameraYRef.current && enemy.y < cameraYRef.current + CANVAS_HEIGHT;

              if (distX < target.width && distY > 0 && distY < 300 && !enemy.aggro && isVisible) {
                  enemy.aggro = true; 
              }

              if (enemy.aggro) {
                  enemy.vy += 0.2; enemy.y += enemy.vy; 
              } else {
                  const t = Date.now();
                  enemy.y = enemy.spawnY + Math.sin(t * 0.005) * 15;
                  if (enemy.vx > 0) enemy.facingRight = true;
                  if (enemy.vx < 0) enemy.facingRight = false;
                  if (enemy.x <= 0 || enemy.x + enemy.width >= CANVAS_WIDTH) enemy.vx *= -1;
              }

          } else {
              const dist = Math.sqrt(Math.pow((target.x + target.width/2) - (enemy.x + enemy.width/2), 2) + Math.pow((target.y + target.height/2) - (enemy.y + enemy.height/2), 2));
              enemy.aggro = dist < 200;
              enemy.vy += PHYSICS.gravity;
              const currentSpeed = enemy.aggro ? ENEMY_CONFIG.YETI.speed * 1.5 : ENEMY_CONFIG.YETI.speed;
              enemy.x += (enemy.facingRight ? currentSpeed : -currentSpeed);
              enemy.y += enemy.vy;

              if (enemy.vx > 0) enemy.facingRight = true;
              if (enemy.x <= 0) { enemy.x = 0; enemy.vx *= -1; enemy.facingRight = true; }
              if (enemy.x + enemy.width >= CANVAS_WIDTH) { enemy.x = CANVAS_WIDTH - enemy.width; enemy.vx *= -1; enemy.facingRight = false; }

              enemy.isGrounded = false;
              let onGround = false;
              for (const block of mapRef.current) {
                  if (checkRectOverlap(enemy, block)) {
                      if (enemy.vy > 0 && (enemy.y + enemy.height - enemy.vy <= block.y + 10)) {
                          enemy.y = block.y - enemy.height; enemy.vy = 0; enemy.isGrounded = true; onGround = true;
                      } else if (Math.abs(currentSpeed) > 0) {
                          const overlapY = Math.min(enemy.y + enemy.height, block.y + block.height) - Math.max(enemy.y, block.y);
                          if (overlapY > 5) enemy.facingRight = !enemy.facingRight; 
                      }
                  }
              }

              if (onGround && enemy.type === EnemyType.YETI && !enemy.aggro) {
                  const direction = enemy.facingRight ? 1 : -1;
                  const lookAheadX = enemy.x + (enemy.width/2) + (direction * 20);
                  const lookAheadRect = { x: lookAheadX, y: enemy.y + enemy.height + 2, width: 5, height: 5 };
                  const wallCheckRect = { x: lookAheadX, y: enemy.y, width: 5, height: enemy.height };

                  let hasGroundAhead = false;
                  let hasWallAhead = false;
                  for(const b of mapRef.current) {
                      if (checkRectOverlap(lookAheadRect, b)) hasGroundAhead = true;
                      if (checkRectOverlap(wallCheckRect, b)) hasWallAhead = true;
                  }
                  
                  if (!hasGroundAhead || hasWallAhead) {
                      if (enemy.state !== 'build' && Math.random() < 0.02) {
                          enemy.state = 'build'; enemy.buildTimer = ENEMY_CONFIG.YETI.buildTime;
                      } else if (enemy.state !== 'build') {
                           enemy.facingRight = !enemy.facingRight;
                      }
                  }
              }
              
              if (enemy.state === 'build') {
                  enemy.buildTimer--;
                  if (enemy.buildTimer <= 0) {
                      enemy.state = 'run';
                      const buildX = enemy.facingRight ? enemy.x + enemy.width : enemy.x - TILE_SIZE;
                      const gridX = Math.round(buildX / TILE_SIZE) * TILE_SIZE;
                      const gridY = Math.round(enemy.y / TILE_SIZE) * TILE_SIZE; 
                      const newBlock = { x: gridX, y: gridY + enemy.height, width: TILE_SIZE, height: TILE_SIZE };
                      let canBuild = true;
                      for(const b of mapRef.current) { if (checkRectOverlap(newBlock, b)) { canBuild = false; break; } }
                      
                      if (canBuild) {
                          mapRef.current.push({
                              id: `built-${Date.now()}`, x: gridX, y: gridY + enemy.height, width: TILE_SIZE, height: TILE_SIZE,
                              type: BlockType.NORMAL, health: 1, biome: BiomeType.ICE_CAVE
                          });
                          spawnParticles(gridX + TILE_SIZE/2, gridY + TILE_SIZE + TILE_SIZE/2, '#cbd5e1');
                          audioManager.playBreak();
                      }
                  }
              }
          }

          activePlayers.forEach(p => {
              if (checkRectOverlap(p, enemy)) triggerPlayerDeath(p);
          });
      });
  };

  const updateCamera = () => {
    // Follow the HIGHEST alive player (lowest Y)
    const activePlayers = playersRef.current.filter(p => p.state !== 'die' && p.state !== 'ghost');
    
    // Check for Screen Kill (players below camera)
    playersRef.current.forEach(p => {
        if (p.state !== 'die' && p.state !== 'ghost' && p.y > cameraYRef.current + CANVAS_HEIGHT + 20) {
            triggerPlayerDeath(p);
            spawnFloatingText(p.x, cameraYRef.current + CANVAS_HEIGHT - 50, "TOO SLOW!", p.color, 16);
        }
    });

    if (activePlayers.length === 0) return;

    // Determine target Y based on highest player
    let minY = activePlayers[0].y;
    activePlayers.forEach(p => { if (p.y < minY) minY = p.y; });
    
    const topGenThreshold = cameraYRef.current - CANVAS_HEIGHT;
    if (highestGenYRef.current > topGenThreshold) {
        for (let i = 0; i < 5; i++) {
            const y = highestGenYRef.current - (TILE_SIZE * 4);
            const level = Math.floor(Math.abs(y) / (TILE_SIZE * 4));
            const newRow = generateRow(y, level);
            mapRef.current.push(...newRow);
            highestGenYRef.current = y;
        }
        const cleanupThreshold = cameraYRef.current + CANVAS_HEIGHT * 1.5;
        mapRef.current = mapRef.current.filter(b => b.y < cleanupThreshold);
        enemiesRef.current = enemiesRef.current.filter(e => e.y < cleanupThreshold);
        itemsRef.current = itemsRef.current.filter(i => i.y < cleanupThreshold);
    }

    let targetY = minY - CANVAS_HEIGHT * 0.6;
    if (bossRef.current.isActive) {
         const bossCenter = bossRef.current.y + bossRef.current.height/2;
         targetY = bossCenter - CANVAS_HEIGHT * 0.3;
    }

    // Only scroll UP (decrease Y)
    if (targetY < cameraYRef.current) {
        cameraYRef.current += (targetY - cameraYRef.current) * 0.1;
    }

    const currentAlt = Math.floor(Math.abs(Math.min(0, minY)) / TILE_SIZE);
    if (currentAlt > maxScrollRef.current) {
        maxScrollRef.current = currentAlt;
        setAltitude(currentAlt);
        setBiome(getBiomeAtLevel(currentAlt));

        // Shop / Revival Trigger
        if (currentAlt > 10 && currentAlt % 20 === 0 && currentAlt > lastShopLevelRef.current) {
            lastShopLevelRef.current = currentAlt;
            setGameStateRef.current(GameState.SHOP);
            
            // REVIVE DEAD PLAYERS
            playersRef.current.forEach((p, i) => {
                if (p.state === 'die' || p.state === 'ghost') {
                    p.state = 'idle';
                    p.vx = 0; p.vy = 0;
                    p.x = CANVAS_WIDTH / 2;
                    p.y = cameraYRef.current + CANVAS_HEIGHT/2; // Safe spot
                    p.isGrounded = false;
                    spawnParticles(p.x, p.y, p.color);
                    spawnFloatingText(p.x, p.y - 40, "REVIVED!", p.color, 20);
                }
            });
        }
    }
  };

  const drawBoss = (ctx: CanvasRenderingContext2D) => {
      const b = bossRef.current;
      if (!b.isActive || b.hp <= 0) return;
      
      const t = Date.now() / 200;
      ctx.save();
      ctx.translate(b.x + b.width/2, b.y + b.height/2);
      if (b.phase === 2) ctx.translate((Math.random()-0.5)*4, (Math.random()-0.5)*4);
      
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.phase === 2 ? 40 : 20;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      for(let i=0; i<8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const rad = (b.width/2) + Math.sin(t + i*2) * 5;
          ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
      }
      ctx.fill();
      
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(-15, -10, 8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -10, 8, 0, Math.PI*2); ctx.fill();
      
      ctx.fillStyle = b.phase === 2 ? '#fff' : '#ef4444';
      ctx.beginPath(); ctx.arc(-15, -10, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -10, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
  };
  
  const drawProjectiles = (ctx: CanvasRenderingContext2D) => {
      projectilesRef.current.forEach(p => {
          ctx.save();
          ctx.translate(p.x + p.width/2, p.y + p.height/2);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(-p.width/2, -p.height/2); ctx.lineTo(p.width/2, -p.height/2); ctx.lineTo(0, p.height/2); ctx.fill();
          ctx.restore();
      });
  };

  const drawSpike = (ctx: CanvasRenderingContext2D, b: Block) => {
      ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = '#e2e8f0'; 
      ctx.beginPath(); ctx.moveTo(0, b.height); ctx.lineTo(b.width * 0.2, 0); ctx.lineTo(b.width * 0.4, b.height); ctx.lineTo(b.width * 0.6, 10); ctx.lineTo(b.width * 0.8, b.height); ctx.lineTo(b.width, 5); ctx.lineTo(b.width, b.height); ctx.fill(); ctx.restore();
  };

  const drawCloud = (ctx: CanvasRenderingContext2D, b: Block) => {
      ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = CLOUD_CONFIG.COLOR;
      const puffs = 3; const puffW = b.width / puffs;
      ctx.beginPath(); for(let i=0; i<puffs; i++) { ctx.arc(puffW/2 + i*puffW, b.height/2, b.height/1.5, 0, Math.PI*2); } ctx.fill(); ctx.restore();
  };

  const drawItem = (ctx: CanvasRenderingContext2D, item: Item) => {
      const t = Date.now() / 200;
      const bob = Math.sin(t + item.floatOffset) * 3;
      const config = ITEM_CONFIG[item.type];

      ctx.save();
      ctx.translate(item.x + item.width/2, item.y + item.height/2 + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 12 - bob, 6, 2, 0, 0, Math.PI*2); ctx.fill();

      if (item.type === ItemType.EGGPLANT) {
          ctx.fillStyle = config.color; ctx.beginPath(); ctx.ellipse(0, 2, 8, 10, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#86efac'; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(0, -10, 4, -6); ctx.lineTo(0, -4); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(2, -12); ctx.stroke();
      } else if (item.type === ItemType.CARROT) {
          ctx.fillStyle = config.color; ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.lineTo(0, 10); ctx.fill();
          ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-3, -12); ctx.moveTo(0, -6); ctx.lineTo(3, -12); ctx.stroke();
      } else if (item.type === ItemType.CABBAGE) {
          ctx.fillStyle = config.color; ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(-2, 0, 5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(3, 3, 4, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
  };

  const drawFloatingTexts = (ctx: CanvasRenderingContext2D) => {
      ctx.textAlign = 'center'; ctx.font = 'bold 12px "Press Start 2P", monospace';
      floatingTextsRef.current.forEach(ft => {
          ctx.save();
          if (ft.size > 20) { ctx.font = `bold ${ft.size}px "Press Start 2P", monospace`; ctx.shadowColor = 'black'; ctx.shadowBlur = 10; }
          ctx.fillStyle = ft.color; ctx.globalAlpha = ft.life; ctx.fillText(ft.text, ft.x, ft.y);
          ctx.lineWidth = 2; ctx.strokeStyle = 'black'; ctx.strokeText(ft.text, ft.x, ft.y);
          ctx.restore();
      });
      ctx.globalAlpha = 1;
  };

  const drawCombo = (ctx: CanvasRenderingContext2D) => {
      // Loop through players combo state
      combosRef.current.forEach((combo, idx) => {
          if (combo.timer > 0 && combo.count > 1) {
              ctx.save();
              const scale = 1 + (combo.timer / 120) * 0.2;
              // P1 Left, P2 Right
              const xPos = idx === 0 ? 20 : CANVAS_WIDTH - 20;
              ctx.translate(xPos, 100 + (idx * 50));
              ctx.scale(scale, scale);
              ctx.rotate(idx === 0 ? 0.2 : -0.2);
              ctx.textAlign = idx === 0 ? 'left' : 'right';
              
              ctx.font = 'bold 24px "Press Start 2P", monospace';
              ctx.fillStyle = PLAYER_COLORS[idx].main;
              ctx.fillText(`${combo.count}x`, 0, 0);
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#78350f';
              ctx.strokeText(`${combo.count}x`, 0, 0);
              
              ctx.restore();
          }
      });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Entity, idx: number) => {
    if (p.state === 'die') {
         // Keep falling body
    }
    
    ctx.save();
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    ctx.translate(Math.floor(cx), Math.floor(cy));
    
    if (p.state === 'die') ctx.rotate(p.rotation || 0);

    // Ghost visual
    if (p.state === 'ghost') {
        ctx.globalAlpha = 0.5;
        const hover = Math.sin(Date.now() / 200) * 5;
        ctx.translate(0, hover);
    }

    if (!p.facingRight) ctx.scale(-1, 1);

    const t = Date.now();
    const isRun = Math.abs(p.vx) > 0.1;
    const isJump = !p.isGrounded;
    const runCycle = isRun ? Math.sin(t * 0.02) : 0;
    const bounce = isRun ? Math.abs(Math.sin(t * 0.02)) * 2 : 0;

    const colors = PLAYER_COLORS[idx];
    const parkaMain = colors.main;
    const parkaDark = colors.parkaDark;
    const fur = '#f8fafc';
    const skin = colors.skin;
    const hammerWood = '#78350f';
    const hammerIron = '#64748b';

    // Wings (Featherweight)
    if (upgrades[UpgradeType.FEATHERWEIGHT]) {
        ctx.save();
        ctx.translate(-10, -5);
        ctx.rotate(Math.sin(t * 0.01) * 0.2);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 12, -0.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    ctx.save();
    let armAngle = isRun ? -Math.PI/4 + runCycle * 0.5 : -Math.PI/4;
    
    if (p.isAttacking) {
        const progress = 1 - (p.attackTimer / 15);
        armAngle = -Math.PI/4 + (Math.PI/2 * Math.sin(progress * Math.PI));
    }

    ctx.rotate(armAngle);
    ctx.translate(-6, 4);
    
    const isPower = upgrades[UpgradeType.POWER_HAMMER];
    
    ctx.fillStyle = hammerWood; ctx.fillRect(-2, -14, 4, 20);
    ctx.fillStyle = isPower ? '#f59e0b' : hammerIron; 
    if (isPower) { ctx.fillRect(-8, -22, 16, 12); ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 10; } 
    else { ctx.fillRect(-6, -18, 12, 8); }
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = parkaMain; ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#1e293b'; 
    if (isJump) { ctx.fillRect(-8, 12, 6, 6); ctx.fillRect(2, 10, 6, 6); } 
    else { ctx.fillRect(-8 - runCycle * 3, 14, 6, 6); ctx.fillRect(2 + runCycle * 3, 14, 6, 6); }

    // Spiked Boots Visual
    if (upgrades[UpgradeType.SPIKED_BOOTS]) {
         ctx.fillStyle = '#94a3b8';
         if (isJump) { ctx.fillRect(-8, 18, 6, 2); ctx.fillRect(2, 16, 6, 2); }
         else { ctx.fillRect(-8 - runCycle * 3, 20, 6, 2); ctx.fillRect(2 + runCycle * 3, 20, 6, 2); }
    }

    ctx.translate(0, -bounce);
    ctx.fillStyle = parkaMain;
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(12, 14); ctx.lineTo(-12, 14); ctx.fill();

    ctx.fillStyle = fur;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-12, 12, 24, 5, 2); else ctx.rect(-12, 12, 24, 5); ctx.fill();

    ctx.translate(0, -12);
    ctx.fillStyle = parkaDark; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = parkaMain; ctx.beginPath(); ctx.arc(0, -1, 11, Math.PI, 0); ctx.lineTo(11, 5); ctx.arc(0, 5, 11, 0, Math.PI); ctx.fill();

    ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(0, 1, 9, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    if (p.facingRight) { ctx.ellipse(3, 0, 1.5, 2.5, 0, 0, Math.PI*2); ctx.ellipse(-1, 0, 1.5, 2.5, 0, 0, Math.PI*2); } 
    else { ctx.ellipse(-3, 0, 1.5, 2.5, 0, 0, Math.PI*2); ctx.ellipse(1, 0, 1.5, 2.5, 0, 0, Math.PI*2); }
    ctx.fill();

    if (p.state === 'die') {
         ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(1, 3); ctx.moveTo(1, -1); ctx.lineTo(-3, 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, -1); ctx.lineTo(7, 3); ctx.moveTo(7, -1); ctx.lineTo(3, 3); ctx.stroke();
    } else {
         ctx.fillStyle = 'rgba(244, 63, 94, 0.3)'; ctx.beginPath(); ctx.arc(4, 3, 2, 0, Math.PI*2); ctx.arc(-4, 3, 2, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
  };

  const drawIceBlock = (ctx: CanvasRenderingContext2D, b: Block) => {
    if (b.type === BlockType.SPIKE) { drawSpike(ctx, b); return; }
    if (b.type === BlockType.CLOUD) { drawCloud(ctx, b); return; }

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
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.width, b.height, r); else ctx.rect(b.x, b.y, b.width, b.height); ctx.clip(); 

    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height); grad.addColorStop(0, lightColor); grad.addColorStop(0.4, mainColor); grad.addColorStop(1, darkColor);
    ctx.fillStyle = grad; ctx.fillRect(b.x, b.y, b.width, b.height);

    if (isUnbreakable) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; for(let i=0; i<b.width; i+=8) ctx.fillRect(b.x + i, b.y, 2, b.height); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(b.x, b.y, b.width, 2);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath();
        for(let i=0; i<3; i++) {
            const p1x = b.x + pseudoRandom(seed + i) * b.width; const p1y = b.y + pseudoRandom(seed + i + 1) * b.height;
            const p2x = b.x + pseudoRandom(seed + i + 2) * b.width; const p2y = b.y + pseudoRandom(seed + i + 3) * b.height;
            const p3x = b.x + pseudoRandom(seed + i + 4) * b.width; const p3y = b.y + pseudoRandom(seed + i + 5) * b.height;
            ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(p3x, p3y);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5; ctx.beginPath(); const cx = b.x + b.width/2; const cy = b.y + b.height/2; ctx.moveTo(cx, cy); ctx.lineTo(cx + (pseudoRandom(seed)*20 - 10), cy + (pseudoRandom(seed+1)*20)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x + r, b.y + 2); ctx.lineTo(b.x + b.width - r, b.y + 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + r); ctx.lineTo(b.x + 2, b.y + b.height - r); ctx.stroke();

    const snowDepth = b.biome === BiomeType.BLIZZARD ? 10 : 6;
    ctx.fillStyle = snowColor; ctx.beginPath(); ctx.moveTo(b.x, b.y + snowDepth);
    const waves = 4; const waveW = b.width / waves;
    for(let i=0; i<=waves; i++) {
        const wx = b.x + i * waveW; const wy = b.y + snowDepth + (pseudoRandom(seed + i + 10) * 4); 
        if (i === 0) ctx.moveTo(b.x, b.y + snowDepth); else { const prevX = b.x + (i-1) * waveW; const cx = (prevX + wx) / 2; ctx.quadraticCurveTo(cx, wy, wx, b.y + snowDepth); }
    }
    ctx.lineTo(b.x + b.width, b.y); ctx.lineTo(b.x, b.y); ctx.fill(); ctx.restore();
  };

  const drawYeti = (ctx: CanvasRenderingContext2D, e: Enemy) => {
      const t = Date.now() / 150; const bounce = Math.sin(t) * 2; const walk = Math.cos(t) * 4;
      ctx.save(); ctx.translate(e.x + e.width/2, e.y + e.height/2); if (!e.facingRight) ctx.scale(-1, 1);
      
      if (e.aggro) {
          ctx.save(); if (!e.facingRight) ctx.scale(-1, 1);
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -20 + bounce); ctx.restore();
      }

      if (e.state === 'build') {
          const buildProgress = 1 - (e.buildTimer / ENEMY_CONFIG.YETI.buildTime);
          const hammerAngle = Math.sin(buildProgress * Math.PI * 4) * 0.5;
          ctx.rotate(0.2); ctx.translate(0, 5); 
          ctx.save(); ctx.rotate(hammerAngle); ctx.fillStyle = '#64748b'; ctx.fillRect(10, 0, 8, 4); ctx.fillRect(14, -4, 4, 12); ctx.restore();
      }

      ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.ellipse(0, 0 + bounce, 14, 13, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(0, 6 + bounce, 10, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.ellipse(4, -2 + bounce, 2, 3, 0, 0, Math.PI*2); ctx.ellipse(0, -2 + bounce, 2, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = e.aggro ? '#ef4444' : '#f43f5e'; ctx.beginPath(); ctx.arc(2, 1 + bounce, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, 2 + bounce); ctx.lineTo(14, 6 + bounce + walk); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 2 + bounce); ctx.lineTo(-10, 6 + bounce - walk); ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.ellipse(-6 + walk/2, 14, 4, 3, 0, 0, Math.PI*2); ctx.ellipse(6 - walk/2, 14, 4, 3, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  };

  const drawBird = (ctx: CanvasRenderingContext2D, e: Enemy) => {
      const t = Date.now() / 100; const flap = Math.sin(t) * 8;
      ctx.save(); ctx.translate(e.x + e.width/2, e.y + e.height/2); if (!e.facingRight) ctx.scale(-1, 1);
      if (e.aggro) ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ec4899'; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(8, -2 - Math.abs(flap)); ctx.lineTo(4, 4); ctx.fill();
      ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(6, -4, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fcd34d'; ctx.beginPath(); ctx.moveTo(9, -4); ctx.lineTo(16, -2); ctx.lineTo(9, 0); ctx.fill();
      ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(7, -5, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#db2777'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -4); ctx.lineTo(-14, 4); ctx.fill(); ctx.restore();
  };

  const drawEnvironment = (ctx: CanvasRenderingContext2D) => {
      const currentBiome = getBiomeAtLevel(Math.floor(Math.abs(cameraYRef.current) / (TILE_SIZE * 4)));
      const config = BIOME_CONFIG[currentBiome];
      const t = Date.now() / 1000;
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT); grad.addColorStop(0, config.bgTop); grad.addColorStop(1, config.bgBottom);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (currentBiome === BiomeType.AURORA) {
          ctx.save(); ctx.globalCompositeOperation = 'screen';
          for(let i=0; i<3; i++) {
              const shift = i * 100; const color = i % 2 === 0 ? 'rgba(45, 212, 191, 0.3)' : 'rgba(167, 139, 250, 0.3)'; 
              const auroraGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0); auroraGrad.addColorStop(0, 'rgba(0,0,0,0)'); auroraGrad.addColorStop(0.5, color); auroraGrad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = auroraGrad; ctx.beginPath(); ctx.moveTo(0, 100 + shift); const amp = 50 + Math.sin(t + i) * 30;
              for (let x = 0; x <= CANVAS_WIDTH; x+=20) { const y = 100 + shift + Math.sin(x * 0.005 + t + i) * amp; ctx.lineTo(x, y); }
              ctx.lineTo(CANVAS_WIDTH, 0); ctx.lineTo(0, 0); ctx.fill();
          }
          ctx.restore(); ctx.fillStyle = 'white';
          for(let i=0; i<20; i++) {
              const sx = (Math.sin(i*132 + t*0.01) * CANVAS_WIDTH + CANVAS_WIDTH)%CANVAS_WIDTH; const sy = (Math.cos(i*53 + t*0.02) * CANVAS_HEIGHT/2 + CANVAS_HEIGHT/2);
              ctx.globalAlpha = 0.5 + Math.sin(t*2 + i)*0.5; ctx.fillRect(sx, sy, 2, 2);
          }
          ctx.globalAlpha = 1;
      } else if (currentBiome === BiomeType.BLIZZARD) {
           ctx.fillStyle = 'rgba(200, 210, 230, 0.1)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
           const cloudOffset = (t * 50) % CANVAS_WIDTH;
           const gradFog = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0); gradFog.addColorStop(0, 'rgba(255,255,255,0)'); gradFog.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gradFog.addColorStop(1, 'rgba(255,255,255,0)');
           ctx.save(); ctx.translate(-cloudOffset, 0); ctx.fillStyle = gradFog; ctx.fillRect(0, 0, CANVAS_WIDTH * 2, CANVAS_HEIGHT); ctx.restore();
      }
  };

  const drawSnow = (ctx: CanvasRenderingContext2D, biome: BiomeType) => {
      const t = Date.now() / 1000;
      snowRef.current.forEach(s => {
          let x, y, alpha;
          if (biome === BiomeType.BLIZZARD) {
              const speedX = s.speed * 4 + 5 + Math.abs(windOffsetRef.current * 0.1); 
              const speedY = s.speed * 2;
              x = (s.x + t * speedX * 50) % CANVAS_WIDTH; y = (s.y + t * speedY * 50 - cameraYRef.current * 0.8) % CANVAS_HEIGHT;
              ctx.fillStyle = '#e2e8f0'; ctx.globalAlpha = s.opacity * 0.8; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 6); ctx.fillRect(0, 0, s.size * 4, s.size / 2); ctx.restore();
          } else if (biome === BiomeType.AURORA) {
              const speedY = s.speed * 0.2; x = (s.x + Math.sin(t + s.wobble) * 30) % CANVAS_WIDTH; y = (s.y + t * speedY * 20 - cameraYRef.current * 0.2) % CANVAS_HEIGHT; alpha = 0.5 + Math.sin(t * 5 + s.wobble) * 0.5;
              ctx.fillStyle = '#2dd4bf'; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(x, y - s.size); ctx.lineTo(x + s.size, y); ctx.lineTo(x, y + s.size); ctx.lineTo(x - s.size, y); ctx.fill();
          } else {
              const speedY = s.speed; x = (s.x + Math.sin(t + s.wobble) * 20) % CANVAS_WIDTH; y = (s.y + t * speedY * 60 - cameraYRef.current * 0.5) % CANVAS_HEIGHT;
              ctx.fillStyle = 'white'; ctx.globalAlpha = s.opacity; ctx.beginPath(); ctx.arc(x, y, s.size, 0, Math.PI * 2); ctx.fill();
          }
      });
      ctx.globalAlpha = 1;
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
      const wind = windOffsetRef.current * 0.05; 
      particlesRef.current.forEach(p => {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
          if (p.gravity > 0) { ctx.beginPath(); ctx.moveTo(-p.size, -p.size); ctx.lineTo(p.size, 0); ctx.lineTo(0, p.size); ctx.fill(); } 
          else { ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); p.x += wind; }
          ctx.restore();
      });
  };

  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameState === GameState.PLAYING) {
        if (hitStopRef.current > 0) {
             hitStopRef.current--;
        } else {
            updatePhysics(16);
            updateCamera();
            updateEnemies();
            
            combosRef.current.forEach(c => {
                if (c.timer > 0) {
                    c.timer--;
                    if (c.timer <= 0) { c.count = 0; c.multiplier = 1; }
                }
            });

            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.x += p.vx; p.y += p.vy; if (p.gravity > 0) p.vy += p.gravity;
                if (p.bounce) {
                     for (const block of mapRef.current) {
                         if (p.x > block.x && p.x < block.x + block.width && p.y > block.y && p.y < block.y + block.height) {
                             p.y = block.y; p.vy *= -0.5; p.vx *= 0.8; break;
                         }
                     }
                } else { p.vy += 0.1; }
                p.rotation += p.rotSpeed; p.life -= 0.015; if (p.life <= 0) particlesRef.current.splice(i, 1);
            }

            for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
                const ft = floatingTextsRef.current[i];
                ft.x += ft.vx; ft.y += ft.vy; ft.life -= 0.02; if (ft.life <= 0) floatingTextsRef.current.splice(i, 1);
            }
        }
    }

    ctx.save();
    
    const shakeC = traumaRef.current * traumaRef.current; 
    const shakeMag = shakeC * 15; 
    const shakeX = (Math.random() - 0.5) * shakeMag; const shakeY = (Math.random() - 0.5) * shakeMag;
    ctx.translate(shakeX, shakeY);

    drawEnvironment(ctx);
    const currentBiome = getBiomeAtLevel(Math.floor(Math.abs(cameraYRef.current) / (TILE_SIZE * 4)));
    drawSnow(ctx, currentBiome);

    ctx.translate(0, -cameraYRef.current);
    
    drawCombo(ctx);
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
    
    // Draw all players
    playersRef.current.forEach((player, i) => {
         drawPlayer(ctx, player, i);
    });

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
      style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
    />
  );
};

export default GameRenderer;
