import { useState, useEffect, useCallback } from 'react';
import { useAegis, type SimMode } from '../../store/AegisContext';

interface BottomBarProps {
  onSimulationStart?: (mode: SimMode) => void;
  onTimeChange?: (progress: number) => void;
}

const SIM_MODES: { id: SimMode; label: string; color: string; icon: string }[] = [
  { id: 'flood', label: '洪水淹没', color: '#3b82f6', icon: '🌊' },
  { id: 'fire', label: '火线蔓延', color: '#ef4444', icon: '🔥' },
];

export default function BottomBar({ onSimulationStart, onTimeChange }: BottomBarProps) {
  const { state, dispatch, addEvent } = useAegis();
  const { simMode, simProgress, isPlaying, simSpeed } = state;

  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => { setLocalProgress(simProgress); }, [simProgress]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setLocalProgress(prev => {
        const next = Math.min(prev + 0.5 * simSpeed, 100);
        dispatch({ type: 'SET_SIM_PROGRESS', progress: next });
        onTimeChange?.(next);
        if (next >= 100) {
          dispatch({ type: 'SET_PLAYING', playing: false });
          addEvent('simulation', `${simMode === 'fire' ? '火线蔓延' : '洪水淹没'}推演完毕`, '推演已到达 T+72h 终态');
          return 100;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, simMode, dispatch, onTimeChange, addEvent]);

  const selectMode = useCallback((mode: SimMode) => {
    dispatch({ type: 'SET_SIM_MODE', mode });
    setLocalProgress(0);
    addEvent('simulation', `切换推演模式：${mode === 'fire' ? '火线蔓延' : '洪水淹没'}`, undefined, mode === 'fire' ? '#ef4444' : '#3b82f6');
  }, [dispatch, addEvent]);

  const handlePlayPause = useCallback(() => {
    if (localProgress >= 100) {
      setLocalProgress(0);
      dispatch({ type: 'SET_SIM_PROGRESS', progress: 0 });
      onTimeChange?.(0);
    }
    const nextPlaying = !isPlaying;
    dispatch({ type: 'SET_PLAYING', playing: nextPlaying });
    if (nextPlaying && localProgress === 0) {
      onSimulationStart?.(simMode);
      addEvent('simulation', `开始${simMode === 'fire' ? '火线蔓延' : '洪水淹没'}推演`);
    }
  }, [localProgress, isPlaying, simMode, dispatch, onSimulationStart, onTimeChange, addEvent]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalProgress(val);
    dispatch({ type: 'SET_SIM_PROGRESS', progress: val });
    onTimeChange?.(val);
  }, [dispatch, onTimeChange]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', playing: false });
    setLocalProgress(0);
    dispatch({ type: 'SET_SIM_PROGRESS', progress: 0 });
    onTimeChange?.(0);
  }, [dispatch, onTimeChange]);

  const progress = localProgress;
  const hours = Math.floor((progress / 100) * 72);
  const minutes = Math.floor(((progress / 100) * 72 - hours) * 60);
  const modeColor = simMode === 'fire' ? '#ef4444' : '#06b6d4';
  const progressColor = progress > 75 ? '#ef4444' : progress > 40 ? '#f59e0b' : modeColor;
  const isActive = progress > 0;

  const floodStats = simMode === 'flood' || !simMode;

  return (
    <div className="absolute bottom-0 left-0 w-full z-40 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      <div className="relative px-6 py-3 pointer-events-auto">
        {/* Mode Selector + Stats Row */}
        <div className="flex items-center justify-center gap-3 mb-3">
          {/* Mode selector pills */}
          <div className="flex items-center gap-1 bg-slate-900/60 border border-white/10 rounded-xl p-1 mr-2">
            {SIM_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => selectMode(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  simMode === m.id
                    ? 'text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={simMode === m.id ? { backgroundColor: m.color + '40', boxShadow: `0 0 12px ${m.color}40` } : undefined}
              >
                <span>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Stats */}
          {floodStats ? (
            <>
              <StatCard label="受威胁人口" value={Math.floor(Math.pow(progress, 1.8) * 15)} unit="人" color="text-red-400" borderColor="border-red-500/30" />
              <StatCard label="预估淹没面积" value={(Math.pow(progress, 1.4) * 0.05).toFixed(2)} unit="km²" color="text-blue-400" borderColor="border-blue-500/30" />
              <StatCard label="已调度救援" value={Math.floor(progress * 1.8)} unit="支" color="text-green-400" borderColor="border-green-500/30" />
              <StatCard label="转移安置" value={Math.floor(Math.pow(progress, 1.6) * 5)} unit="人" color="text-amber-400" borderColor="border-amber-500/30" />
            </>
          ) : (
            <>
              <StatCard label="火场面积" value={(Math.pow(progress, 1.3) * 0.08).toFixed(2)} unit="km²" color="text-red-400" borderColor="border-red-500/30" />
              <StatCard label="火线长度" value={(Math.pow(progress, 1.1) * 0.15).toFixed(2)} unit="km" color="text-orange-400" borderColor="border-orange-500/30" />
              <StatCard label="消防力量" value={Math.floor(progress * 2.5)} unit="人" color="text-green-400" borderColor="border-green-500/30" />
              <StatCard label="隔离带" value={(Math.pow(progress, 1.2) * 0.03).toFixed(2)} unit="km" color="text-amber-400" borderColor="border-amber-500/30" />
            </>
          )}
        </div>

        {/* Timeline Controls */}
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <button
            onClick={handlePlayPause}
            disabled={!simMode}
            className="flex-none border text-white px-4 py-2 rounded-lg transition-all text-sm flex items-center gap-2 active:scale-95 disabled:opacity-40"
            style={{
              backgroundColor: simMode ? modeColor + '50' : undefined,
              borderColor: simMode ? modeColor + '80' : undefined,
              boxShadow: simMode ? `0 0 10px ${modeColor}30` : undefined,
            }}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
            {!simMode ? '请选择模式' : isPlaying ? '暂停' : progress > 0 && progress < 100 ? '继续' : '开始推演'}
          </button>

          {isActive && (
            <button onClick={handleReset} className="flex-none text-slate-500 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/5" title="重置">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
            </button>
          )}

          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs text-slate-400 w-10 text-right tabular-nums font-mono">T+0h</span>
            <div className="flex-1 relative">
              <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${modeColor}, ${progressColor})`, boxShadow: `0 0 10px ${progressColor}80` }} />
              </div>
              <input type="range" min="0" max="100" step="0.1" value={progress} onChange={handleSliderChange} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
              {isActive && (
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-lg pointer-events-none transition-[left] duration-100" style={{ left: `calc(${progress}% - 6px)`, backgroundColor: progressColor }} />
              )}
            </div>
            <span className="text-xs text-slate-400 w-10 tabular-nums font-mono">T+72h</span>
          </div>

          <div className="flex-none text-center min-w-[80px]">
            <div className="text-sm font-mono tabular-nums" style={{ color: modeColor }}>
              T+{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-slate-500">推演进度</div>
          </div>

          <div className="flex-none flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5">
            {[1, 2, 4].map(s => (
              <button key={s} onClick={() => dispatch({ type: 'SET_SIM_SPEED', speed: s })} className={`px-2.5 py-1 text-xs rounded-md transition-all ${simSpeed === s ? 'bg-cyan-600/50 text-cyan-300 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}>
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color, borderColor }: { label: string; value: string | number; unit: string; color: string; borderColor: string }) {
  return (
    <div className={`text-center bg-slate-950/60 backdrop-blur-lg border ${borderColor} rounded-xl px-3 py-2 min-w-[100px] shadow-[0_2px_15px_rgba(0,0,0,0.5)]`}>
      <div className={`text-base font-bold tabular-nums ${color} transition-all duration-300`}>
        {value}<span className="text-[10px] text-slate-500 ml-1">{unit}</span>
      </div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
