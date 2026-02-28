import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";
import { Play, Pause, Settings2, Activity, Zap, Flame, Target } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

// Types
type Order = {
  id: string;
  value: number;
  items: number;
  x: number;
  y: number;
  color: string;
  timestamp: number;
};

type DataPoint = {
  time: string;
  volume: number;
};

// Colors for particles
const COLORS = ["#00ffff", "#ff00ff", "#ffff00", "#00ff00"];

export default function Home() {
  // --- STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [ratePerMinute, setRatePerMinute] = useState(120); // Default: 2 orders/sec
  
  // Power Mode State
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0); // 0 to 100
  const [comboLevel, setComboLevel] = useState(0); // 0: none, 1: mild, 2: intense, 3: extreme

  // Data State
  const [particles, setParticles] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<DataPoint[]>(
    Array.from({ length: 60 }, (_, i) => ({ time: `-${60 - i}s`, volume: 0 }))
  );
  
  // Refs for loop management to avoid dependency hell in intervals
  const stateRef = useRef({
    isPlaying,
    ratePerMinute,
    combo,
    comboTimer,
    currentVolume: 0
  });

  // Keep refs synced
  useEffect(() => {
    stateRef.current = { isPlaying, ratePerMinute, combo, comboTimer, currentVolume: stateRef.current.currentVolume };
  }, [isPlaying, ratePerMinute, combo, comboTimer]);

  // --- LOGIC: COMBO DECAY ---
  useEffect(() => {
    const decayInterval = setInterval(() => {
      if (!stateRef.current.isPlaying) return;
      
      if (stateRef.current.comboTimer > 0) {
        // Decrease timer. Faster decay at higher combos
        const decayAmount = Math.max(1, stateRef.current.combo * 0.05);
        const newTimer = Math.max(0, stateRef.current.comboTimer - decayAmount);
        setComboTimer(newTimer);
        
        if (newTimer === 0) {
          // Combo broken
          setCombo(0);
          setComboLevel(0);
        }
      }
    }, 50);

    return () => clearInterval(decayInterval);
  }, []);

  // --- LOGIC: COMBO LEVEL EVALUATION ---
  useEffect(() => {
    if (combo > maxCombo) setMaxCombo(combo);
    
    if (combo === 0) setComboLevel(0);
    else if (combo < 20) setComboLevel(1);
    else if (combo < 50) setComboLevel(2);
    else setComboLevel(3);
  }, [combo, maxCombo]);

  // --- LOGIC: MAIN SIMULATION LOOP ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const tick = () => {
      if (!stateRef.current.isPlaying) {
        timeoutId = setTimeout(tick, 100);
        return;
      }

      // Calculate chance of order occurring in this tick based on rate
      // Rate is per minute. Tick is roughly 50ms.
      // 60000ms / rate = ms per order
      const msPerOrder = 60000 / stateRef.current.ratePerMinute;
      const tickDuration = 50; // evaluate every 50ms
      const chance = tickDuration / msPerOrder;

      // Can spawn multiple if rate is very high
      let spawned = 0;
      let chanceRemaining = chance;
      
      while (chanceRemaining > 0) {
        if (Math.random() < Math.min(1, chanceRemaining)) {
          spawnOrder();
          spawned++;
        }
        chanceRemaining -= 1;
      }

      timeoutId = setTimeout(tick, tickDuration);
    };

    timeoutId = setTimeout(tick, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  // --- LOGIC: CHART UPDATER ---
  useEffect(() => {
    const chartInterval = setInterval(() => {
      if (!stateRef.current.isPlaying) return;
      
      setChartData(prev => {
        const newData = [...prev.slice(1)];
        newData.push({
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
          volume: stateRef.current.currentVolume
        });
        return newData;
      });
      // Reset volume aggregator for next second
      stateRef.current.currentVolume = 0;
    }, 1000);

    return () => clearInterval(chartInterval);
  }, []);

  // --- HELPERS ---
  const spawnOrder = () => {
    const value = Math.floor(Math.random() * 500) + 10;
    const items = Math.floor(Math.random() * 5) + 1;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      value,
      items,
      x: 10 + Math.random() * 80, // 10% to 90% of screen width
      y: 20 + Math.random() * 50, // 20% to 70% of screen height
      color,
      timestamp: Date.now()
    };

    // Update Aggregates
    stateRef.current.currentVolume += 1;
    
    // Update Combo
    setCombo(c => c + 1);
    setComboTimer(100);

    // Update Visuals
    setParticles(prev => [...prev.slice(-40), newOrder]); // Keep max 40 on screen
    setRecentOrders(prev => [newOrder, ...prev].slice(0, 10)); // Keep last 10 for ticker
  };

  // --- RENDER HELPERS ---
  const getContainerShakeClass = () => {
    if (comboLevel === 1) return "animate-shake-mild";
    if (comboLevel === 2) return "animate-shake-intense";
    if (comboLevel === 3) return "animate-shake-extreme";
    return "";
  };

  const getComboColorClass = () => {
    if (comboLevel === 1) return "text-glow-cyan text-primary";
    if (comboLevel === 2) return "text-glow-magenta text-secondary";
    if (comboLevel === 3) return "text-glow-red text-destructive";
    return "text-muted-foreground";
  };

  return (
    <div className={`relative h-screen w-full bg-background scanlines overflow-hidden transition-all duration-100 ${getContainerShakeClass()}`}>
      
      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px]" />
        {comboLevel >= 2 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] mix-blend-screen" />
        )}
        {comboLevel === 3 && (
          <div className="absolute inset-0 bg-destructive/10 animate-pulse pointer-events-none mix-blend-overlay" />
        )}
      </div>

      {/* PARTICLE LAYER */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0, y: p.y + "%", x: p.x + "%" }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1, 0.8], y: [(p.y)+ "%", (p.y - 15) + "%"] }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute font-mono font-bold"
              style={{ color: p.color, textShadow: `0 0 10px ${p.color}` }}
            >
              +${p.value}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* FOREGROUND UI */}
      <div className="relative z-20 h-full flex flex-col p-6">
        
        {/* HEADER CONTROLS */}
        <header className="flex items-center justify-between glass-panel p-4 rounded-xl border-primary/20 box-glow-cyan">
          <div className="flex items-center gap-4">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
            <div>
              <h1 className="font-display font-bold text-2xl tracking-wider text-glow-cyan text-primary uppercase m-0 leading-none">
                Nexus Ops
              </h1>
              <span className="text-xs text-primary/70 font-mono tracking-widest uppercase">Live Feed // Sector 7</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-2 w-64">
              <div className="flex justify-between text-xs font-mono text-muted-foreground">
                <span className="uppercase flex items-center gap-1"><Settings2 className="w-3 h-3"/> Sim Rate</span>
                <span className="text-primary">{ratePerMinute} RPM</span>
              </div>
              <Slider 
                value={[ratePerMinute]} 
                min={10} 
                max={10000} 
                step={10}
                onValueChange={(v) => setRatePerMinute(v[0])}
                className="cursor-pointer [&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
              />
            </div>

            <Button 
              onClick={() => setIsPlaying(!isPlaying)}
              size="lg"
              className={`font-display tracking-widest transition-all ${isPlaying ? 'bg-destructive hover:bg-destructive/80 text-glow-red box-glow-magenta' : 'bg-primary text-primary-foreground hover:bg-primary/90 box-glow-cyan'}`}
            >
              {isPlaying ? (
                <><Pause className="mr-2" /> Halt Feed</>
              ) : (
                <><Play className="mr-2" /> Initiate</>
              )}
            </Button>
          </div>
        </header>

        {/* MAIN STAGE */}
        <main className="flex-1 flex items-center justify-center relative">
          
          {/* SIDE TICKER */}
          <div className="absolute left-0 top-0 bottom-0 w-64 py-8 pointer-events-none">
            <div className="h-full w-full glass-panel rounded-xl overflow-hidden flex flex-col mask-image-gradient">
              <div className="p-3 border-b border-white/5 font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                 <Target className="w-3 h-3"/> Recent Pings
              </div>
              <div className="flex-1 overflow-hidden p-3 flex flex-col gap-2 relative">
                <AnimatePresence>
                  {recentOrders.map((order, i) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1 - (i * 0.1), x: 0 }}
                      exit={{ opacity: 0 }}
                      className="font-mono text-sm border-l-2 pl-2 flex flex-col gap-1"
                      style={{ borderLeftColor: order.color }}
                    >
                      <div className="flex justify-between items-center text-white/90">
                        <span>ID_{order.id.toUpperCase()}</span>
                        <span style={{ color: order.color }}>${order.value}</span>
                      </div>
                      <div className="text-xs text-white/40">Items: {order.items}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* CENTER COMBO METER */}
          <div className="flex flex-col items-center justify-center relative">
            <AnimatePresence mode="popLayout">
              {combo > 0 && (
                <motion.div
                  key="combo-display"
                  initial={{ scale: 0.5, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
                  className="flex flex-col items-center"
                >
                  <div className="font-mono text-xl tracking-widest uppercase mb-2 flex items-center gap-2 opacity-80">
                    <Zap className={comboLevel >= 2 ? "text-secondary animate-pulse" : "text-primary"} /> 
                    Chain Link 
                    <Zap className={comboLevel >= 2 ? "text-secondary animate-pulse" : "text-primary"} />
                  </div>
                  
                  <motion.div 
                    key={combo} // Force re-animation on every combo change
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 10 }}
                    className={`font-display font-black text-8xl md:text-9xl leading-none ${getComboColorClass()}`}
                  >
                    {combo}x
                  </motion.div>

                  {comboLevel >= 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-12 text-destructive font-display font-bold tracking-widest text-xl text-glow-red flex items-center gap-2"
                    >
                      <Flame className="w-6 h-6 animate-pulse" /> OVERLOAD <Flame className="w-6 h-6 animate-pulse" />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* COMBO TIMER BAR */}
            <div className="w-96 h-3 bg-white/5 rounded-full mt-8 overflow-hidden relative border border-white/10">
              <motion.div 
                className="absolute top-0 left-0 bottom-0 origin-left"
                style={{ 
                  width: `${comboTimer}%`,
                  backgroundColor: comboLevel === 3 ? "var(--color-destructive)" : comboLevel === 2 ? "var(--color-secondary)" : "var(--color-primary)",
                  boxShadow: `0 0 10px ${comboLevel === 3 ? "var(--color-destructive)" : comboLevel === 2 ? "var(--color-secondary)" : "var(--color-primary)"}`
                }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>
          </div>

          {/* MAX COMBO STAT */}
          <div className="absolute right-0 top-0 bottom-0 w-64 py-8 pointer-events-none flex flex-col justify-center">
            <div className="glass-panel p-6 rounded-xl flex flex-col items-center justify-center gap-2 border-secondary/20 text-center">
              <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Peak Resonance</div>
              <div className="font-display text-4xl font-bold text-glow-magenta text-secondary">{maxCombo}x</div>
            </div>
          </div>

        </main>

        {/* BOTTOM GLOBAL CURVE */}
        <footer className="h-[25vh] glass-panel rounded-xl mt-4 p-4 flex flex-col relative overflow-hidden">
           <div className="flex justify-between items-center mb-2 z-10 relative">
             <div className="font-mono text-sm tracking-widest text-primary uppercase">Global Volume Vector</div>
             <div className="font-mono text-xs text-muted-foreground flex gap-4">
                <span>[LIVE]</span>
                <span className="text-primary">{chartData[chartData.length-1].volume} OPS</span>
             </div>
           </div>
           <div className="flex-1 w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}
                  itemStyle={{ color: 'var(--color-primary)' }}
                  labelStyle={{ color: 'var(--color-muted-foreground)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="var(--color-primary)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                  animationDuration={300}
                  isAnimationActive={false} // Disable recharts animation to prevent jitter with fast updates
                />
              </AreaChart>
            </ResponsiveContainer>
           </div>
        </footer>
      </div>
    </div>
  );
}