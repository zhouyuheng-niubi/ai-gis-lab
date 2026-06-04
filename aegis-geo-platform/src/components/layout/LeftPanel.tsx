import { useState, useMemo } from 'react';
import { useAegis } from '../../store/AegisContext';
import { TYPE_LABEL, LEVEL_LABEL } from '../../hooks/useDisasterAlerts';
import type { DisasterAlert } from '../../hooks/useDisasterAlerts';

interface LeftPanelProps {
  onAlertSelect?: (alert: DisasterAlert) => void;
  onLayerToggle?: (layerType: string, visible: boolean) => void;
  activeLayers?: Record<string, boolean>;
}

const DISASTER_LAYERS = [
  { id: 'flood', label: '洪涝灾害', color: '#3b82f6', icon: '🌊' },
  { id: 'fire', label: '森林火灾', color: '#ef4444', icon: '🔥' },
  { id: 'landslide', label: '地质灾害', color: '#f59e0b', icon: '⛰️' },
  { id: 'chemical', label: '危化品事故', color: '#a855f7', icon: '☢️' },
];

const LEVEL_COLORS: Record<string, string> = {
  red: 'border-red-500/60 bg-red-500/10',
  orange: 'border-orange-500/60 bg-orange-500/10',
  yellow: 'border-yellow-500/60 bg-yellow-500/10',
  blue: 'border-blue-500/60 bg-blue-500/10',
};

const LEVEL_DOT_COLORS: Record<string, string> = {
  red: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]',
  orange: 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]',
  yellow: 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)]',
  blue: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]',
};

export default function LeftPanel({ onAlertSelect, onLayerToggle, activeLayers: externalLayers }: LeftPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [internalLayers, setInternalLayers] = useState<Record<string, boolean>>({
    flood: true, fire: true, landslide: true, chemical: true,
  });
  const activeLayers = externalLayers || internalLayers;

  const { state: aegisState, addEvent } = useAegis();
  const alerts = aegisState.alerts;
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, 'pending' | 'success'>>({});

  const filteredAlerts = useMemo(
    () => alerts.filter(a => activeLayers[a.type] !== false),
    [alerts, activeLayers],
  );

  function toggleLayer(id: string) {
    const next = !activeLayers[id];
    if (!externalLayers) {
      setInternalLayers(prev => ({ ...prev, [id]: next }));
    }
    onLayerToggle?.(id, next);
  }

  function handleAlertSelect(alert: DisasterAlert) {
    setSelectedAlertId(alert.id);
    onAlertSelect?.(alert);
  }

  function executeDispatch(alertId: string, action: string) {
    setDispatchStatus(prev => ({ ...prev, [alertId]: 'pending' }));
    const alert = alerts.find(a => a.id === alertId);
    addEvent('dispatch', `${action} → ${alert?.title || alertId}`, undefined, '#10b981');
    setTimeout(() => {
      setDispatchStatus(prev => ({ ...prev, [alertId]: 'success' }));
      addEvent('dispatch', `指令已下达: ${alert?.title || alertId}`, '部队已派遣');
    }, 2000);
  }

  function timeSince(ts: string) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    return `${Math.floor(diff / 3600)}小时前`;
  }

  if (collapsed) {
    return (
      <div className="absolute left-0 top-20 z-40 pointer-events-auto">
        <button
          onClick={() => setCollapsed(false)}
          className="bg-slate-950/70 backdrop-blur-xl border border-white/10 border-l-0 rounded-r-lg px-2 py-4 text-cyan-400 hover:bg-slate-800/90 transition-all shadow-[0_4px_30px_rgba(0,0,0,0.8)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          {filteredAlerts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center animate-pulse">
              {filteredAlerts.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute left-4 top-20 bottom-20 w-72 z-40 flex flex-col gap-3 pointer-events-auto">
      {/* Layer Control */}
      <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-cyan-300 tracking-wider">灾害图层控制</h3>
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-500 hover:text-cyan-400 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
        <div className="p-3 space-y-1.5">
          {DISASTER_LAYERS.map(layer => {
            const count = alerts.filter(a => a.type === layer.id).length;
            return (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  activeLayers[layer.id]
                    ? 'bg-slate-800/60 text-white'
                    : 'bg-transparent text-slate-500 hover:text-slate-300 opacity-50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm border transition-all flex-none"
                  style={{
                    backgroundColor: activeLayers[layer.id] ? layer.color : 'transparent',
                    borderColor: layer.color,
                    boxShadow: activeLayers[layer.id] ? `0 0 6px ${layer.color}60` : 'none',
                  }}
                />
                <span>{layer.icon} {layer.label}</span>
                <span className="ml-auto text-xs tabular-nums" style={{ color: count > 0 ? layer.color : undefined }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.8)] flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-cyan-300 tracking-wider">实时灾害告警</h3>
          <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full animate-pulse border border-red-500/30 tabular-nums">
            {filteredAlerts.length} 条活跃
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin custom-scrollbar">
          {filteredAlerts.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              暂无匹配的活跃告警
            </div>
          )}
          {filteredAlerts.map(alert => {
            const isSelected = selectedAlertId === alert.id;
            const status = dispatchStatus[alert.id];

            return (
              <div key={alert.id} className="w-full flex flex-col gap-1">
                <button
                  onClick={() => handleAlertSelect(alert)}
                  className={`w-full text-left p-3 rounded-lg transition-all hover:scale-[1.01] border-l-2 ${LEVEL_COLORS[alert.level]} ${isSelected ? 'ring-1 ring-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${LEVEL_DOT_COLORS[alert.level]}`} />
                    <span className="text-xs font-semibold text-slate-300">{TYPE_LABEL[alert.type]}</span>
                    <span className="ml-auto text-[10px] text-slate-500">{timeSince(alert.timestamp)}</span>
                  </div>
                  <div className="text-sm font-medium text-white mb-1">{alert.title}</div>
                  <div className="text-xs text-slate-400 line-clamp-2">{alert.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800/80 text-slate-300 rounded border border-slate-600/50">
                      {LEVEL_LABEL[alert.level]}
                    </span>
                    <span className="text-[10px] text-cyan-400 tabular-nums">
                      置信度 {(alert.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-1 p-2.5 bg-slate-900/90 border border-cyan-500/20 rounded-lg flex flex-col gap-2 overflow-hidden shadow-inner">
                    <div className="text-[10px] text-cyan-500 font-mono flex items-center gap-2">
                      <span className="w-1 h-3 bg-cyan-500 rounded-sm animate-pulse"></span>
                      <span>战术执行链路 (Tactical Dispatch)</span>
                    </div>

                    {status === 'success' ? (
                      <div className="text-xs text-green-400 font-mono py-1.5 px-2 border border-green-500/30 bg-green-500/10 text-center tracking-widest rounded-lg flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        指令已下达 | 部队已派遣
                      </div>
                    ) : status === 'pending' ? (
                      <div className="text-xs text-yellow-400 font-mono py-1.5 px-2 border border-yellow-500/30 bg-yellow-500/10 text-center flex justify-center gap-2 rounded-lg">
                        <span className="animate-spin">⟳</span> 终端加密校验中...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); executeDispatch(alert.id, '特勤编队出动'); }}
                          className="text-xs py-1.5 px-2 bg-red-600/20 hover:bg-red-500/40 border border-red-500/50 text-red-200 rounded-lg transition-all text-center">
                          特勤编队出动
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); executeDispatch(alert.id, '派出无人机组'); }}
                          className="text-xs py-1.5 px-2 bg-cyan-600/20 hover:bg-cyan-500/40 border border-cyan-500/50 text-cyan-200 rounded-lg transition-all text-center">
                          派出无人机组
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
