import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { DisasterAlert } from '../hooks/useDisasterAlerts';

// ── Types ──────────────────────────────────────────────────

export type SimMode = 'flood' | 'fire' | null;

export interface DispatchEvent {
  id: string;
  timestamp: number;
  category: 'alert' | 'simulation' | 'llm' | 'dispatch' | 'system';
  title: string;
  detail?: string;
  color?: string;
}

export interface FireSimFrame {
  step: number;
  timeLabel: string;
  areaKm2: number;
  polygon: number[][];
}

export interface AegisState {
  alerts: DisasterAlert[];
  activeLayers: Record<string, boolean>;
  selectedAlertId: string | null;
  simMode: SimMode;
  simProgress: number;
  isPlaying: boolean;
  simSpeed: number;
  fireFrames: FireSimFrame[];
  currentFireStep: number;
  dispatchLog: DispatchEvent[];
}

type Action =
  | { type: 'SET_ALERTS'; alerts: DisasterAlert[] }
  | { type: 'TOGGLE_LAYER'; layer: string }
  | { type: 'SET_LAYERS'; layers: Record<string, boolean> }
  | { type: 'SELECT_ALERT'; id: string | null }
  | { type: 'SET_SIM_MODE'; mode: SimMode }
  | { type: 'SET_SIM_PROGRESS'; progress: number }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_SIM_SPEED'; speed: number }
  | { type: 'SET_FIRE_FRAMES'; frames: FireSimFrame[] }
  | { type: 'SET_FIRE_STEP'; step: number }
  | { type: 'ADD_EVENT'; event: DispatchEvent }
  | { type: 'CLEAR_EVENTS' };

// ── Reducer ────────────────────────────────────────────────

function reducer(state: AegisState, action: Action): AegisState {
  switch (action.type) {
    case 'SET_ALERTS':
      return { ...state, alerts: action.alerts };
    case 'TOGGLE_LAYER': {
      const next = { ...state.activeLayers, [action.layer]: !state.activeLayers[action.layer] };
      return { ...state, activeLayers: next };
    }
    case 'SET_LAYERS':
      return { ...state, activeLayers: action.layers };
    case 'SELECT_ALERT':
      return { ...state, selectedAlertId: action.id };
    case 'SET_SIM_MODE':
      return { ...state, simMode: action.mode, simProgress: 0, isPlaying: false, fireFrames: [], currentFireStep: 0 };
    case 'SET_SIM_PROGRESS':
      return { ...state, simProgress: action.progress };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing };
    case 'SET_SIM_SPEED':
      return { ...state, simSpeed: action.speed };
    case 'SET_FIRE_FRAMES':
      return { ...state, fireFrames: action.frames };
    case 'SET_FIRE_STEP':
      return { ...state, currentFireStep: action.step };
    case 'ADD_EVENT':
      return { ...state, dispatchLog: [action.event, ...state.dispatchLog].slice(0, 100) };
    case 'CLEAR_EVENTS':
      return { ...state, dispatchLog: [] };
    default:
      return state;
  }
}

const initialState: AegisState = {
  alerts: [],
  activeLayers: { flood: true, fire: true, landslide: true, chemical: true },
  selectedAlertId: null,
  simMode: null,
  simProgress: 0,
  isPlaying: false,
  simSpeed: 1,
  fireFrames: [],
  currentFireStep: 0,
  dispatchLog: [],
};

// ── Context ────────────────────────────────────────────────

interface AegisContextValue {
  state: AegisState;
  dispatch: React.Dispatch<Action>;
  addEvent: (category: DispatchEvent['category'], title: string, detail?: string, color?: string) => void;
}

const AegisContext = createContext<AegisContextValue | null>(null);

export function AegisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const alertTimerRef = useRef<ReturnType<typeof setInterval>>();

  const addEvent = useCallback((category: DispatchEvent['category'], title: string, detail?: string, color?: string) => {
    dispatch({
      type: 'ADD_EVENT',
      event: { id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), category, title, detail, color },
    });
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/disaster/alerts');
      if (!res.ok) throw new Error('Alerts API error');
      const data = await res.json();
      dispatch({ type: 'SET_ALERTS', alerts: data.alerts || [] });
    } catch {
      dispatch({ type: 'SET_ALERTS', alerts: getMockAlerts() });
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    addEvent('system', '系统上线', '御险·时空智脑核心已初始化完毕');
    alertTimerRef.current = setInterval(fetchAlerts, 15000);
    return () => clearInterval(alertTimerRef.current);
  }, [fetchAlerts, addEvent]);

  return (
    <AegisContext.Provider value={{ state, dispatch, addEvent }}>
      {children}
    </AegisContext.Provider>
  );
}

export function useAegis() {
  const ctx = useContext(AegisContext);
  if (!ctx) throw new Error('useAegis must be used within <AegisProvider>');
  return ctx;
}

// ── Mock data (fallback) ───────────────────────────────────

function getMockAlerts(): DisasterAlert[] {
  const now = Date.now();
  return [
    { id: 'alert-001', type: 'flood', level: 'orange', title: '长江泸州段水位超警', description: '长江江阳区水域水位已超警戒线0.8m，预计未来6小时持续上涨。', lng: 105.4401, lat: 28.8913, confidence: 0.92, timestamp: new Date(now - 300000).toISOString() },
    { id: 'alert-002', type: 'fire', level: 'red', title: '古蔺县林火告警', description: '无人机AI视觉引擎检测到古蔺林区烟火特征，置信度94%', lng: 105.8152, lat: 28.0315, confidence: 0.94, timestamp: new Date(now - 120000).toISOString() },
    { id: 'alert-003', type: 'landslide', level: 'yellow', title: '叙永县地质形变预警', description: 'InSAR监测到该区域沉降速率异常（>12mm/月）', lng: 105.4431, lat: 28.1691, confidence: 0.78, timestamp: new Date(now - 600000).toISOString() },
    { id: 'alert-004', type: 'flood', level: 'blue', title: '龙马潭区暴雨内涝预警', description: '预计未来3小时降雨量将达到50-80mm', lng: 105.4382, lat: 28.9103, confidence: 0.85, timestamp: new Date(now - 900000).toISOString() },
    { id: 'alert-005', type: 'chemical', level: 'orange', title: '示例地区区化工园氨气异动', description: '示例地区区化工园探头捕捉到氨气浓度激增', lng: 105.3712, lat: 28.7753, confidence: 0.88, timestamp: new Date(now - 180000).toISOString() },
  ];
}
