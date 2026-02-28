import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, XAxis, Tooltip, YAxis, CartesianGrid } from "recharts";
import { Play, Pause, Settings2, ShoppingBag, Shirt, Glasses, Watch, Gamepad, Volume2, VolumeX, Flame, Zap, Trophy, DollarSign } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

// Types
type Category = 'shoes' | 'shirts' | 'electronics' | 'accessories' | 'pants';

type Order = {
  id: string;
  value: number;
  category: Category;
  x: number;
  y: number; 
  vx: number; // Velocity X for spread
  timestamp: number;
};

type DataPoint = {
  time: string;
  volume: number;
};

// Retail Categories Configuration
const CATEGORIES: Record<Category, { icon: React.ReactNode, color: string, label: string, priceRange: [number, number] }> = {
  shoes: { icon: <ShoppingBag size={20} />, color: "#3b82f6", label: "Footwear", priceRange: [50, 250] },
  shirts: { icon: <Shirt size={20} />, color: "#8b5cf6", label: "Apparel", priceRange: [20, 80] },
  electronics: { icon: <Gamepad size={20} />, color: "#10b981", label: "Tech", priceRange: [100, 1500] },
  accessories: { icon: <Glasses size={20} />, color: "#f59e0b", label: "Accessories", priceRange: [15, 100] },
  pants: { icon: <Watch size={20} />, color: "#ef4444", label: "Watches", priceRange: [150, 500] },
};

const TIERS = [
  { name: "Stable", min: 0, decayRate: 1, multiplier: 1, color: "var(--foreground)" },
  { name: "Heating Up", min: 10, decayRate: 2, multiplier: 2, color: "#3b82f6" },
  { name: "On Fire", min: 35, decayRate: 4, multiplier: 5, color: "#f59e0b" },
  { name: "Unstoppable", min: 100, decayRate: 8, multiplier: 10, color: "#ef4444" },
  { name: "Godlike", min: 250, decayRate: 15, multiplier: 25, color: "#8b5cf6" },
];

export default function Home() {
  // --- STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [ratePerMinute, setRatePerMinute] = useState(300); 
  const [audioEnabled, setAudioEnabled] = useState(false); // Default muted
  
  // Metrics State
  const [currentRPM, setCurrentRPM] = useState(0);
  
  // Power Mode State
  const [combo, setCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0); // 0 to 100
  const [currentTierIdx, setCurrentTierIdx] = useState(0); 
  
  const [maxCombo, setMaxCombo] = useState(0);
  const [maxTierIdx, setMaxTierIdx] = useState(0);
  const [showTierUp, setShowTierUp] = useState<{name: string, color: string, timestamp: number} | null>(null);

  // Data State
  const [items, setItems] = useState<Order[]>([]);
  const [moneyParticles, setMoneyParticles] = useState<{id: string, x: number, y: number, text: string, color: string}[]>([]);
  const [chartData, setChartData] = useState<DataPoint[]>(
    Array.from({ length: 40 }, (_, i) => ({ time: `-${40 - i}s`, volume: 0 }))
  );
  
  // Refs for loop management
  const stateRef = useRef({
    isPlaying,
    ratePerMinute,
    combo,
    comboTimer,
    currentVolume: 0,
    audioEnabled,
    currentTierIdx,
    items
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Keep refs synced
  useEffect(() => {
    stateRef.current = { 
      isPlaying, ratePerMinute, combo, comboTimer, 
      currentVolume: stateRef.current.currentVolume, 
      audioEnabled, currentTierIdx, items 
    };
  }, [isPlaying, ratePerMinute, combo, comboTimer, audioEnabled, currentTierIdx, items]);

  // --- AUDIO SYNTHESIS ---
  const playSound = useCallback((type: 'coin' | 'tier_up' | 'break') => {
    if (!stateRef.current.audioEnabled) return;
    
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      
      if (type === 'coin') {
        // Metallic ka-ching / coin sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500 + Math.random() * 500, now);
        osc.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'tier_up') {
        // Glorious fanfare
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1); // C#
        osc.frequency.setValueAtTime(659.25, now + 0.2); // E
        osc.frequency.setValueAtTime(880, now + 0.3); // A
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.setValueAtTime(0.15, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'break') {
        // Dull thud
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }, []);

  // --- LOGIC: COMBO DECAY & TIER EVALUATION ---
  useEffect(() => {
    let lastTime = performance.now();
    let animationFrameId: number;

    const decayLoop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (stateRef.current.isPlaying) {
        if (stateRef.current.comboTimer > 0) {
          const tier = TIERS[stateRef.current.currentTierIdx];
          
          // Decrease timer based on tier decay rate.
          // Higher tiers decay much faster, requiring more orders to sustain.
          // Time delta is used to keep it frame-rate independent.
          const decayAmount = (tier.decayRate * deltaTime) / 16; 
          const newTimer = Math.max(0, stateRef.current.comboTimer - decayAmount);
          
          setComboTimer(newTimer);
          
          if (newTimer === 0) {
            if (stateRef.current.combo > TIERS[1].min) {
              playSound('break');
            }
            setCombo(0);
            setCurrentTierIdx(0);
          }
        }
      }
      animationFrameId = requestAnimationFrame(decayLoop);
    };

    animationFrameId = requestAnimationFrame(decayLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [playSound]);

  // Check tiers
  useEffect(() => {
    let newTierIdx = 0;
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (combo >= TIERS[i].min) {
        newTierIdx = i;
        break;
      }
    }

    if (newTierIdx > currentTierIdx) {
      // Tier Up!
      setCurrentTierIdx(newTierIdx);
      setShowTierUp({
        name: TIERS[newTierIdx].name,
        color: TIERS[newTierIdx].color,
        timestamp: Date.now()
      });
      playSound('tier_up');
      
      if (newTierIdx > maxTierIdx) {
        setMaxTierIdx(newTierIdx);
      }
    } else if (newTierIdx < currentTierIdx) {
      // Combo broke/dropped
      setCurrentTierIdx(newTierIdx);
    }

    if (combo > maxCombo) {
      setMaxCombo(combo);
    }
  }, [combo, currentTierIdx, maxCombo, maxTierIdx, playSound]);

  // --- LOGIC: MAIN SIMULATION LOOP ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const tick = () => {
      if (!stateRef.current.isPlaying) {
        timeoutId = setTimeout(tick, 100);
        return;
      }

      const msPerOrder = 60000 / stateRef.current.ratePerMinute;
      const tickDuration = 50; 
      const chance = tickDuration / msPerOrder;

      let chanceRemaining = chance;
      
      while (chanceRemaining > 0) {
        if (Math.random() < Math.min(1, chanceRemaining)) {
          spawnOrder();
        }
        chanceRemaining -= 1;
      }

      timeoutId = setTimeout(tick, tickDuration);
    };

    timeoutId = setTimeout(tick, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  // --- LOGIC: ITEM MOVEMENT (PHYSICS) ---
  useEffect(() => {
    let lastTime = performance.now();
    let animationFrameId: number;

    const moveLoop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (stateRef.current.isPlaying) {
        setItems(prevItems => {
          return prevItems.map(item => {
            // Float up and drift horizontally
            const speedMultiplier = 1 + (stateRef.current.currentTierIdx * 0.2);
            return {
              ...item,
              y: item.y - (0.2 * speedMultiplier * (deltaTime / 16)), // Move UP (y decreasing towards 0)
              x: item.x + (item.vx * (deltaTime / 16))
            };
          }).filter(item => item.y > -20); // Remove when off top of screen
        });
        
        setMoneyParticles(prev => {
           return prev.map(p => ({
             ...p,
             y: p.y - (0.3 * (deltaTime / 16))
           })).filter(p => p.y > -20);
        });
      }
      animationFrameId = requestAnimationFrame(moveLoop);
    };

    animationFrameId = requestAnimationFrame(moveLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- LOGIC: CHART UPDATER & RPM CALC ---
  useEffect(() => {
    const history: number[] = [];

    const chartInterval = setInterval(() => {
      if (!stateRef.current.isPlaying) return;
      
      const vol = stateRef.current.currentVolume;
      history.push(vol);
      if (history.length > 5) history.shift();
      
      // Calculate current RPM based on a rolling average of the last 5 seconds to smooth it out
      const avgVolPerSec = history.reduce((a, b) => a + b, 0) / history.length;
      setCurrentRPM(Math.round(avgVolPerSec * 60));

      setChartData(prev => {
        const newData = [...prev.slice(1)];
        newData.push({
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
          volume: vol
        });
        return newData;
      });
      stateRef.current.currentVolume = 0;
    }, 1000);

    return () => clearInterval(chartInterval);
  }, []);

  // --- HELPERS ---
  const spawnOrder = () => {
    const categories = Object.keys(CATEGORIES) as Category[];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const config = CATEGORIES[category];
    
    const value = Math.floor(Math.random() * (config.priceRange[1] - config.priceRange[0])) + config.priceRange[0];
    
    // Spawn from the right edge of the chart (representing "now")
    // Let's set spawn point around x: 80% to 90%, and y: bottom to middle
    const x = 85 + (Math.random() * 5 - 2.5); 
    const y = 80 + (Math.random() * 10);
    // Drift leftwards and slightly upwards
    const vx = -0.1 - (Math.random() * 0.2);
    
    const id = Math.random().toString(36).substr(2, 9);
    
    const newOrder: Order = {
      id, value, category, x, y, vx, timestamp: Date.now()
    };

    stateRef.current.currentVolume += 1;
    
    const tier = TIERS[stateRef.current.currentTierIdx];
    
    setCombo(c => c + tier.multiplier);
    setComboTimer(100); // Reset timer to full

    // Add item to float up
    setItems(prev => [...prev.slice(-100), newOrder]); 
    
    // Add money particle occasionally or always
    setMoneyParticles(prev => [...prev.slice(-50), {
      id: `money-${id}`,
      x: x + (Math.random() * 10 - 5),
      y: y,
      text: `+$${value}`,
      color: config.color
    }]);
    
    playSound('coin');
  };

  // --- RENDER HELPERS ---
  const activeTier = TIERS[currentTierIdx];

  return (
    <div className="relative h-screen w-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      
      {/* BACKGROUND / STRUCTURE */}
      <div className="absolute inset-0 z-0 bg-grid-pattern opacity-50" />

      {/* FLOATING ITEMS & PARTICLES LAYER */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        {items.map(item => {
          const config = CATEGORIES[item.category];
          return (
            <motion.div
              key={item.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute flex items-center justify-center"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`, // Use top since y goes from 80 down to 0
                transform: 'translate(-50%, -50%)',
                color: config.color
              }}
            >
              <div className="relative w-12 h-12 bg-card border border-border shadow-lg rounded-xl flex items-center justify-center z-10">
                {config.icon}
              </div>
            </motion.div>
          );
        })}
        
        {moneyParticles.map(p => (
           <motion.div
             key={p.id}
             initial={{ opacity: 0, y: 10, scale: 0.5 }}
             animate={{ opacity: [0, 1, 0], y: -50, scale: 1 }}
             transition={{ duration: 1.5, ease: "easeOut" }}
             className="absolute font-bold font-mono text-lg z-20 drop-shadow-md"
             style={{
               left: `${p.x}%`,
               top: `${p.y}%`,
               color: p.color
             }}
           >
             {p.text}
           </motion.div>
        ))}

        {/* TIER UP ANIMATION OVERLAY */}
        <AnimatePresence>
          {showTierUp && (
            <motion.div
              key={showTierUp.timestamp}
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 1.5], y: [50, 0, 0, -50] }}
              transition={{ duration: 2, times: [0, 0.2, 0.8, 1] }}
              className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
            >
              <div className="text-center">
                <h2 className="text-4xl md:text-7xl font-black uppercase tracking-widest" style={{ color: showTierUp.color, textShadow: `0 0 20px ${showTierUp.color}` }}>
                  {showTierUp.name}
                </h2>
                <p className="text-xl md:text-3xl text-muted-foreground font-bold mt-2 tracking-widest uppercase">
                  Tier Reached!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TOP HEADER - METRICS */}
      <header className="relative z-30 p-6 flex items-start justify-between pointer-events-none">
        <div className="flex gap-8 pointer-events-auto">
          {/* Main Logo/Title */}
          <div className="flex flex-col">
            <h1 className="font-black text-2xl tracking-tighter uppercase flex items-center gap-2">
              <ActivityIcon /> Nexus Retail
            </h1>
            <span className="text-sm text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live Order Stream
            </span>
          </div>

          {/* RPM Metric */}
          <div className="bg-card/80 backdrop-blur-md border border-border shadow-sm rounded-xl p-4 flex flex-col min-w-[160px]">
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Current Velocity</span>
            <div className="flex items-baseline gap-1">
              <span className="font-black text-4xl tabular-nums leading-none">{currentRPM}</span>
              <span className="text-sm text-muted-foreground font-bold">RPM</span>
            </div>
          </div>
          
          {/* Max Stats */}
          <div className="bg-card/80 backdrop-blur-md border border-border shadow-sm rounded-xl p-4 flex flex-col min-w-[160px]">
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
              <Trophy size={14} /> Best Run
            </span>
            <div className="flex flex-col gap-1">
              <div className="font-black text-2xl tabular-nums leading-none flex items-baseline gap-1">
                {maxCombo} <span className="text-sm text-muted-foreground font-bold">PTS</span>
              </div>
              <div className="text-xs font-bold uppercase" style={{ color: TIERS[maxTierIdx]?.color || 'inherit' }}>
                Tier: {TIERS[maxTierIdx]?.name || 'Stable'}
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-4 bg-card/80 backdrop-blur-md border border-border shadow-sm rounded-xl p-3 pointer-events-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={audioEnabled ? "text-primary" : "text-muted-foreground"}
            title="Toggle Audio"
          >
            {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </Button>
          
          <div className="w-px h-8 bg-border" />

          <div className="flex flex-col gap-1.5 w-48 px-2">
            <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider font-bold">
              <span>Sim Rate</span>
              <span className="text-foreground">{ratePerMinute} /min</span>
            </div>
            <Slider 
              value={[ratePerMinute]} 
              min={10} 
              max={5000} 
              step={10}
              onValueChange={(v) => setRatePerMinute(v[0])}
              className="cursor-pointer"
            />
          </div>

          <div className="w-px h-8 bg-border" />

          <Button 
            onClick={() => setIsPlaying(!isPlaying)}
            size="lg"
            className={`w-32 uppercase tracking-widest font-bold transition-all ${isPlaying ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
          >
            {isPlaying ? (
              <><Pause className="mr-2" size={18} /> Pause</>
            ) : (
              <><Play className="mr-2" size={18} /> Start</>
            )}
          </Button>
        </div>
      </header>

      {/* MAIN COMBO CENTER */}
      <div className="relative z-30 flex-1 flex flex-col items-center justify-center pointer-events-none">
        <AnimatePresence mode="popLayout">
          {combo > 0 && (
            <motion.div
              key="combo-display"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, filter: "blur(10px)" }}
              className="flex flex-col items-center"
            >
              {/* Tier Name */}
              <motion.div 
                key={activeTier.name}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-lg md:text-2xl font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2"
                style={{ color: activeTier.color }}
              >
                <Flame className={currentTierIdx >= 2 ? "animate-pulse" : ""} />
                {activeTier.name}
                <Flame className={currentTierIdx >= 2 ? "animate-pulse" : ""} />
              </motion.div>
              
              {/* Combo Number */}
              <motion.div 
                key={combo}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="font-black text-8xl md:text-[12rem] leading-none tracking-tighter drop-shadow-xl"
                style={{ color: activeTier.color }}
              >
                {combo}
              </motion.div>
              
              <div className="text-xl text-muted-foreground font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                Multiplier: {activeTier.multiplier}x
              </div>

              {/* Advanced Combo Bar */}
              <div className="w-[300px] md:w-[500px] h-4 bg-muted rounded-full mt-6 overflow-hidden relative border-2 border-border shadow-inner">
                <motion.div 
                  className="absolute top-0 left-0 bottom-0"
                  style={{ 
                    width: `${comboTimer}%`,
                    backgroundColor: activeTier.color,
                    boxShadow: `0 0 10px ${activeTier.color}`
                  }}
                  transition={{ duration: 0.05, ease: "linear" }} // Fast update for smooth bar
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM CHART AREA */}
      <div className="relative z-20 h-[30vh] w-full mt-auto border-t border-border bg-card/30 backdrop-blur-sm pt-4">
        {/* Spawn Indicator on the right edge */}
        <div className="absolute right-[5%] top-0 bottom-0 w-[2px] bg-primary/20 border-r border-dashed border-primary/50 z-0">
          <div className="absolute top-2 -left-24 text-xs font-mono text-primary uppercase tracking-widest bg-background/80 px-2 py-1 rounded">
            Live Input &rarr;
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 50, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
              itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Line 
              type="monotone" 
              dataKey="volume" 
              stroke="var(--color-primary)" 
              strokeWidth={4}
              dot={false}
              activeDot={{ r: 8, fill: 'var(--color-primary)', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}