
import { GameConfig, BiomeType, BiomeConfig } from './types';

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

export const ENEMY_CONFIG = {
  YETI: {
    width: 30,
    height: 30,
    speed: 1.2,
    color: '#e2e8f0',
  },
  BIRD: {
    width: 28,
    height: 20,
    speed: 2.2,
    color: '#f472b6',
  }
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

// Visuals
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
