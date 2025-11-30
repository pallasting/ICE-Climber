
import { GameConfig, BiomeType, BiomeConfig, ItemType, UpgradeType } from './types';

export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 800;

export const TILE_SIZE = 40;
export const COLS = CANVAS_WIDTH / TILE_SIZE;

// Modern "Game Feel" Physics - TUNED FOR REALISM & MOMENTUM
export const PHYSICS: GameConfig = {
  gravity: 0.65,           // Increased for heavier, more realistic fall
  friction: 0.84,          // Ground friction (slide)
  airFriction: 0.998,      // NEARLY 1.0 = Conservation of momentum. You barely slow down in air.
  accel: 0.8,              // Ground acceleration
  airAccel: 0.04,          // DRASTICALLY REDUCED. Very hard to change direction mid-air.
  jumpForce: -16.5,        // Increased to compensate for higher gravity
  terminalVelocity: 16,
  coyoteTime: 120,         // Slight reduction for tighter feel
  cornerCorrection: 14,
};

export const PLAYER_SIZE = { width: 24, height: 38 };

export const PLAYER_COLORS = [
    {
        main: '#3b82f6', // Blue (Popo)
        glow: '#60a5fa',
        skin: '#fda4af',
        parkaDark: '#2563eb'
    },
    {
        main: '#ec4899', // Pink (Nana)
        glow: '#f472b6',
        skin: '#fda4af',
        parkaDark: '#db2777'
    }
];

export const DIFFICULTY = {
  ENEMY_SPEED_SCALING: 0.005, // Speed increase per level
  BOSS_HP_MULT: 1.2,          // HP Multiplier per encounter
  BOSS_SPEED_MULT: 1.1,       // Speed Multiplier per encounter
};

export const ENEMY_CONFIG = {
  YETI: {
    width: 30,
    height: 30,
    speed: 1.2,
    color: '#e2e8f0',
    buildTime: 60, // Frames to build a block
  },
  BIRD: {
    width: 28,
    height: 20,
    speed: 2.2,
    color: '#f472b6',
  }
};

export const BOSS_CONFIG = {
  LEVEL: 19, // Initial Level
  WIDTH: 80,
  HEIGHT: 80,
  HP: 300,
  SPEED: 2,
  ATTACK_INTERVAL: 120, // Frames
  COLOR: '#818cf8'
};

export const BOSS_PHASES = {
  P2_THRESHOLD: 0.6, // 60% HP
  P3_THRESHOLD: 0.3, // 30% HP
  P1_INTERVAL: 120,
  P2_INTERVAL: 90,
  P3_INTERVAL: 60,
};

export const PROJECTILE_CONFIG = {
  WIDTH: 15,
  HEIGHT: 40,
  SPEED: 6,
  REFLECT_SPEED: 18,
};

export const CLOUD_CONFIG = {
    SPEED: 1.5,
    COLOR: 'rgba(255, 255, 255, 0.9)',
};

export const ITEM_CONFIG = {
  [ItemType.EGGPLANT]: { points: 100, heat: 10, color: '#a855f7', width: 20, height: 20 },
  [ItemType.CARROT]:   { points: 300, heat: 25, color: '#f97316', width: 20, height: 20 },
  [ItemType.CABBAGE]:  { points: 500, heat: 50, color: '#22c55e', width: 22, height: 22 },
};

export const UPGRADE_CONFIG = {
  [UpgradeType.SPIKED_BOOTS]: {
    name: "Spiked Boots",
    desc: "Better grip on ice. Reduce sliding.",
    cost: 150,
    icon: "👢"
  },
  [UpgradeType.FEATHERWEIGHT]: {
    name: "Featherweight",
    desc: "Low gravity suit. Jump higher, fall slower.",
    cost: 250,
    icon: "🪶"
  },
  [UpgradeType.POWER_HAMMER]: {
    name: "Power Hammer",
    desc: "Smash enemies with ease.",
    cost: 400,
    icon: "🔨"
  }
};

export const SHAKE_INTENSITY = {
  SMALL: 0.3,  // Walking/Landing
  MEDIUM: 0.6, // Breaking block
  LARGE: 1.0,  // Getting hit
};

export const BIOME_CONFIG: Record<BiomeType, BiomeConfig> = {
  [BiomeType.ICE_CAVE]: {
    startLevel: 0,
    endLevel: 20,
    bgTop: '#1e1b4b',
    bgBottom: '#020617',
    blockBase: '#06b6d4',
  },
  [BiomeType.BLIZZARD]: {
    startLevel: 20,
    endLevel: 50,
    bgTop: '#374151',
    bgBottom: '#1f2937',
    blockBase: '#94a3b8',
    fog: true,
  },
  [BiomeType.AURORA]: {
    startLevel: 50,
    endLevel: 999,
    bgTop: '#4c1d95',
    bgBottom: '#0f172a',
    blockBase: '#2dd4bf',
    glow: true,
  }
};

export const COLORS = {
  iceBase: '#06b6d4',
  iceHighlight: '#a5f3fc',
  iceShadow: '#083344',
  
  unbreakableBase: '#475569',
  unbreakableHighlight: '#94a3b8',
  
  cloud: 'rgba(255, 255, 255, 0.8)', 
  
  player: '#3b82f6',
  playerGlow: '#60a5fa',
  playerSkin: '#fda4af',
};

export const SCROLL_THRESHOLD = CANVAS_HEIGHT * 0.4;
