import { useRef, useCallback, useEffect } from 'react';
import Header from './components/layout/Header';
import LeftPanel from './components/layout/LeftPanel';
import RightPanel from './components/layout/RightPanel';
import BottomBar from './components/layout/BottomBar';
import EventTimeline from './components/layout/EventTimeline';
import CesiumMap from './components/map/CesiumMap';
import DronePanel from './components/video/DronePanel';
import LLMPanel from './components/llm/LLMPanel';
import CCTVPanel from './components/video/CCTVPanel';
import { useAegis, type SimMode, type FireSimFrame } from './store/AegisContext';
import type { CesiumMapHandle } from './components/map/CesiumMap';
import type { DisasterAlert } from './hooks/useDisasterAlerts';
import './index.css';

function AppInner() {
  const mapRef = useRef<CesiumMapHandle>(null);
  const { state, dispatch, addEvent } = useAegis();
  const { alerts, activeLayers, simMode, simProgress, fireFrames, currentFireStep } = state;

  const showDrone = state.selectedAlertId === '__drone__';
  const showLLM = state.selectedAlertId === '__llm__';
  const showCCTV = state.selectedAlertId === '__cctv__';

  const setPanel = useCallback((panel: string) => {
    const current = state.selectedAlertId;
    dispatch({ type: 'SELECT_ALERT', id: current === panel ? null : panel });
  }, [state.selectedAlertId, dispatch]);

  const centerLng = 105.44;
  const centerLat = 28.89;

  // Sync alert entities on the map whenever alerts or layers change
  useEffect(() => {
    mapRef.current?.syncAlertEntities(alerts, activeLayers);
  }, [alerts, activeLayers]);

  // Sync fire simulation frame to the map
  useEffect(() => {
    if (simMode === 'fire' && fireFrames.length > 0) {
      const frame = fireFrames[currentFireStep] || null;
      mapRef.current?.renderFireFrame(frame);
    } else {
      mapRef.current?.clearFirePolygons();
    }
  }, [simMode, fireFrames, currentFireStep]);

  // Fire simulation: fetch frames from backend and advance step with progress
  useEffect(() => {
    if (simMode !== 'fire' || fireFrames.length === 0) return;
    const stepIndex = Math.min(Math.floor((simProgress / 100) * (fireFrames.length - 1)), fireFrames.length - 1);
    if (stepIndex !== currentFireStep) {
      dispatch({ type: 'SET_FIRE_STEP', step: stepIndex });
    }
  }, [simProgress, fireFrames, currentFireStep, simMode, dispatch]);

  const handleAlertSelect = useCallback((alert: DisasterAlert) => {
    dispatch({ type: 'SELECT_ALERT', id: alert.id });
    mapRef.current?.flyToAlert(alert);
    addEvent('alert', `聚焦: ${alert.title}`, `${alert.type} | ${alert.level}`, '#06b6d4');
  }, [dispatch, addEvent]);

  const handleLayerToggle = useCallback((layerType: string, visible: boolean) => {
    dispatch({ type: 'TOGGLE_LAYER', layer: layerType });
    addEvent('system', `图层 ${visible ? '开启' : '关闭'}: ${layerType}`);
  }, [dispatch, addEvent]);

  const handleSimulationStart = useCallback(async (mode: SimMode) => {
    const map = mapRef.current;
    if (!map) return;

    if (mode === 'flood') {
      map.clearFloodPolygons();
      map.clearFirePolygons();
      map.addFloodPolygon(
        [[105.43, 28.88], [105.45, 28.885], [105.455, 28.895], [105.44, 28.90], [105.425, 28.89]],
        80,
      );
    } else if (mode === 'fire') {
      map.clearFloodPolygons();
      map.clearFirePolygons();

      try {
        const res = await fetch('/api/simulation/fire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_lng: 105.81,
            origin_lat: 28.03,
            wind_speed: 8.0,
            wind_direction: 225.0,
            duration_hours: 72,
            time_steps: 24,
          }),
        });
        const data = await res.json();
        const frames: FireSimFrame[] = (data.series || []).map((s: any) => ({
          step: s.step,
          timeLabel: s.time_label,
          areaKm2: s.area_km2,
          polygon: s.polygon?.geometry?.coordinates?.[0]?.slice(0, -1) || [],
        }));
        dispatch({ type: 'SET_FIRE_FRAMES', frames });

        map.flyToAlert({
          id: 'fire-sim', type: 'fire', level: 'red',
          title: '古蔺火线推演', description: '火线蔓延模拟已启动',
          lng: 105.81, lat: 28.03, confidence: 1.0, timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Fire simulation failed:', err);
        addEvent('system', '火线推演后端调用失败', String(err), '#ef4444');
      }
    }
  }, [dispatch, addEvent]);

  const handleTimeChange = useCallback((progress: number) => {
    if (simMode === 'flood') {
      const currentHeight = (progress / 100) * 80;
      mapRef.current?.setFloodHeight(currentHeight);
    }
  }, [simMode]);

  const handleCriticalDetection = useCallback(() => {
    setTimeout(() => {
      mapRef.current?.flyToAlert({
        id: 'drone-alert-01', type: 'fire', level: 'red',
        title: '古蔺无人机林火实盘通报', description: '无人机边缘计算节点检出高危险火情',
        lng: 105.810, lat: 28.030, confidence: 0.98, timestamp: new Date().toISOString(),
      });
      dispatch({ type: 'SELECT_ALERT', id: null });
      addEvent('dispatch', '无人机火情确认', '古蔺林区火险坐标已锁定，自动启动定位', '#ef4444');
    }, 2500);
  }, [dispatch, addEvent]);

  const handleLLMCommand = useCallback((cmd: string, args: any[]) => {
    if (cmd === 'FLY_TO' && mapRef.current) {
      mapRef.current.flyToAlert({
        id: 'llm-cmd-' + Date.now(), type: 'flood', level: 'red',
        title: 'AI中枢 空间锁定', description: '已接管底层 GIS 控制权限',
        lng: args[0], lat: args[1], confidence: 1.0, timestamp: new Date().toISOString(),
      });
    } else if (cmd === 'SIM_FLOOD') {
      handleSimulationStart('flood');
    } else if (cmd === 'SIM_FIRE') {
      handleSimulationStart('fire');
    }
  }, [handleSimulationStart]);

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-black">
      <CesiumMap ref={mapRef} floodProgress={simMode === 'flood' ? simProgress : 0} />

      <Header />

      {/* Top Right Action Area */}
      <div className="absolute top-24 right-6 flex flex-col gap-3 z-50">
        <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.8)] flex flex-col gap-2 transition-all hover:border-white/20">
          <div className="text-[10px] text-sky-400/70 font-bold uppercase tracking-widest text-center pb-1 border-b border-white/5 mb-0.5">视 角 追 踪</div>
          <button onClick={() => mapRef.current?.flyToLuzhou(-45)} className="group relative overflow-hidden bg-slate-800/60 hover:bg-sky-900/60 text-sky-300 hover:text-white px-4 py-2 rounded-lg transition-all text-sm tracking-widest font-bold flex items-center justify-center gap-2">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-sky-500/10 to-sky-500/0 translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
            返回泸州
          </button>
          <div className="flex gap-2">
            <button onClick={() => mapRef.current?.flyToLuzhou(-90)} className="flex-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1.5 rounded-lg transition-all text-[11px] tracking-widest flex items-center justify-center">正视视角</button>
            <button onClick={() => mapRef.current?.flyToLuzhou(-45)} className="flex-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1.5 rounded-lg transition-all text-[11px] tracking-widest flex items-center justify-center">斜视倾斜</button>
          </div>
        </div>

        <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.8)] flex flex-col gap-2 transition-all hover:border-white/20">
          <div className="text-[10px] text-indigo-400/70 font-bold uppercase tracking-widest text-center pb-1 border-b border-white/5 mb-0.5 relative overflow-hidden">
            AI 中枢接入
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-indigo-500/50 animate-[pulse_2s_linear_infinite]" style={{boxShadow: '0 0 5px #6366f1'}} />
          </div>
          <ActionButton active={showCCTV} onClick={() => setPanel('__cctv__')} color="emerald" label="天网监控矩阵" />
          <ActionButton active={showDrone} onClick={() => setPanel('__drone__')} color="red" label="边缘视觉节点" />
          <ActionButton active={showLLM} onClick={() => setPanel('__llm__')} color="indigo" label="呼叫调度管家" glow />
        </div>
      </div>

      <LeftPanel onAlertSelect={handleAlertSelect} onLayerToggle={handleLayerToggle} activeLayers={activeLayers} />
      <RightPanel lng={centerLng} lat={centerLat} floodProgress={simMode === 'flood' ? simProgress : 0} />

      <EventTimeline />

      {showCCTV && <CCTVPanel onClose={() => dispatch({ type: 'SELECT_ALERT', id: null })} />}
      {showLLM && <LLMPanel onClose={() => dispatch({ type: 'SELECT_ALERT', id: null })} onLLMCommand={handleLLMCommand} />}
      {showDrone && <DronePanel onClose={() => dispatch({ type: 'SELECT_ALERT', id: null })} onCriticalDetection={handleCriticalDetection} />}

      <BottomBar onSimulationStart={handleSimulationStart} onTimeChange={handleTimeChange} />
    </div>
  );
}

function ActionButton({ active, onClick, color, label, glow }: { active: boolean; onClick: () => void; color: string; label: string; glow?: boolean }) {
  const colorMap: Record<string, { active: string; inactive: string }> = {
    emerald: { active: 'bg-emerald-700/80 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]', inactive: 'bg-emerald-900/60 text-emerald-100 border-emerald-500/30' },
    red: { active: 'bg-red-700/80 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]', inactive: 'bg-red-900/60 text-red-100 border-red-500/30' },
    indigo: { active: 'bg-indigo-700/80 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.6)]', inactive: 'bg-indigo-900/60 text-indigo-200 border-indigo-500/30' },
  };
  const styles = colorMap[color] || colorMap.indigo;
  return (
    <button onClick={onClick} className={`${active ? styles.active : styles.inactive} border hover:opacity-90 px-4 py-2 rounded-lg transition-all text-[13px] tracking-widest font-bold flex items-center justify-center gap-2 relative overflow-hidden`}>
      {glow && <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent animate-pulse" />}
      {label}
    </button>
  );
}

export default function App() {
  return <AppInner />;
}
