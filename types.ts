
export enum BlockType {
  EMPTY = 0,
  NORMAL = 1,
  UNBREAKABLE = 2,
  CLOUD = 3,
  SLIPPERY = 4, // High friction/ice
}

export enum BiomeType {
  ICE_CAVE = 'ICE_CAVE',
  BLIZZARD = 'BLIZZARD',
  AURORA = 'AURORA',
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
}

export enum EnemyType {
  YETI = 'YETI',
  BIRD = 'BIRD',
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
  width: number;
  height: number;
  color: string;
  isGrounded: boolean;
  lastGroundedTime: number; // For Coyote Time
  facingRight: boolean;
  state: 'idle' | 'run' | 'jump' | 'hit' | 'fall';
  hitCooldown: number;
}

export interface Enemy extends Entity {
  type: EnemyType;
  patrolStart: number;
  patrolEnd: number;
  spawnY: number; // Reference Y for flying enemies
  isDead: boolean;
}

export interface Block extends Point {
  id: string; // Unique ID for React keys if needed, or tracking
  width: number;
  height: number;
  type: BlockType;
  health: number;
  biome: BiomeType;
}

export interface Particle extends Point, Velocity {
  life: number;      // 0 to 1
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

export interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  wobble: number;
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
