import { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useWeather } from '../../hooks/useWeather';
import { useAegis } from '../../store/AegisContext';

interface RightPanelProps {
  lng: number;
  lat: number;
  floodProgress?: number;
}

interface ForecastPoint {
  time: string;
  precipitation: number;
  waterLevel: number;
}

export default function RightPanel({ lng, lat, floodProgress = 0 }: RightPanelProps) {
  const { realtime } = useWeather(lng, lat);
  const { state: { alerts } } = useAegis();
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);

  useEffect(() => {
    fetch('/api/disaster/forecast/hydrology?hours=72')
      .then(res => res.json())
      .then(data => {
        if (data.forecast) setForecastData(data.forecast);
      })
      .catch(err => console.error("Failed to fetch hydrology data", err));
  }, []);

  const currentHourIndex = Math.min(
    Math.floor((floodProgress / 100) * 71),
    71
  );

  const weather = realtime || {
    temperature: 18.5,
    humidity: 78,
    windSpeed: 12.3,
    windDirection: '东南风',
    precipitation: 2.4,
    pressure: 1013,
    skycon: 'MODERATE_RAIN',
    description: '🌧️ 中雨',
  };

  const stats = useMemo(() => {
    const activeAlerts = alerts.length;
    const redCount = alerts.filter(a => a.level === 'red').length;
    const avgConfidence = alerts.length > 0
      ? Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length * 100)
      : 0;
    return { activeAlerts, redCount, avgConfidence };
  }, [alerts]);

  const chartOption: EChartsOption = {
    backgroundColor: 'transparent',
    grid: { top: 40, right: 45, bottom: 30, left: 45 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,23,42,0.9)',
      borderColor: 'rgba(34,211,238,0.3)',
      textStyle: { color: '#e2e8f0', fontSize: 11 },
    },
    legend: {
      data: ['降雨量', '水位'],
      textStyle: { color: '#94a3b8', fontSize: 10 },
      top: 5,
    },
    xAxis: {
      type: 'category',
      data: forecastData.map(p => p.time),
      axisLabel: {
        color: '#cbd5e1',
        fontSize: 9,
        rotate: 45,
        interval: 11,
      },
      axisLine: { lineStyle: { color: '#475569' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'mm/h',
        nameTextStyle: { color: '#cbd5e1', fontSize: 9 },
        axisLabel: { color: '#cbd5e1', fontSize: 9 },
        splitLine: { lineStyle: { color: '#1e293b' } },
        axisLine: { lineStyle: { color: '#475569' } },
      },
      {
        type: 'value',
        name: '水位(m)',
        nameTextStyle: { color: '#cbd5e1', fontSize: 9 },
        axisLabel: { color: '#cbd5e1', fontSize: 9 },
        splitLine: { show: false },
        axisLine: { lineStyle: { color: '#475569' } },
      },
    ],
    series: [
      {
        name: '降雨量',
        type: 'bar',
        data: forecastData.map(p => p.precipitation),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#0ea5e9' },
              { offset: 1, color: '#0284c7' },
            ],
          },
          borderRadius: [2, 2, 0, 0]
        },
        barWidth: 4,
        yAxisIndex: 0,
      },
      {
        name: '水位',
        type: 'line',
        yAxisIndex: 1,
        data: forecastData.map(p => p.waterLevel),
        smooth: true,
        lineStyle: { color: '#f43f5e', width: 3, shadowColor: 'rgba(244,63,94,0.5)', shadowBlur: 10 },
        itemStyle: { color: '#f43f5e' },
        showSymbol: false,
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [
            { yAxis: 43.5, name: '警戒线', label: { color: '#ef4444', fontSize: 9, formatter: '警戒水位' }, lineStyle: { color: '#ef4444', type: 'dashed', width: 1 } },
            { xAxis: currentHourIndex, label: { show: true, formatter: '推演时刻', color: '#38bdf8' }, lineStyle: { color: '#38bdf8', type: 'solid', width: 2, shadowColor: '#38bdf8', shadowBlur: 10 } }
          ],
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(244,63,94,0.4)' },
              { offset: 1, color: 'rgba(244,63,94,0.02)' },
            ],
          },
        },
      },
    ],
  };

  const precipLevel = weather.precipitation > 16 ? '暴雨' : weather.precipitation > 8 ? '大雨' : weather.precipitation > 4 ? '中雨' : '小雨';
  const precipColor = weather.precipitation > 16 ? 'bg-red-500/20 text-red-300' : weather.precipitation > 8 ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300';

  return (
    <div className="absolute right-4 top-20 bottom-20 w-80 z-40 flex flex-col gap-3 pointer-events-auto">
      {/* Weather Card */}
      <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-cyan-300 tracking-wider">实时气象态势</h3>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-white tabular-nums">
                {weather.temperature}
                <span className="text-lg text-slate-400">°C</span>
              </div>
              <div className="text-sm text-cyan-400 mt-1">{weather.description || '🌧️ 中雨'}</div>
            </div>
            <div className="text-right space-y-1.5">
              <div className="text-xs text-slate-300">
                湿度 <span className="text-cyan-300 font-medium tabular-nums">{weather.humidity}%</span>
              </div>
              <div className="text-xs text-slate-300">
                风速 <span className="text-cyan-300 font-medium tabular-nums">{weather.windSpeed}m/s</span>
              </div>
              <div className="text-xs text-slate-300">
                气压 <span className="text-cyan-300 font-medium tabular-nums">{weather.pressure}hPa</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 flex items-center gap-3">
            <div className="text-2xl">🌧️</div>
            <div>
              <div className="text-xs text-slate-400">当前降雨强度</div>
              <div className="text-lg font-bold text-blue-400 tabular-nums">{weather.precipitation} mm/h</div>
            </div>
            <div className={`ml-auto text-xs px-2 py-1 rounded-lg ${precipColor}`}>
              {precipLevel}
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="flex-1 bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.8)] flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-cyan-300 tracking-wider">72h 降雨/水位预测</h3>
          <span className="text-[10px] text-slate-400">AI模型推演</span>
        </div>
        <div className="flex-1 p-2 min-h-0">
          <ReactECharts
            option={chartOption}
            style={{ width: '100%', height: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      </div>

      {/* Dynamic Stats */}
      <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className={`text-lg font-bold tabular-nums transition-colors ${stats.redCount > 0 ? 'text-red-400' : 'text-orange-400'}`}>
              {stats.activeAlerts}
            </div>
            <div className="text-[10px] text-slate-500">活跃预警</div>
          </div>
          <div>
            <div className="text-lg font-bold text-cyan-400 tabular-nums">12</div>
            <div className="text-[10px] text-slate-500">监测站点</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400 tabular-nums">{stats.avgConfidence}%</div>
            <div className="text-[10px] text-slate-500">平均置信度</div>
          </div>
        </div>
      </div>
    </div>
  );
}
