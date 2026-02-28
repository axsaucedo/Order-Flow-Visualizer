import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, XAxis, Tooltip, YAxis, CartesianGrid } from "recharts";
import { Play, Pause, ShoppingBag, Shirt, Glasses, Watch, Gamepad, Volume2, VolumeX, Flame, Zap, Trophy, DollarSign, Activity, TrendingUp, BarChart3, Tag } from "lucide-react";
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

// Cyberweek Categories Configuration
const CATEGORIES: Record<Category, { icon: React.ReactNode, color: string, label: string, priceRange: [number, number] }> = {
  shoes: { icon: <ShoppingBag size={24} />, color: "#3b82f6", label: "Footwear", priceRange: [50, 250] },
  shirts: { icon: <Shirt size={24} />, color: "#8b5cf6", label: "Apparel", priceRange: [20, 80] },
  electronics: { icon: <Gamepad size={24} />, color: "#10b981", label: "Tech", priceRange: [100, 1500] },
  accessories: { icon: <Glasses size={24} />, color: "#f59e0b", label: "Accessories", priceRange: [15, 100] },
  pants: { icon: <Watch size={24} />, color: "#ef4444", label: "Watches", priceRange: [150, 500] },
};

// Expanded Tiers for a long-running event
const TIERS = [
  { name: "Warming Up", min: 0, decayRate: 0.5, multiplier: 1, color: "var(--foreground)" },
  { name: "Getting Busy", min: 10, decayRate: 1, multiplier: 2, color: "#3b82f6" },
  { name: "Rush Hour", min: 50, decayRate: 2, multiplier: 3, color: "#0ea5e9" },
  { name: "Surge", min: 100, decayRate: 4, multiplier: 5, color: "#10b981" },
  { name: "Cyber Flash", min: 250, decayRate: 8, multiplier: 10, color: "#eab308" },
  { name: "On Fire", min: 500, decayRate: 15, multiplier: 15, color: "#f97316" },
  { name: "Unstoppable", min: 1000, decayRate: 25, multiplier: 25, color: "#ef4444" },
  { name: "Godlike", min: 2500, decayRate: 40, multiplier: 50, color: "#d946ef" },
  { name: "Retail Singularity", min: 5000, decayRate: 60, multiplier: 100, color: "#8b5cf6" },
  { name: "Apex", min: 10000, decayRate: 100, multiplier: 250, color: "#ec4899" },
];

export default function Home() {
  // --- STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [ratePerMinute, setRatePerMinute] = useState(300); 
  const [audioEnabled, setAudioEnabled] = useState(false); // Default muted
  
  // Metrics State
  const [currentRPM, setCurrentRPM] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [peakRPM, setPeakRPM] = useState(0);
  
  // Power Mode State
  const [combo, setCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0); // 0 to 100
  const [currentTierIdx, setCurrentTierIdx] = useState(0); 
  
  const [maxCombo, setMaxCombo] = useState(0);
  const [maxTierIdx, setMaxTierIdx] = useState(0);
  
  // Array of active milestones/notifications to prevent overlapping blocks
  const [notifications, setNotifications] = useState<{id: string, text: string, subtext: string, color: string}[]>([]);

  // Data State
  const [items, setItems] = useState<Order[]>([]);
  const [moneyParticles, setMoneyParticles] = useState<{id: string, x: number, y: number, text: string, color: string}[]>([]);
  const [chartData, setChartData] = useState<DataPoint[]>(
    Array.from({ length: 50 }, (_, i) => ({ time: `-${50 - i}s`, volume: 0 }))
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
    items,
    peakRPM,
    totalOrders,
    totalRevenue
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Keep refs synced
  useEffect(() => {
    stateRef.current = { 
      isPlaying, ratePerMinute, combo, comboTimer, 
      currentVolume: stateRef.current.currentVolume, 
      audioEnabled, currentTierIdx, items,
      peakRPM, totalOrders, totalRevenue
    };
  }, [isPlaying, ratePerMinute, combo, comboTimer, audioEnabled, currentTierIdx, items, peakRPM, totalOrders, totalRevenue]);

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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500 + Math.random() * 500, now);
        osc.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'tier_up') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1); // C#
        osc.frequency.setValueAtTime(659.25, now + 0.2); // E
        osc.frequency.setValueAtTime(880, now + 0.3); // A
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.setValueAtTime(0.1, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'break') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }, []);

  const addNotification = useCallback((text: string, subtext: string, color: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev.slice(-4), { id, text, subtext, color }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
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
          
          const decayAmount = (tier.decayRate * deltaTime) / 16; 
          const newTimer = Math.max(0, stateRef.current.comboTimer - decayAmount);
          
          setComboTimer(newTimer);
          
          if (newTimer === 0) {
            if (stateRef.current.combo > TIERS[1].min) {
              playSound('break');
              addNotification("Streak Lost", `Ended at ${stateRef.current.combo}x`, "var(--color-muted-foreground)");
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
  }, [playSound, addNotification]);

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
      setCurrentTierIdx(newTierIdx);
      if (newTierIdx > 0) {
        addNotification("Tier Up!", TIERS[newTierIdx].name, TIERS[newTierIdx].color);
        playSound('tier_up');
      }
      
      if (newTierIdx > maxTierIdx) {
        setMaxTierIdx(newTierIdx);
      }
    } else if (newTierIdx < currentTierIdx) {
      // Combo broke/dropped is handled by the timer reaching 0. 
      setCurrentTierIdx(newTierIdx);
    }

    if (combo > maxCombo) {
      setMaxCombo(combo);
    }
  }, [combo, currentTierIdx, maxCombo, maxTierIdx, playSound, addNotification]);

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
            const speedMultiplier = 1 + (stateRef.current.currentTierIdx * 0.1);
            return {
              ...item,
              y: item.y - (0.3 * speedMultiplier * (deltaTime / 16)), // Move UP
              x: item.x + (item.vx * (deltaTime / 16))
            };
          }).filter(item => item.y > -10); // Remove when off top of screen
        });
        
        setMoneyParticles(prev => {
           return prev.map(p => ({
             ...p,
             y: p.y - (0.4 * (deltaTime / 16))
           })).filter(p => p.y > -10);
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
      
      const avgVolPerSec = history.reduce((a, b) => a + b, 0) / history.length;
      const newRPM = Math.round(avgVolPerSec * 60);
      setCurrentRPM(newRPM);
      
      if (newRPM > stateRef.current.peakRPM) {
        setPeakRPM(newRPM);
      }

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
    
    // Spawn from the right edge, spreading out.
    // X goes from ~80% to 95%, Y goes from 60% to 90% (bottom part of the chart)
    const x = 85 + (Math.random() * 10 - 5); 
    const y = 70 + (Math.random() * 20);
    const vx = -0.1 - (Math.random() * 0.3); // Drift left
    
    const id = Math.random().toString(36).substr(2, 9);
    
    const newOrder: Order = {
      id, value, category, x, y, vx, timestamp: Date.now()
    };

    stateRef.current.currentVolume += 1;
    
    const tier = TIERS[stateRef.current.currentTierIdx];
    
    setCombo(c => c + tier.multiplier);
    setComboTimer(100); 
    
    // Global metrics
    setTotalOrders(o => o + 1);
    setTotalRevenue(r => r + value);

    // Limit on-screen elements to prevent lag
    setItems(prev => [...prev.slice(-60), newOrder]); 
    setMoneyParticles(prev => [...prev.slice(-40), {
      id: `money-${id}`,
      x: x + (Math.random() * 6 - 3),
      y: y - 5, // slightly above the icon
      text: `+$${value}`,
      color: config.color
    }]);
    
    // Throttle sound at very high rates
    if (Math.random() > 0.5 || stateRef.current.ratePerMinute < 500) {
      playSound('coin');
    }
  };

  // --- RENDER HELPERS ---
  const activeTier = TIERS[currentTierIdx];

  return (
    <div className="relative h-screen w-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      
      {/* BACKGROUND GRID */}
      <div className="absolute inset-0 z-0 bg-grid-pattern opacity-50 pointer-events-none" />

      {/* FULL SCREEN BACKGROUND CHART */}
      <div className="absolute inset-0 z-0 pt-[20vh] pointer-events-none opacity-30">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: -10 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['dataMin', 'dataMax + 10']} />
            <Line 
              type="monotone" 
              dataKey="volume" 
              stroke="var(--color-primary)" 
              strokeWidth={5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* FLOATING ITEMS & PARTICLES LAYER (Above chart, behind UI) */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {items.map(item => {
            const config = CATEGORIES[item.category];
            return (
              <motion.div
                key={item.id}
                initial={{ scale: 0, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute flex items-center justify-center backdrop-blur-md rounded-xl shadow-lg border p-3"
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`, 
                  transform: 'translate(-50%, -50%)',
                  color: config.color,
                  borderColor: `${config.color}40`,
                  backgroundColor: 'var(--color-card)',
                }}
              >
                {config.icon}
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {moneyParticles.map(p => (
           <motion.div
             key={p.id}
             initial={{ opacity: 0, y: 10, scale: 0.5 }}
             animate={{ opacity: [0, 1, 0], y: -80, scale: 1.2 }}
             transition={{ duration: 1.5, ease: "easeOut" }}
             className="absolute font-bold font-mono text-xl z-20 drop-shadow-md"
             style={{
               left: `${p.x}%`,
               top: `${p.y}%`,
               color: p.color
             }}
           >
             {p.text}
           </motion.div>
        ))}

        {/* NOTIFICATIONS FEED (Top Center) */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50">
          <AnimatePresence>
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="bg-card/90 backdrop-blur-xl border border-border shadow-xl rounded-2xl px-6 py-3 flex flex-col items-center"
                style={{ borderBottomColor: notif.color, borderBottomWidth: 3 }}
              >
                <div className="font-black text-xl tracking-widest uppercase" style={{ color: notif.color }}>
                  {notif.text}
                </div>
                <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  {notif.subtext}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* TOP HEADER */}
      <header className="relative z-30 p-6 flex items-start justify-between pointer-events-none">
        {/* Left Branding */}
        <div className="flex flex-col bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm pointer-events-auto">
          <h1 className="font-black text-3xl tracking-tighter uppercase flex items-center gap-3">
            <Tag className="text-primary" size={28} /> Cyberweek Panel
          </h1>
          <span className="text-sm text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live Order Stream
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4 bg-card/80 backdrop-blur-md border border-border shadow-sm rounded-2xl p-3 pointer-events-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={audioEnabled ? "text-primary" : "text-muted-foreground"}
            title="Toggle Audio"
          >
            {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </Button>
          
          <div className="w-px h-10 bg-border" />

          <div className="flex flex-col gap-2 w-56 px-4">
            <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider font-bold">
              <span>Simulation Rate</span>
              <span className="text-foreground">{ratePerMinute} RPM</span>
            </div>
            <Slider 
              value={[ratePerMinute]} 
              min={10} 
              max={10000} 
              step={50}
              onValueChange={(v) => setRatePerMinute(v[0])}
              className="cursor-pointer"
            />
          </div>

          <div className="w-px h-10 bg-border" />

          <Button 
            onClick={() => setIsPlaying(!isPlaying)}
            size="lg"
            className={`w-36 h-12 text-lg uppercase tracking-widest font-black transition-all ${isPlaying ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
          >
            {isPlaying ? (
              <><Pause className="mr-2" size={20} /> Pause</>
            ) : (
              <><Play className="mr-2" size={20} /> Start</>
            )}
          </Button>
        </div>
      </header>

      {/* SIDE PANELS (Separated from Center) */}
      <div className="relative z-30 flex-1 flex justify-between p-6 pointer-events-none mt-12">
        
        {/* LEFT PANEL: ACTIVE COMBO */}
        <div className="w-80 flex flex-col justify-start">
          <AnimatePresence mode="popLayout">
            {combo > 0 && (
              <motion.div
                key="combo-sidebar"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="bg-card/70 backdrop-blur-xl border border-border shadow-2xl rounded-3xl p-6 flex flex-col items-start relative overflow-hidden"
              >
                {/* Background glow for tier */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundColor: activeTier.color }} />
                
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                  Current Streak
                </div>
                
                <motion.div 
                  key={combo}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  className="font-black text-7xl tracking-tighter leading-none mb-2"
                  style={{ color: activeTier.color }}
                >
                  {combo}<span className="text-3xl text-muted-foreground ml-1">x</span>
                </motion.div>

                <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-sm mb-6" style={{ color: activeTier.color }}>
                  <Flame size={16} /> {activeTier.name} ({activeTier.multiplier}x)
                </div>

                {/* Combo Timer Bar */}
                <div className="w-full h-3 bg-muted/50 rounded-full overflow-hidden relative shadow-inner">
                  <motion.div 
                    className="absolute top-0 left-0 bottom-0"
                    style={{ 
                      width: `${comboTimer}%`,
                      backgroundColor: activeTier.color,
                    }}
                    transition={{ duration: 0.05, ease: "linear" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT PANEL: GLOBAL METRICS */}
        <div className="w-80 flex flex-col gap-4 pointer-events-auto">
          
          <MetricCard 
            title="Real-Time Velocity" 
            value={currentRPM} 
            suffix="RPM" 
            icon={<Activity className="text-primary" />} 
            glow="var(--color-primary)"
          />

          <div className="grid grid-cols-2 gap-4">
            <MetricCard 
              title="Orders" 
              value={totalOrders.toLocaleString()} 
              icon={<ShoppingBag className="text-muted-foreground" size={16} />} 
              small
            />
            <MetricCard 
              title="Revenue" 
              value={`$${(totalRevenue / 1000).toFixed(1)}k`} 
              icon={<DollarSign className="text-muted-foreground" size={16} />} 
              small
            />
          </div>

          <div className="bg-card/70 backdrop-blur-xl border border-border shadow-xl rounded-2xl p-5 mt-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <Trophy size={14} /> Session Peaks
            </h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Max Velocity</div>
                <div className="font-black text-2xl">{peakRPM} <span className="text-sm font-bold text-muted-foreground">RPM</span></div>
              </div>
              
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Best Streak</div>
                <div className="font-black text-2xl flex items-baseline gap-2">
                  {maxCombo} <span className="text-sm font-bold text-muted-foreground">x</span>
                </div>
                {maxTierIdx > 0 && (
                  <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: TIERS[maxTierIdx].color }}>
                    Tier: {TIERS[maxTierIdx].name}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Spawn Indicator on the right edge */}
      <div className="absolute right-[5%] bottom-[10%] h-[50vh] w-[2px] bg-primary/20 border-r border-dashed border-primary/50 pointer-events-none z-0">
        <div className="absolute top-1/2 -translate-y-1/2 -left-28 text-[10px] font-bold text-primary uppercase tracking-widest bg-background/80 px-2 py-1 rounded border border-primary/20">
          Live Input &rarr;
        </div>
      </div>
      
    </div>
  );
}

// Sub-component for clean metric cards
function MetricCard({ title, value, suffix, icon, glow, small }: { title: string, value: string | number, suffix?: string, icon?: React.ReactNode, glow?: string, small?: boolean }) {
  return (
    <div className={`bg-card/70 backdrop-blur-xl border border-border shadow-xl rounded-2xl ${small ? 'p-4' : 'p-6'} flex flex-col relative overflow-hidden`}>
      {glow && <div className="absolute top-0 right-0 w-32 h-32 opacity-10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ backgroundColor: glow }} />}
      
      <div className={`font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ${small ? 'text-[10px] mb-2' : 'text-xs mb-3'}`}>
        {icon} {title}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-black tracking-tight ${small ? 'text-2xl' : 'text-5xl'}`}>{value}</span>
        {suffix && <span className="text-sm font-bold text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </div>
  );
}