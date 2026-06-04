import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface CameraInfo {
  id: string;
  name: string;
  hls_url: string;
  online: boolean;
}

interface CCTVPanelProps {
  onClose: () => void;
}

function HLSVideoCell({ cam, time }: { cam: CameraInfo; time: Date }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 6,
      });
      hls.loadSource(cam.hls_url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setStatus('live');
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setStatus('offline');
          // Auto retry after 5s
          setTimeout(() => {
            setStatus('connecting');
            hls.loadSource(cam.hls_url);
          }, 5000);
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = cam.hls_url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
        setStatus('live');
      });
    }

    return () => {
      hlsRef.current?.destroy();
    };
  }, [cam.hls_url]);

  const timeString = time.toISOString().replace('T', ' ').slice(0, 23);

  return (
    <div className="relative aspect-video bg-black rounded overflow-hidden group cursor-crosshair border border-slate-700/60">
      {/* CRT Scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-10 z-10" style={{
        background: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.3) 50%), linear-gradient(90deg, rgba(255,0,0,0.04), rgba(0,255,0,0.02), rgba(0,0,255,0.04))',
        backgroundSize: '100% 2px, 3px 100%'
      }} />

      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        autoPlay
      />

      {/* Fallback for offline */}
      {status === 'offline' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
          <div className="text-center">
            <div className="text-red-400 text-xs font-mono animate-pulse">⚠ 信号中断</div>
            <div className="text-slate-500 text-[9px] mt-1">自动重连中...</div>
          </div>
        </div>
      )}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
          <div className="text-cyan-400 text-xs font-mono animate-pulse">● 建立连接...</div>
        </div>
      )}

      {/* Top-left info */}
      <div className="absolute top-1.5 left-2 z-20 flex flex-col pointer-events-none">
        <span className="text-[9px] font-mono text-green-400/90 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">{cam.id.toUpperCase()} | {status === 'live' ? 'LIVE' : 'WAIT'}</span>
        <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">{cam.name}</span>
      </div>

      {/* Bottom-right timestamp + REC */}
      <div className="absolute bottom-1.5 right-2 z-20 pointer-events-none flex items-center gap-1.5">
        {status === 'live' && <span className="w-1.5 h-1.5 bg-red-500 animate-pulse rounded-full shadow-[0_0_4px_#ef4444]"></span>}
        {status === 'live' && <span className="text-[8px] font-mono text-red-400 font-bold">REC</span>}
        <span className="text-[8px] font-mono text-white/80 drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">{timeString}</span>
      </div>

      {/* Hover */}
      <div className="absolute inset-0 bg-cyan-900/0 group-hover:bg-cyan-900/15 transition-all border-2 border-transparent group-hover:border-cyan-400/50 z-30 rounded" />
    </div>
  );
}

export default function CCTVPanel({ onClose }: CCTVPanelProps) {
  const [time, setTime] = useState(new Date());
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 80);
    return () => clearInterval(timer);
  }, []);

  // On mount: start RTSP relay and fetch camera list
  useEffect(() => {
    async function init() {
      try {
        // Start FFmpeg conversion
        await fetch('/api/cctv/start', { method: 'POST' });
        setStarted(true);
        // Wait for FFmpeg to generate first segments
        await new Promise(r => setTimeout(r, 3000));
        // Fetch camera list
        const res = await fetch('/api/cctv/cameras');
        const data = await res.json();
        setCameras(data);
      } catch (e) {
        console.error('CCTV init failed:', e);
      }
    }
    init();

    return () => {
      // Stop streams when panel closes
      fetch('/api/cctv/stop', { method: 'POST' }).catch(() => {});
    };
  }, []);

  const timeString = time.toISOString().replace('T', ' ').slice(0, 23);

  return (
    <div className="absolute inset-0 z-[90] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[800px] bg-slate-950/80 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden shadow-[0_10px_60px_rgba(0,0,0,0.9)] pointer-events-auto animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]"></span>
            <span className="text-sm font-bold tracking-widest text-cyan-300">局域网实时监控矩阵 (RTSP → HLS)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-400">{timeString}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">&times;</button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-2 gap-1 p-2" style={{ gridTemplateRows: `repeat(${Math.ceil(cameras.length / 2)}, 1fr)` }}>
          {cameras.length > 0 ? cameras.map(cam => (
            <HLSVideoCell key={cam.id} cam={cam} time={time} />
          )) : (
            <div className="col-span-2 flex items-center justify-center py-16">
              <div className="text-center">
                <div className="text-cyan-400 text-sm font-mono animate-pulse">
                  {started ? '● 正在启动 FFmpeg 转码通道...' : '● 连接后端服务...'}
                </div>
                <div className="text-slate-500 text-xs mt-2">RTSP 流首次转码需要 3-5 秒</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-slate-900/40">
          <span className="text-[9px] font-mono text-slate-500">RTSP 中继 · FFmpeg {cameras.length} 路转码</span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-green-400">● {cameras.filter(c => c.online).length}/{cameras.length} ONLINE</span>
            <span className="text-[9px] font-mono text-slate-500">Protocol: HLS/AES</span>
          </div>
        </div>
      </div>
    </div>
  );
}
