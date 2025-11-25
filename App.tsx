
import React, { useState, useEffect } from 'react';
import GameRenderer from './components/GameRenderer';
import { GameState, BiomeType, Upgrades, UpgradeType } from './types';
import { UPGRADE_CONFIG } from './constants';
import { Activity, Zap, Trophy, Mountain, Snowflake, Wind, Crown, Flame, ShoppingBag, Play, ShieldAlert, Users, User } from 'lucide-react';
import { audioManager } from './utils/audio';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  
  // Scores for P1 and P2. For 1P, p2 is ignored.
  const [scores, setScores] = useState<{ p1: number, p2: number }>({ p1: 0, p2: 0 });
  const [playerCount, setPlayerCount] = useState<number>(1);

  const [heat, setHeat] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [biome, setBiome] = useState<string>(BiomeType.ICE_CAVE);
  const [gameId, setGameId] = useState(0); 
  
  // Upgrades State
  const [upgrades, setUpgrades] = useState<Upgrades>({
    [UpgradeType.SPIKED_BOOTS]: false,
    [UpgradeType.FEATHERWEIGHT]: false,
    [UpgradeType.POWER_HAMMER]: false,
  });
  
  const [bossStatus, setBossStatus] = useState<{ active: boolean, hp: number, maxHp: number }>({
      active: false, hp: 0, maxHp: 100
  });
  
  const [highScore, setHighScore] = useState(0);
  const [maxAltRecord, setMaxAltRecord] = useState(0);

  const safeGetItem = (key: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
         return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn("Storage access denied");
    }
    return null;
  };

  const safeSetItem = (key: string, value: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("Storage access denied");
    }
  };

  useEffect(() => {
    const savedScore = safeGetItem('icebreaker_highscore');
    const savedAlt = safeGetItem('icebreaker_maxalt');
    if (savedScore) setHighScore(parseInt(savedScore));
    if (savedAlt) setMaxAltRecord(parseInt(savedAlt));
  }, []);

  const handleGameStateChange = (newState: GameState) => {
    setGameState(newState);
    if (newState === GameState.GAME_OVER) {
      // Use highest score of P1/P2 for high score check
      const bestCurrent = Math.max(scores.p1, scores.p2);
      if (bestCurrent > highScore) {
        setHighScore(bestCurrent);
        safeSetItem('icebreaker_highscore', bestCurrent.toString());
      }
      if (altitude > maxAltRecord) {
        setMaxAltRecord(altitude);
        safeSetItem('icebreaker_maxalt', altitude.toString());
      }
    }
  };

  const startGame = (count: number) => {
    setPlayerCount(count);
    audioManager.init();
    audioManager.playSelect();
    
    setGameId(prev => prev + 1);
    
    setScores({ p1: 0, p2: 0 });
    setHeat(0);
    setAltitude(0);
    setUpgrades({
        [UpgradeType.SPIKED_BOOTS]: false,
        [UpgradeType.FEATHERWEIGHT]: false,
        [UpgradeType.POWER_HAMMER]: false,
    });
    setBossStatus({ active: false, hp: 0, maxHp: 100 });
    setGameState(GameState.PLAYING);
  };

  const resumeGame = () => {
      audioManager.playSelect();
      setGameState(GameState.PLAYING);
  };

  const buyUpgrade = (type: UpgradeType) => {
      const config = UPGRADE_CONFIG[type];
      if (heat >= config.cost && !upgrades[type]) {
          setHeat(h => h - config.cost);
          setUpgrades(prev => ({ ...prev, [type]: true }));
          audioManager.playBuy();
      }
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
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e1b4b_0%,_#020617_70%)] opacity-80 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none"></div>

      <div className="w-full max-w-[600px] flex flex-col items-center relative z-10">
        
        {/* HUD */}
        <div className="w-full grid grid-cols-3 items-center mb-4 text-white bg-white/5 border border-white/10 p-3 sm:p-4 rounded-2xl backdrop-blur-xl shadow-2xl ring-1 ring-white/10 transition-all duration-500">
          
          {/* Left: Scores */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-0.5">
                   {playerCount > 1 ? 'P1 Score' : 'Score'}
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] leading-none">
                    {scores.p1.toString().padStart(6, '0')}
                </span>
                {playerCount > 1 && (
                    <div className="mt-1">
                        <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-pink-400 font-bold mb-0.5">P2 Score</span>
                        <div className="text-lg sm:text-2xl font-bold font-mono text-white drop-shadow-[0_0_10px_rgba(236,72,153,0.5)] leading-none">
                            {scores.p2.toString().padStart(6, '0')}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-1.5 opacity-70">
                <Crown size={10} className="text-yellow-400" />
                <span className="text-[8px] sm:text-[10px] uppercase tracking-widest font-bold text-yellow-400">Best</span>
                <span className="text-[10px] sm:text-xs font-mono text-white">{highScore.toString().padStart(6, '0')}</span>
            </div>
          </div>
          
          {/* Center: Biome & Heat */}
          <div className="flex flex-col items-center gap-2">
             <div className="flex items-center bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg backdrop-blur-md gap-2">
                {getBiomeIcon()}
                <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{getBiomeName()}</span>
             </div>
             <div className="flex items-center gap-1 text-amber-400">
                 <Flame size={14} className="animate-pulse" />
                 <span className="text-sm font-mono font-bold">{heat}</span>
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
        
        {bossStatus.active && (
            <div className="w-full mb-2 animate-in fade-in slide-in-from-top duration-500">
                <div className="flex justify-between items-end mb-1 px-2">
                    <span className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert size={14} />
                        Ice Golem
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">{bossStatus.hp} / {bossStatus.maxHp}</span>
                </div>
                <div className="h-3 w-full bg-slate-900/80 rounded-full border border-indigo-500/30 overflow-hidden relative">
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-300 ease-out"
                        style={{ width: `${(bossStatus.hp / bossStatus.maxHp) * 100}%` }}
                    ></div>
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-white/30"></div>
                </div>
            </div>
        )}

        {/* Game Container */}
        <div className="relative w-full aspect-[3/4] max-w-[600px] group shadow-[0_0_100px_-20px_rgba(6,182,212,0.3)] rounded-lg overflow-hidden border border-white/10 bg-black">
          <GameRenderer 
            key={gameId} 
            gameState={gameState} 
            setGameState={handleGameStateChange} 
            setScores={setScores}
            setHeat={setHeat}
            setAltitude={setAltitude}
            setBiome={setBiome}
            upgrades={upgrades}
            setBossStatus={setBossStatus}
            playerCount={playerCount}
          />

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
              
              <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button 
                    onClick={() => startGame(1)}
                    className="w-full relative px-6 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-lg uppercase tracking-wider rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-3 border border-cyan-400/30"
                  >
                    <User size={20} />
                    <span>1 Player</span>
                  </button>
                  <button 
                    onClick={() => startGame(2)}
                    className="w-full relative px-6 py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold text-lg uppercase tracking-wider rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-3 border border-pink-400/30"
                  >
                    <Users size={20} />
                    <span>2 Players (Co-op)</span>
                  </button>
              </div>
              
              <div className="mt-8 text-slate-500 text-xs font-mono">
                  P1: WASD / SPACE / C <br/>
                  P2: ARROWS / UP / ENTER
              </div>
            </div>
          )}

          {/* SHOP Overlay */}
          {gameState === GameState.SHOP && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-30 backdrop-blur-md px-4">
               <div className="mb-6 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-amber-500/20 rounded-full mb-2">
                    <Flame className="text-amber-500 w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">Campfire Shop</h2>
                  <p className="text-slate-400 text-sm">Upgrades apply to BOTH players!</p>
               </div>
               
               <div className="flex items-center gap-2 mb-6 bg-black/40 px-4 py-2 rounded-full border border-amber-500/30">
                   <Flame size={18} className="text-amber-500" />
                   <span className="text-xl font-mono font-bold text-white">{heat}</span>
               </div>

               <div className="grid gap-3 w-full max-w-sm mb-8">
                   {Object.values(UpgradeType).map((type) => {
                       const config = UPGRADE_CONFIG[type];
                       const isBought = upgrades[type];
                       const canAfford = heat >= config.cost;

                       return (
                           <button 
                              key={type}
                              onClick={() => buyUpgrade(type)}
                              disabled={isBought || !canAfford}
                              className={`relative p-3 rounded-xl border text-left transition-all flex items-center gap-4
                                ${isBought 
                                    ? 'bg-emerald-900/20 border-emerald-500/50 opacity-80' 
                                    : canAfford 
                                        ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-500/50 cursor-pointer' 
                                        : 'bg-black/20 border-white/5 opacity-50 cursor-not-allowed'}
                              `}
                           >
                               <div className="text-2xl">{config.icon}</div>
                               <div className="flex-1">
                                   <div className="font-bold text-sm text-white flex items-center gap-2">
                                       {config.name}
                                       {isBought && <span className="text-[10px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-bold">OWNED</span>}
                                   </div>
                                   <div className="text-xs text-slate-400">{config.desc}</div>
                               </div>
                               {!isBought && (
                                   <div className={`font-mono font-bold text-sm ${canAfford ? 'text-amber-400' : 'text-slate-600'}`}>
                                       {config.cost}
                                   </div>
                               )}
                           </button>
                       )
                   })}
               </div>

               <button 
                 onClick={resumeGame}
                 className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full transition-colors flex items-center gap-2"
               >
                 <Mountain size={18} />
                 <span>Resume Climb</span>
               </button>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-center z-30 backdrop-blur-sm px-4">
              <Zap className="w-16 h-16 sm:w-20 sm:h-20 text-red-500 mb-6 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter">
                  {playerCount > 1 ? "TEAM WIPEOUT" : "FATAL FALL"}
              </h2>
              <p className="text-red-200 mb-8 font-mono text-sm sm:text-base">ALTITUDE LOST</p>
              
              <div className="bg-black/30 px-6 sm:px-8 py-4 rounded-lg mb-8 border border-red-500/30 grid grid-cols-2 gap-4 sm:gap-8 w-full max-w-xs">
                  <div>
                    <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1">Score</p>
                    <p className="text-xl sm:text-2xl text-white font-mono">{Math.max(scores.p1, scores.p2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1">Height</p>
                    <p className="text-xl sm:text-2xl text-white font-mono">{altitude}m</p>
                  </div>
              </div>
              
              <button 
                onClick={() => startGame(playerCount)}
                className="px-8 py-3 bg-white text-red-900 font-bold uppercase rounded-full hover:bg-red-50 transition-colors text-sm sm:text-base flex items-center gap-2"
              >
                <Activity size={18} />
                <span>Retry Mission</span>
              </button>
              <button 
                onClick={() => setGameState(GameState.MENU)}
                className="mt-4 text-xs text-red-300 hover:text-white underline"
              >
                Return to Menu
              </button>
            </div>
          )}

          {/* Virtual Controls for Mobile (P1 Only) */}
          <div className="absolute bottom-4 left-0 w-full px-4 flex justify-between pointer-events-none z-50 md:hidden">
              <div className="flex gap-2 pointer-events-auto">
                  <button 
                    className="w-14 h-14 bg-white/10 backdrop-blur rounded-full border border-white/20 active:bg-white/30 flex items-center justify-center text-white/80"
                    onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))}
                    onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))}
                  >
                      ←
                  </button>
                  <button 
                    className="w-14 h-14 bg-white/10 backdrop-blur rounded-full border border-white/20 active:bg-white/30 flex items-center justify-center text-white/80"
                    onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))}
                    onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }))}
                  >
                      →
                  </button>
              </div>

              <div className="flex gap-4 pointer-events-auto">
                   <button 
                    className="w-14 h-14 bg-red-500/20 backdrop-blur rounded-full border border-red-500/40 active:bg-red-500/40 flex items-center justify-center text-red-100 font-bold"
                    onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }))}
                    onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }))}
                  >
                      ATK
                  </button>
                  <button 
                    className="w-16 h-16 bg-cyan-500/20 backdrop-blur rounded-full border border-cyan-500/40 active:bg-cyan-500/40 flex items-center justify-center text-cyan-100 font-bold"
                    onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))}
                    onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))}
                  >
                      JUMP
                  </button>
              </div>
          </div>
        </div>
        
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-slate-500 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-center">
           <div>P1: WASD / SPACE / C (Attack)</div>
           <div>P2: ARROWS / UP / ENTER (Attack)</div>
        </div>
      </div>
    </div>
  );
};

export default App;
