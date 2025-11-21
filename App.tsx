
import React, { useState, useEffect } from 'react';
import GameRenderer from './components/GameRenderer';
import { GameState, BiomeType } from './types';
import { Activity, Zap, Trophy, Mountain, Snowflake, Wind, Crown } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [biome, setBiome] = useState<string>(BiomeType.ICE_CAVE);
  
  // High Score State
  const [highScore, setHighScore] = useState(0);
  const [maxAltRecord, setMaxAltRecord] = useState(0);

  // Load High Score on Mount
  useEffect(() => {
    const savedScore = localStorage.getItem('icebreaker_highscore');
    const savedAlt = localStorage.getItem('icebreaker_maxalt');
    if (savedScore) setHighScore(parseInt(savedScore));
    if (savedAlt) setMaxAltRecord(parseInt(savedAlt));
  }, []);

  // Handle Game State Changes (Check for High Score on Death)
  // This function is recreated when score changes, ensuring we have the latest score.
  const handleGameStateChange = (newState: GameState) => {
    setGameState(newState);
    if (newState === GameState.GAME_OVER) {
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('icebreaker_highscore', score.toString());
      }
      if (altitude > maxAltRecord) {
        setMaxAltRecord(altitude);
        localStorage.setItem('icebreaker_maxalt', altitude.toString());
      }
    }
  };

  const startGame = () => {
    setScore(0);
    setAltitude(0);
    setGameState(GameState.PLAYING);
  };

  const getBiomeIcon = () => {
      switch(biome) {
          case BiomeType.BLIZZARD: return <Wind size={16} className="text-slate-300" />;
          case BiomeType.AURORA: return <Zap size={16} className="text-purple-300" />;
          default: return <Snowflake size={16} className="text-cyan-300" />;
      }
  };

  const getBiomeName = () => {
      switch(biome) {
          case BiomeType.BLIZZARD: return "Death Zone";
          case BiomeType.AURORA: return "Aurora Peak";
          default: return "Ice Cavern";
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-2 sm:p-4 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e1b4b_0%,_#020617_70%)] opacity-80 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none"></div>

      <div className="w-full max-w-[600px] flex flex-col items-center relative z-10">
        
        {/* HUD - Glassmorphism */}
        <div className="w-full grid grid-cols-3 items-center mb-4 text-white bg-white/5 border border-white/10 p-3 sm:p-4 rounded-2xl backdrop-blur-xl shadow-2xl ring-1 ring-white/10 transition-all duration-500">
          
          {/* Left: Scores */}
          <div className="flex flex-col gap-2">
            {/* Current Score */}
            <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-0.5">Score</span>
                <span className="text-lg sm:text-2xl font-bold font-mono text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] leading-none">
                    {score.toString().padStart(6, '0')}
                </span>
            </div>
            
            {/* Best Score */}
            <div className="flex items-center gap-1.5 opacity-70">
                <Crown size={10} className="text-yellow-400" />
                <span className="text-[8px] sm:text-[10px] uppercase tracking-widest font-bold text-yellow-400">Best</span>
                <span className="text-[10px] sm:text-xs font-mono text-white">{highScore.toString().padStart(6, '0')}</span>
            </div>
          </div>
          
          {/* Center: Biome */}
          <div className="flex justify-center">
             <div className="flex flex-col items-center bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg backdrop-blur-md">
                {getBiomeIcon()}
                <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider mt-1 text-center leading-tight">{getBiomeName()}</span>
             </div>
          </div>

          {/* Right: Altitude */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-col items-end">
                <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Altitude</div>
                <div className="flex items-center gap-1 text-emerald-400 leading-none">
                    <Mountain size={14} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="text-lg sm:text-2xl font-mono">{altitude}m</span>
                </div>
            </div>
            <div className="text-[8px] sm:text-[10px] font-mono text-slate-500">
                MAX: {maxAltRecord}m
            </div>
          </div>
        </div>

        {/* Game Container */}
        <div className="relative w-full aspect-[3/4] max-w-[600px] group shadow-[0_0_100px_-20px_rgba(6,182,212,0.3)] rounded-lg overflow-hidden border border-white/10 bg-black">
          <GameRenderer 
            gameState={gameState} 
            setGameState={handleGameStateChange} 
            setScore={setScore} 
            setAltitude={setAltitude}
            setBiome={setBiome}
          />

          {/* Scanline/CRT Effect (Subtle) */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.1)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.03),_rgba(0,255,0,0.01),_rgba(0,0,255,0.03))] bg-[length:100%_3px,_3px_100%] opacity-20 z-20"></div>

          {/* Menu Overlay */}
          {gameState === GameState.MENU && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-center z-30 backdrop-blur-md px-4">
              <div className="mb-8 relative">
                  <div className="absolute -inset-4 bg-cyan-500/20 blur-2xl rounded-full"></div>
                  <h1 className="relative text-4xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-200 to-cyan-500 drop-shadow-lg italic tracking-tighter">
                    ICE BREAKER
                  </h1>
                  <div className="text-cyan-400 font-mono text-[10px] sm:text-xs tracking-[0.5em] mt-2 uppercase">Infinite Ascent</div>
              </div>
              
              <div className="space-y-6 w-full max-w-xs sm:max-w-md">
                <button 
                  onClick={startGame}
                  className="w-full group relative px-10 py-4 bg-cyan-500 text-black font-bold text-lg sm:text-xl uppercase tracking-wider overflow-hidden rounded-full transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(6,182,212,0.6)]"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                  <span>Start Climb</span>
                </button>
                
                <div className="grid grid-cols-2 gap-4 text-left p-4 sm:p-6 bg-white/5 rounded-xl border border-white/5">
                  <div className="space-y-1">
                    <span className="text-[10px] sm:text-xs text-cyan-400 uppercase tracking-wider">Stats</span>
                    <div className="text-white font-mono text-[10px] sm:text-xs opacity-70">
                        Best: {highScore}<br/>Max Height: {maxAltRecord}m
                    </div>
                  </div>
                  <div className="space-y-1">
                     <span className="text-[10px] sm:text-xs text-cyan-400 uppercase tracking-wider">Biomes</span>
                     <div className="text-white font-mono text-[10px] sm:text-xs opacity-70">Cave • Blizzard • Aurora</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-center z-30 backdrop-blur-sm px-4">
              <Zap className="w-16 h-16 sm:w-20 sm:h-20 text-red-500 mb-6 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter">FATAL FALL</h2>
              <p className="text-red-200 mb-8 font-mono text-sm sm:text-base">ALTITUDE LOST</p>
              <div className="bg-black/30 px-6 sm:px-8 py-4 rounded-lg mb-8 border border-red-500/30 grid grid-cols-2 gap-4 sm:gap-8 w-full max-w-xs">
                  <div>
                    <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1">Score</p>
                    <p className="text-2xl sm:text-3xl text-white font-mono">{score}</p>
                    {score >= highScore && score > 0 && <span className="text-[10px] text-yellow-400 font-bold animate-pulse">NEW RECORD!</span>}
                  </div>
                  <div>
                    <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1">Height</p>
                    <p className="text-2xl sm:text-3xl text-white font-mono">{altitude}m</p>
                  </div>
              </div>
              <button 
                onClick={startGame}
                className="px-8 py-3 bg-white text-red-900 font-bold uppercase rounded-full hover:bg-red-50 transition-colors text-sm sm:text-base"
              >
                Retry Mission
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 sm:mt-6 flex items-center gap-6 text-slate-500 text-[10px] sm:text-xs font-mono uppercase tracking-wider">
           <div className="flex items-center gap-2">
             <Activity size={14} className="text-cyan-600" />
             <span>PhysX Engine 3.1</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
