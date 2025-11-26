
export enum BlockType {
  EMPTY = 0,
  NORMAL = 1,
  UNBREAKABLE = 2,
  CLOUD = 3,    // Moving platform
  SLIPPERY = 4, // High friction/ice
  SPIKE = 5,    // Instant death
}

export enum BiomeType {
  ICE_CAVE = 'ICE_CAVE',
  BLIZZARD = 'BLIZZARD',
  AURORA = 'AURORA',
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED', // Added PAUSED state
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  SHOP = 'SHOP',
}

export enum EnemyType {
  YETI = 'YETI',
  BIRD = 'BIRD',
}

export enum ItemType {
  EGGPLANT = 'EGGPLANT',
  CARROT = 'CARROT',
  CABBAGE = 'CABBAGE',
}

export enum UpgradeType {
  SPIKED_BOOTS = 'SPIKED_BOOTS',
  FEATHERWEIGHT = 'FEATHERWEIGHT',
  POWER_HAMMER = 'POWER_HAMMER',
}

export interface Upgrades {
  [UpgradeType.SPIKED_BOOTS]: boolean;
  [UpgradeType.FEATHERWEIGHT]: boolean;
  [UpgradeType.POWER_HAMMER]: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface Entity extends Point, Velocity {
  id?: number; // Player ID (0 or 1)
  width: number;
  height: number;
  color: string;
  isGrounded: boolean;
  lastGroundedTime: number; // For Coyote Time
  facingRight: boolean;
  state: 'idle' | 'run' | 'jump' | 'hit' | 'fall' | 'build' | 'die' | 'ghost';
  hitCooldown: number;
  // Combat State
  isAttacking: boolean;
  attackTimer: number; // How long hitbox is active
  attackCooldown: number;
  rotation?: number; // For death animation
}

export interface Enemy extends Entity {
  type: EnemyType;
  patrolStart: number;
  patrolEnd: number;
  spawnY: number; // Reference Y for flying enemies
  isDead: boolean;
  // AI State
  state: 'idle' | 'run' | 'jump' | 'hit' | 'fall' | 'build' | 'die';
  buildTimer: number;
  aggro: boolean; // Threat state
}

export interface Boss extends Entity {
  hp: number;
  maxHp: number;
  isActive: boolean;
  phase: number; // 0: Idle, 1: Attack
  moveTimer: number;
}

export interface Projectile extends Entity {
  id: number;
  isReflected: boolean; // True if player hit it back
  damage: number;
  rotation: number;
}

export interface Block extends Point {
  id: string; // Unique ID for React keys if needed, or tracking
  width: number;
  height: number;
  type: BlockType;
  health: number;
  biome: BiomeType;
  vx?: number; // For moving blocks (clouds)
}

export interface Item extends Point {
  id: string;
  type: ItemType;
  width: number;
  height: number;
  collected: boolean;
  floatOffset: number; // For bobbing animation
}

export interface Particle extends Point, Velocity {
  life: number;      // 0 to 1
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  gravity: number;   // 0 for snow, >0 for shards
  bounce: boolean;   // Should it bounce on floor?
}

export interface FloatingText extends Point, Velocity {
  text: string;
  life: number;
  color: string;
  size: number;
}

export interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  wobble: number;
}

export interface ComboState {
  count: number;
  timer: number;
  multiplier: number;
}

export interface GameConfig {
  gravity: number;
  friction: number;
  airFriction: number;
  accel: number;
  airAccel: number; // Air Control
  jumpForce: number;
  terminalVelocity: number;
  coyoteTime: number;
  cornerCorrection: number;
}

export interface BiomeConfig {
  startLevel: number;
  endLevel: number;
  bgTop: string;
  bgBottom: string;
  blockBase: string;
  fog?: boolean;
  glow?: boolean;
}
