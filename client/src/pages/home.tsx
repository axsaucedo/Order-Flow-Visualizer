import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, XAxis, Tooltip, YAxis, CartesianGrid } from "recharts";
import { Play, Pause, ShoppingBag, Shirt, Glasses, Watch, Gamepad, Volume2, VolumeX, Flame, Zap, Trophy, DollarSign, Activity, Tag } from "lucide-react";
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
  vx: number; // Velocity X for moving left
  vy: number; // Velocity Y for slight drift
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
  const [audioEnabled, setAudioEnabled] = useState(true);
  
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
  
  const [notifications, setNotifications] = useState<{id: string, text: string, subtext: string, color: string}[]>([]);

  // Data State
  const [items, setItems] = useState<Order[]>([]);
  const [moneyParticles, setMoneyParticles] = useState<{id: string, x: number, y: number, text: string, color: string}[]>([]);
  const [chartParticles, setChartParticles] = useState<{id: string, x: number, y: number, vx: number, vy: number, life: number, color: string}[]>([]);
  
  const initialChartData = Array.from({ length: 50 }, (_, i) => ({ time: `-${50 - i}s`, volume: 0 }));
  const [chartData, setChartData] = useState<DataPoint[]>(initialChartData);
  
  // Chart head estimation for particle spawning
  const [chartHeadY, setChartHeadY] = useState(90); // Percentage from top
  const [maxChartVol, setMaxChartVol] = useState(10);
  
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
    totalRevenue,
    chartHeadY,
    maxChartVol
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Keep refs synced
  useEffect(() => {
    stateRef.current = { 
      isPlaying, ratePerMinute, combo, comboTimer, 
      currentVolume: stateRef.current.currentVolume, 
      audioEnabled, currentTierIdx, items,
      peakRPM, totalOrders, totalRevenue,
      chartHeadY, maxChartVol
    };
  }, [isPlaying, ratePerMinute, combo, comboTimer, audioEnabled, currentTierIdx, items, peakRPM, totalOrders, totalRevenue, chartHeadY, maxChartVol]);

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
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);
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
      
      // Also spawn chart oozing particles continuously based on tier
      if (Math.random() < (0.2 + stateRef.current.currentTierIdx * 0.1)) {
        spawnChartParticle();
      }

      timeoutId = setTimeout(tick, tickDuration);
    };

    timeoutId = setTimeout(tick, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  // --- LOGIC: ITEM & PARTICLE MOVEMENT (PHYSICS) ---
  useEffect(() => {
    let lastTime = performance.now();
    let animationFrameId: number;

    const moveLoop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (stateRef.current.isPlaying) {
        // Items flow right to left
        setItems(prevItems => {
          return prevItems.map(item => {
            const speedMultiplier = 1 + (stateRef.current.currentTierIdx * 0.05);
            return {
              ...item,
              x: item.x + (item.vx * speedMultiplier * (deltaTime / 16)), // Move Left
              y: item.y + (item.vy * (deltaTime / 16)) // Slight vertical drift
            };
          }).filter(item => item.x > -10); // Remove when off left screen
        });
        
        // Money particles float up and fade
        setMoneyParticles(prev => {
           return prev.map(p => ({
             ...p,
             y: p.y - (0.4 * (deltaTime / 16)),
             x: p.x - (0.1 * (deltaTime / 16)) // Slight drift left to match items
           })).filter(p => p.y > -10);
        });
        
        // Chart particles ooze out and fall/scatter
        setChartParticles(prev => {
           return prev.map(p => {
             // Gravity and drag
             return {
               ...p,
               x: p.x + (p.vx * (deltaTime / 16)),
               y: p.y + (p.vy * (deltaTime / 16)),
               vy: p.vy + 0.02, // gravity
               life: p.life - (0.01 * (deltaTime / 16))
             };
           }).filter(p => p.life > 0 && p.y < 110);
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
        
        // Update max chart vol for scaling
        const maxV = Math.max(10, ...newData.map(d => d.volume));
        setMaxChartVol(maxV);
        
        // Estimate Y position of the chart head (95% X)
        // Y goes from 0 (top) to 100 (bottom) within the container. 
        // We invert the volume ratio to get the Y position.
        const paddingOffset = 10; // Chart doesn't hit absolute bottom/top
        const ratio = Math.min(1, vol / maxV);
        const estimatedY = 90 - (ratio * 60); // Roughly 30% to 90%
        setChartHeadY(estimatedY);
        
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
    
    // Spawn from the right edge (X: 95%) and at a random height (Y: 15% to 85%)
    const x = 95; 
    const y = 15 + (Math.random() * 70);
    
    // Items flow strictly right-to-left now
    const vx = -0.3 - (Math.random() * 0.4); 
    const vy = (Math.random() - 0.5) * 0.2; // Slight vertical drift
    
    const id = Math.random().toString(36).substr(2, 9);
    
    const newOrder: Order = {
      id, value, category, x, y, vx, vy, timestamp: Date.now()
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
      x: x,
      y: y - 5,
      text: `+$${value}`,
      color: config.color
    }]);
    
    // Throttle sound at very high rates
    if (Math.random() > 0.5 || stateRef.current.ratePerMinute < 500) {
      playSound('coin');
    }
  };
  
  const spawnChartParticle = () => {
    const tierColor = TIERS[stateRef.current.currentTierIdx].color;
    
    // Add oozing particle at the chart head (Live Input line)
    // We add slight variations to the exact coordinate for an area effect
    const x = 95 + (Math.random() * 2 - 1);
    const y = stateRef.current.chartHeadY + (Math.random() * 5 - 2.5);
    
    const vx = -0.1 - (Math.random() * 0.3); // Ooze left
    const vy = (Math.random() - 0.5) * 0.5; // Spread out vertically
    
    setChartParticles(prev => [...prev.slice(-100), {
      id: Math.random().toString(36).substr(2, 9),
      x, y, vx, vy, life: 1, color: tierColor
    }]);
  };

  // --- RENDER HELPERS ---
  const activeTier = TIERS[currentTierIdx];

  return (
    <div className="relative h-screen w-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      
      {/* BACKGROUND GRID */}
      <div className="absolute inset-0 z-0 bg-grid-pattern opacity-50 pointer-events-none" />

      {/* FULL SCREEN BACKGROUND CHART */}
      <div className="absolute top-0 bottom-0 left-0 w-[95%] z-0 pt-[20vh] pointer-events-none opacity-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: -10 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['dataMin', 'dataMax + 2']} />
            <Line 
              type="monotone" 
              dataKey="volume" 
              stroke={activeTier.color !== 'var(--foreground)' ? activeTier.color : 'var(--color-primary)'} 
              strokeWidth={6}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* FLOATING ITEMS & PARTICLES LAYER (Above chart, behind UI) */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        
        {/* Chart Ooze Particles */}
        {chartParticles.map(p => (
           <div
             key={p.id}
             className="absolute rounded-full pointer-events-none mix-blend-screen"
             style={{
               left: `${p.x}%`,
               top: `${p.y}%`,
               width: `${p.life * 10}px`,
               height: `${p.life * 10}px`,
               backgroundColor: p.color,
               opacity: p.life * 0.6,
               boxShadow: `0 0 10px ${p.color}`,
               transform: 'translate(-50%, -50%)'
             }}
           />
        ))}

        {/* Right-to-Left Floating Items */}
        <AnimatePresence>
          {items.map(item => {
            const config = CATEGORIES[item.category];
            // Calculate opacity based on X position to fade out smoothly as it reaches the left
            const fadeOpacity = Math.min(1, item.x / 20); 
            
            return (
              <motion.div
                key={item.id}
                initial={{ scale: 0, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: fadeOpacity, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute flex items-center justify-center backdrop-blur-md rounded-2xl shadow-xl border p-4"
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`, 
                  transform: 'translate(-50%, -50%)',
                  color: config.color,
                  borderColor: `${config.color}50`,
                  backgroundColor: 'var(--color-card)',
                  boxShadow: `0 8px 32px ${config.color}20`
                }}
              >
                {config.icon}
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Money Texts */}
        {moneyParticles.map(p => (
           <motion.div
             key={p.id}
             initial={{ opacity: 0, y: 10, scale: 0.5 }}
             animate={{ opacity: [0, 1, 0], y: -50, scale: 1.2 }}
             transition={{ duration: 1.5, ease: "easeOut" }}
             className="absolute font-black font-mono text-2xl z-20 drop-shadow-lg"
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
        <div className="absolute top-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50">
          <AnimatePresence>
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="bg-card/90 backdrop-blur-xl border border-border shadow-2xl rounded-2xl px-8 py-4 flex flex-col items-center min-w-[300px]"
                style={{ borderBottomColor: notif.color, borderBottomWidth: 4 }}
              >
                <div className="font-black text-2xl tracking-widest uppercase text-center" style={{ color: notif.color, textShadow: `0 0 15px ${notif.color}40` }}>
                  {notif.text}
                </div>
                <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-center mt-1">
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
        <div className="flex flex-col bg-card/60 backdrop-blur-xl p-4 rounded-2xl border border-border shadow-sm pointer-events-auto">
          <h1 className="font-black text-3xl tracking-tighter uppercase flex items-center gap-3">
            <Tag className="text-primary" size={28} /> Cyberweek Panel
          </h1>
          <span className="text-sm text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live Order Stream
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4 bg-card/80 backdrop-blur-xl border border-border shadow-lg rounded-2xl p-3 pointer-events-auto">
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

      {/* SIDE PANELS (All placed on the left) */}
      <div className="relative z-30 flex-1 flex flex-col justify-start gap-5 p-6 pointer-events-none mt-4 w-96 max-w-sm">
        
        {/* TOP LEFT: GLOBAL METRICS */}
        <div className="flex flex-col gap-4 pointer-events-auto">
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
        </div>

        {/* MIDDLE LEFT: ACTIVE COMBO */}
        <AnimatePresence mode="popLayout">
          {combo > 0 && (
            <motion.div
              key="combo-sidebar"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="bg-card/80 backdrop-blur-xl border border-border shadow-2xl rounded-3xl p-6 flex flex-col items-start relative overflow-hidden pointer-events-auto"
            >
              <div className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-500" style={{ backgroundColor: activeTier.color }} />
              
              <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Current Streak
              </div>
              
              <motion.div 
                key={combo}
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                className="font-black text-[5rem] leading-[0.9] tracking-tighter mb-2 transition-colors duration-500 drop-shadow-md"
                style={{ color: activeTier.color }}
              >
                {combo}<span className="text-3xl text-muted-foreground ml-1 font-bold">x</span>
              </motion.div>

              <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-sm mb-6 transition-colors duration-500" style={{ color: activeTier.color }}>
                <Flame size={16} className={currentTierIdx >= 2 ? "animate-pulse" : ""} /> 
                {activeTier.name} 
                <span className="opacity-70 ml-1">({activeTier.multiplier}x)</span>
              </div>

              <div className="w-full h-3 bg-muted/80 rounded-full overflow-hidden relative shadow-inner border border-border/50">
                <motion.div 
                  className="absolute top-0 left-0 bottom-0"
                  style={{ 
                    width: `${comboTimer}%`,
                    backgroundColor: activeTier.color,
                    boxShadow: `0 0 10px ${activeTier.color}80`
                  }}
                  transition={{ duration: 0.05, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM LEFT: SESSION PEAKS */}
        <div className="bg-card/80 backdrop-blur-xl border border-border shadow-xl rounded-2xl p-5 mt-auto mb-12 pointer-events-auto">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Trophy size={14} /> Session Peaks
          </h3>
          
          <div className="flex justify-between items-end gap-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Max Velocity</div>
              <div className="font-black text-2xl">{peakRPM} <span className="text-sm font-bold text-muted-foreground">RPM</span></div>
            </div>
            
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Best Streak</div>
              <div className="font-black text-2xl flex items-baseline gap-2 justify-end">
                {maxCombo} <span className="text-sm font-bold text-muted-foreground">x</span>
              </div>
              {maxTierIdx > 0 && (
                <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: TIERS[maxTierIdx].color }}>
                  {TIERS[maxTierIdx].name}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* LIVE INPUT LINE (Right edge) */}
      <div className="absolute right-[5%] top-[10%] bottom-[10%] w-[2px] pointer-events-none z-0 overflow-visible">
        {/* The dotted line */}
        <div className="absolute inset-0 border-r border-dashed border-primary/50" />
        
        {/* The glowing "Head" of the chart */}
        <motion.div 
          className="absolute w-6 h-6 rounded-full -left-[11px] bg-primary blur-md pointer-events-none transition-all duration-1000 ease-in-out"
          style={{ 
            top: `${chartHeadY}%`,
            backgroundColor: activeTier.color !== 'var(--foreground)' ? activeTier.color : 'var(--color-primary)'
          }}
        />
        
        <div className="absolute top-0 -left-28 text-[10px] font-bold text-primary uppercase tracking-widest bg-background/80 px-2 py-1 rounded border border-primary/20">
          Live Input &rarr;
        </div>
      </div>
      
    </div>
  );
}

function MetricCard({ title, value, suffix, icon, glow, small }: { title: string, value: string | number, suffix?: string, icon?: React.ReactNode, glow?: string, small?: boolean }) {
  return (
    <div className={`bg-card/80 backdrop-blur-xl border border-border shadow-xl rounded-2xl ${small ? 'p-4' : 'p-6'} flex flex-col relative overflow-hidden`}>
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