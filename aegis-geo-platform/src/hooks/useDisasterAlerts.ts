import { useEffect, useState, useCallback } from 'react';

export interface DisasterAlert {
  id: string;
  type: 'flood' | 'fire' | 'landslide' | 'chemical';
  level: 'red' | 'orange' | 'yellow' | 'blue';
  title: string;
  description: string;
  lng: number;
  lat: number;
  confidence: number;
  timestamp: string;
}

const TYPE_LABEL: Record<string, string> = {
  flood: '🌊 洪涝',
  fire: '🔥 火灾',
  landslide: '⛰️ 地质灾害',
  chemical: '☢️ 危化品',
};

const LEVEL_LABEL: Record<string, string> = {
  red: '红色预警',
  orange: '橙色预警',
  yellow: '黄色预警',
  blue: '蓝色预警',
};

export function useDisasterAlerts() {
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/disaster/alerts');
      if (!res.ok) throw new Error('Alerts API error');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      // Use mock data if API unavailable
      setAlerts(getMockAlerts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 15000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  return { alerts, loading, refetch: fetchAlerts };
}

function getMockAlerts(): DisasterAlert[] {
  const now = Date.now();
  return [
    {
      id: 'alert-001',
      type: 'flood',
      level: 'orange',
      title: '长江泸州段水位超警',
      description: '长江江阳区水域水位已超警戒线0.8m，预计未来6小时持续上涨，威胁滨江路段。',
      lng: 105.4401,
      lat: 28.8913,
      confidence: 0.92,
      timestamp: new Date(now - 300000).toISOString(),
    },
    {
      id: 'alert-002',
      type: 'fire',
      level: 'red',
      title: '古蔺县林火告警',
      description: '无人机AI视觉引擎检测到古蔺林区烟火特征，置信度94%，火势向西北蔓延',
      lng: 105.8152,
      lat: 28.0315,
      confidence: 0.94,
      timestamp: new Date(now - 120000).toISOString(),
    },
    {
      id: 'alert-003',
      type: 'landslide',
      level: 'yellow',
      title: '叙永县地质形变预警',
      description: 'InSAR监测到该区域沉降速率异常（>12mm/月），逢连日暴雨极可能发生滑坡',
      lng: 105.4431,
      lat: 28.1691,
      confidence: 0.78,
      timestamp: new Date(now - 600000).toISOString(),
    },
    {
      id: 'alert-004',
      type: 'flood',
      level: 'blue',
      title: '龙马潭区暴雨内涝预警',
      description: '预计未来3小时降雨量将达到50-80mm，部分涵洞隧道极易积水',
      lng: 105.4382,
      lat: 28.9103,
      confidence: 0.85,
      timestamp: new Date(now - 900000).toISOString(),
    },
    {
      id: 'alert-005',
      type: 'chemical',
      level: 'orange',
      title: '示例地区区化工园氨气异动',
      description: '示例地区区化工园探头捕捉到氨气浓度激增，下风向沿线街道需做好一级防护准备',
      lng: 105.3712,
      lat: 28.7753,
      confidence: 0.88,
      timestamp: new Date(now - 180000).toISOString(),
    },
  ];
}

export { TYPE_LABEL, LEVEL_LABEL };
