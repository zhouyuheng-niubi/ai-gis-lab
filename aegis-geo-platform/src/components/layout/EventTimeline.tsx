import { useState } from 'react';
import { useAegis } from '../../store/AegisContext';

const CATEGORY_STYLE: Record<string, { icon: string; color: string }> = {
  alert: { icon: '⚠', color: '#ef4444' },
  simulation: { icon: '◈', color: '#3b82f6' },
  llm: { icon: '⬡', color: '#8b5cf6' },
  dispatch: { icon: '▶', color: '#10b981' },
  system: { icon: '●', color: '#06b6d4' },
};

export default function EventTimeline() {
  const { state } = useAegis();
  const [expanded, setExpanded] = useState(true);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="absolute left-4 bottom-24 z-50 pointer-events-auto bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 text-[11px] text-cyan-400 hover:text-white hover:bg-slate-800/90 transition-all flex items-center gap-2"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
        事件流 ({state.dispatchLog.length})
      </button>
    );
  }

  return (
    <div className="absolute left-4 bottom-24 z-50 pointer-events-auto w-64 animate-slide-in-left">
      <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-xs font-semibold text-cyan-300 tracking-wider">事件流</span>
          </div>
          <button onClick={() => setExpanded(false)} className="text-slate-500 hover:text-cyan-400 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 9l-7 7-7-7"/></svg>
          </button>
        </div>

        <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
          {state.dispatchLog.length === 0 && (
            <div className="text-center py-6 text-slate-600 text-xs">暂无事件</div>
          )}
          {state.dispatchLog.map((evt, idx) => {
            const style = CATEGORY_STYLE[evt.category] || CATEGORY_STYLE.system;
            const ago = formatAgo(evt.timestamp);
            return (
              <div key={evt.id} className={`px-3 py-2 flex gap-2 ${idx > 0 ? 'border-t border-white/5' : ''} hover:bg-white/[0.02] transition-colors`}>
                <div className="flex-none pt-0.5">
                  <span className="text-[10px]" style={{ color: evt.color || style.color }}>{style.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-white font-medium truncate">{evt.title}</span>
                    <span className="text-[9px] text-slate-500 flex-none tabular-nums">{ago}</span>
                  </div>
                  {evt.detail && (
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{evt.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return '刚刚';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}
