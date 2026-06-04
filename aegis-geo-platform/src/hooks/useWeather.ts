import { useEffect, useState } from 'react';

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  pressure: number;
  skycon: string;
  description: string;
}

interface ForecastPoint {
  time: string;
  precipitation: number;
  waterLevel: number;
}

const SKYCON_MAP: Record<string, string> = {
  CLEAR_DAY: '☀️ 晴',
  CLEAR_NIGHT: '🌙 晴',
  PARTLY_CLOUDY_DAY: '⛅ 多云',
  PARTLY_CLOUDY_NIGHT: '☁️ 多云',
  CLOUDY: '☁️ 阴',
  LIGHT_RAIN: '🌧️ 小雨',
  MODERATE_RAIN: '🌧️ 中雨',
  HEAVY_RAIN: '🌧️ 大雨',
  STORM_RAIN: '⛈️ 暴雨',
  LIGHT_SNOW: '🌨️ 小雪',
  MODERATE_SNOW: '🌨️ 中雪',
  HEAVY_SNOW: '❄️ 大雪',
  STORM_SNOW: '❄️ 暴雪',
  FOG: '🌫️ 雾',
  DUST: '💨 浮尘',
  SAND: '💨 沙尘',
  WIND: '🌬️ 大风',
};

const WIND_DIR = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

function getWindDirection(deg: number): string {
  const idx = Math.round(deg / 45) % 8;
  return WIND_DIR[idx] + '风';
}

export function useWeather(lng: number, lat: number) {
  const [realtime, setRealtime] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        setLoading(true);
        const res = await fetch(`/api/weather/realtime?lng=${lng}&lat=${lat}`);
        if (!res.ok) throw new Error('Weather API error');
        const data = await res.json();
        if (!cancelled) {
          setRealtime(data);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      }

      try {
        const res = await fetch(`/api/weather/forecast?lng=${lng}&lat=${lat}`);
        if (!res.ok) throw new Error('Forecast API error');
        const data = await res.json();
        if (!cancelled) {
          setForecast(data.points || []);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      }

      if (!cancelled) setLoading(false);
    }

    fetchWeather();
    // Refresh every 5 minutes
    const timer = setInterval(fetchWeather, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [lng, lat]);

  return { realtime, forecast, loading, error };
}

export { SKYCON_MAP, getWindDirection };
export type { WeatherData, ForecastPoint };
