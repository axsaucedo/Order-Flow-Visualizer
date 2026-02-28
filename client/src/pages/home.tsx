import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";
import { Play, Pause, Settings2, ShoppingBag, Shirt, Glasses, Watch, Gamepad, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

// Types
type Category = 'shoes' | 'shirts' | 'electronics' | 'accessories' | 'pants';

type Order = {
  id: string;
  value: number;
  category: Category;
  x: number;
  y: number; // 0 to 100, where 0 is bottom and 100 is top
  timestamp: number;
};

type DataPoint = {
  time: string;
  volume: number;
};

// Retail Categories Configuration
const CATEGORIES: Record<Category, { icon: React.ReactNode, color: string, label: string, priceRange: [number, number] }> = {
  shoes: { icon: <ShoppingBag size={18} />, color: "hsl(var(--chart-1))", label: "Footwear", priceRange: [50, 250] },
  shirts: { icon: <Shirt size={18} />, color: "hsl(var(--chart-2))", label: "Apparel", priceRange: [20, 80] },
  electronics: { icon: <Gamepad size={18} />, color: "hsl(var(--chart-3))", label: "Tech", priceRange: [100, 1500] },
  accessories: { icon: <Glasses size={18} />, color: "hsl(var(--chart-4))", label: "Accessories", priceRange: [15, 100] },
  pants: { icon: <Watch size={18} />, color: "hsl(var(--chart-5))", label: "Watches", priceRange: [150, 500] },
};

export default function Home() {
  // --- STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [ratePerMinute, setRatePerMinute] = useState(300); 
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // Power Mode State
  const [combo, setCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0); // 0 to 100
  const [comboLevel, setComboLevel] = useState(0); 

  // Data State
  const [items, setItems] = useState<Order[]>([]);
  const [explosions, setExplosions] = useState<{id: string, x: number, y: number, color: string}[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  
  const [chartData, setChartData] = useState<DataPoint[]>(
    Array.from({ length: 60 }, (_, i) => ({ time: `-${60 - i}s`, volume: 0 }))
  );
  
  // Refs for loop management
  const stateRef = useRef({
    isPlaying,
    ratePerMinute,
    combo,
    comboTimer,
    currentVolume: 0,
    audioEnabled
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Keep refs synced
  useEffect(() => {
    stateRef.current = { isPlaying, ratePerMinute, combo, comboTimer, currentVolume: stateRef.current.currentVolume, audioEnabled };
  }, [isPlaying, ratePerMinute, combo, comboTimer, audioEnabled]);

  // --- AUDIO SYNTHESIS ---
  const playSound = useCallback((type: 'spawn' | 'combo' | 'break') => {
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
      
      if (type === 'spawn') {
        // Soft pop for order
        osc.type = 'sine';
        const freq = 400 + Math.random() * 400; // Randomize slightly
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.1);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'combo') {
        // Ascending tone for combo milestone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.2);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'break') {
        // Descending dull tone for combo break
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }, []);

  // --- LOGIC: COMBO DECAY ---
  useEffect(() => {
    const decayInterval = setInterval(() => {
      if (!stateRef.current.isPlaying) return;
      
      if (stateRef.current.comboTimer > 0) {
        const decayAmount = Math.max(1, stateRef.current.combo * 0.02);
        const newTimer = Math.max(0, stateRef.current.comboTimer - decayAmount);
        setComboTimer(newTimer);
        
        if (newTimer === 0 && stateRef.current.combo > 5) {
          playSound('break');
          setCombo(0);
          setComboLevel(0);
        } else if (newTimer === 0) {
           setCombo(0);
           setComboLevel(0);
        }
      }
    }, 50);

    return () => clearInterval(decayInterval);
  }, [playSound]);

  // --- LOGIC: COMBO LEVEL EVALUATION ---
  useEffect(() => {
    if (combo === 0) setComboLevel(0);
    else if (combo < 20) setComboLevel(1);
    else if (combo < 100) setComboLevel(2);
    else setComboLevel(3);

    if (combo > 0 && combo % 50 === 0) {
      playSound('combo');
    }
  }, [combo, playSound]);

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

  // --- LOGIC: ITEM MOVEMENT ---
  useEffect(() => {
    const moveInterval = setInterval(() => {
      if (!stateRef.current.isPlaying) return;
      
      setItems(prevItems => {
        return prevItems.map(item => ({
          ...item,
          y: item.y + (1 + (stateRef.current.comboLevel * 0.5)) // move up faster with higher combos
        })).filter(item => item.y < 120); // remove when off screen
      });
    }, 50);

    return () => clearInterval(moveInterval);
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
    const x = 5 + Math.random() * 90; // spawn horizontally within screen
    const y = -10; // Start slightly below screen
    
    const id = Math.random().toString(36).substr(2, 9);
    
    const newOrder: Order = {
      id,
      value,
      category,
      x,
      y,
      timestamp: Date.now()
    };

    stateRef.current.currentVolume += 1;
    setCombo(c => c + 1);
    setComboTimer(100);

    setItems(prev => [...prev.slice(-150), newOrder]); // Keep max 150 items
    setRecentOrders(prev => [newOrder, ...prev].slice(0, 12));
    
    // Add explosion at bottom chart line roughly
    setExplosions(prev => [...prev.slice(-20), { id, x, y: 10, color: config.color }]);
    
    playSound('spawn');
  };

  // --- RENDER HELPERS ---
  const getComboShakeClass = () => {
    if (comboLevel === 1) return "animate-shake-mild";
    if (comboLevel >= 2) return "animate-shake-intense";
    return "";
  };

  return (
    <div className="relative h-screen w-full bg-background bg-grid-pattern overflow-hidden text-foreground flex flex-col font-mono">
      
      {/* FULL SCREEN BACKGROUND CHART */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none mt-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={1}/>
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="stepAfter" 
              dataKey="volume" 
              stroke="var(--color-primary)" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorVolume)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* EXPLOSIONS LAYER */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {explosions.map(exp => (
          <div
            key={`exp-${exp.id}`}
            className="explosion-ring"
            style={{
              left: `${exp.x}%`,
              bottom: `${exp.y}%`,
              width: '40px',
              height: '40px',
              marginLeft: '-20px',
              marginBottom: '-20px',
              borderColor: exp.color,
              boxShadow: `0 0 10px ${exp.color}`
            }}
          />
        ))}
      </div>

      {/* FLOATING ITEMS LAYER */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {items.map(item => {
          const config = CATEGORIES[item.category];
          return (
            <div
              key={item.id}
              className="absolute flex flex-col items-center justify-center transition-all duration-75 ease-linear"
              style={{
                left: `${item.x}%`,
                bottom: `${item.y}%`,
                transform: 'translate(-50%, 50%)',
                color: config.color
              }}
            >
              <div className="p-2 rounded-full bg-background/80 border shadow-sm backdrop-blur-sm" style={{ borderColor: config.color }}>
                {config.icon}
              </div>
              <div className="text-xs font-bold mt-1 px-1 bg-background/50 rounded">
                ${item.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOREGROUND UI */}
      <div className="relative z-30 h-full flex flex-col p-6 pointer-events-none">
        
        {/* HEADER CONTROLS */}
        <header className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-4 glass-panel p-3 rounded-xl px-5">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight uppercase m-0 leading-none">
                Retail_Flow
              </h1>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Global Live Feed</span>
            </div>
          </div>

          <div className="flex items-center gap-6 glass-panel p-3 rounded-xl px-6">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={audioEnabled ? "text-primary" : "text-muted-foreground"}
            >
              {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </Button>
            
            <div className="w-px h-8 bg-border" />

            <div className="flex flex-col gap-1.5 w-48">
              <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider">
                <span>Sim Rate</span>
                <span className="text-foreground font-medium">{ratePerMinute} RPM</span>
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
              className={`w-32 uppercase tracking-widest font-bold transition-all ${isPlaying ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
            >
              {isPlaying ? (
                <><Pause className="mr-2" size={16} /> Pause</>
              ) : (
                <><Play className="mr-2" size={16} /> Start</>
              )}
            </Button>
          </div>
        </header>

        {/* MAIN STAGE */}
        <main className="flex-1 flex relative">
          
          {/* SIDE TICKER */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 pointer-events-auto">
            <div className="glass-panel rounded-xl flex flex-col max-h-[60vh]">
              <div className="p-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center justify-between">
                 <span>Recent Transactions</span>
                 <span className="text-primary">{chartData[chartData.length-1].volume} /s</span>
              </div>
              <div className="flex-1 overflow-hidden p-2 flex flex-col gap-1 relative mask-image-gradient">
                <AnimatePresence>
                  {recentOrders.map((order, i) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1 - (i * 0.08), x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm p-2 rounded flex flex-col gap-1 bg-background/40 border border-transparent hover:border-border transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor: CATEGORIES[order.category].color}}></span>
                          {CATEGORIES[order.category].label}
                        </span>
                        <span className="font-medium" style={{ color: CATEGORIES[order.category].color }}>
                          ${order.value}
                        </span>
                      </div>
                      <div className="text-xs text-foreground/50 opacity-50 flex justify-between">
                         <span>#{order.id.toUpperCase()}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* COMBO CORNER */}
          <div className="absolute right-0 bottom-8 pointer-events-none flex flex-col items-end">
            <AnimatePresence mode="popLayout">
              {combo > 0 && (
                <motion.div
                  key="combo-container"
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  className={`flex flex-col items-end ${getComboShakeClass()}`}
                >
                  <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 mr-1">
                    Order Streak
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <motion.div 
                      key={combo}
                      initial={{ scale: 1.3, color: 'hsl(var(--primary))' }}
                      animate={{ 
                        scale: 1, 
                        color: comboLevel >= 2 ? 'hsl(var(--accent))' : 'hsl(var(--foreground))'
                      }}
                      className="font-black text-6xl md:text-8xl leading-none tracking-tighter drop-shadow-md"
                    >
                      {combo}
                    </motion.div>
                    <span className="text-2xl text-muted-foreground font-bold pb-2 pr-2">x</span>
                  </div>

                  {/* COMBO TIMER BAR */}
                  <div className="w-48 h-1.5 bg-muted rounded-full mt-2 overflow-hidden relative">
                    <motion.div 
                      className="absolute top-0 right-0 bottom-0 origin-right"
                      style={{ 
                        width: `${comboTimer}%`,
                        backgroundColor: comboLevel >= 2 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'
                      }}
                      transition={{ duration: 0.1, ease: "linear" }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </main>
      </div>
    </div>
  );
}