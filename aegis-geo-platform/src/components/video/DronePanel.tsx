import React, { useRef, useEffect, useState } from 'react';

interface DronePanelProps {
  onClose: () => void;
  onCriticalDetection: () => void;
}

const DronePanel: React.FC<DronePanelProps> = ({ onClose, onCriticalDetection }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDetected, setHasDetected] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animationFrameId: number;
    let detectionTriggered = false;

    // We do a simple mock: we guess the fire is roughly in the center right after a few seconds
    const drawBoxes = () => {
      if (video.paused || video.ended) {
        animationFrameId = requestAnimationFrame(drawBoxes);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Match canvas to video size
      if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = video.currentTime;
      
      // Artificial "AI Inference" timeline
      if (time > 1.0) {
        // Full Screen Crosshairs
        ctx.strokeStyle = '#0ea5e955';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI * 2);
        ctx.stroke();

        // Compute pseudo-random jitter for the bounding box to look like real YOLO
        const jitterX = (Math.random() - 0.5) * 10;
        const jitterY = (Math.random() - 0.5) * 10;
        
        // Simulating the fire box (roughly center-right)
        const x = canvas.width * 0.45 + jitterX;
        const y = canvas.height * 0.35 + jitterY;
        const w = 180 + Math.random() * 20;
        const h = 180 + Math.random() * 20;
        
        let targetConfidence = 0.6 + (time / 10);
        if (targetConfidence > 0.98) targetConfidence = 0.98 + Math.random() * 0.01;

        const isHighConf = targetConfidence > 0.85;
        const mainColor = isHighConf ? '#ef4444' : '#eab308';
        
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = isHighConf ? 2 : 1.5;
        ctx.strokeRect(x, y, w, h);
        
        // Cyberpunk HUD Corners
        const lineLen = 30;
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Top Left
        ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y);
        // Top Right
        ctx.moveTo(x + w - lineLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + lineLen);
        // Bottom Left
        ctx.moveTo(x, y + h - lineLen); ctx.lineTo(x, y + h); ctx.lineTo(x + lineLen, y + h);
        // Bottom Right
        ctx.moveTo(x + w - lineLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - lineLen);
        ctx.stroke();

        // Target Label with solid background
        ctx.fillStyle = mainColor;
        ctx.fillRect(x, y - 28, 220, 24);
        ctx.fillStyle = isHighConf ? '#ffffff' : '#000000';
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillText(`TRK-${Math.floor(time * 100).toString().padStart(5, '0')} | P=${(targetConfidence * 100).toFixed(1)}%`, x + 5, y - 11);
        
        // Data stream block right side
        ctx.fillStyle = mainColor + 'cc';
        ctx.font = '10px "Courier New", monospace';
        ctx.fillText(`∆T: ${(time * 2.3).toFixed(2)}ms`, x + w + 10, y + 20);
        ctx.fillText(`FL: ${(Math.random() * 1000).toFixed(0)} N/m2`, x + w + 10, y + 35);
        ctx.fillText(`TEMP: ${(isHighConf ? 450 + Math.random() * 50 : 35 + Math.random() * 10).toFixed(1)}°C`, x + w + 10, y + 50);

        if (isHighConf && (Math.floor(Date.now() / 100) % 2 === 0)) {
           // draw small red cross inside
           ctx.beginPath();
           ctx.moveTo(x + w/2, y + h/2 - 10); ctx.lineTo(x + w/2, y + h/2 + 10);
           ctx.moveTo(x + w/2 - 10, y + h/2); ctx.lineTo(x + w/2 + 10, y + h/2);
           ctx.stroke();
        }

        // Trigger callback if high confidence over time
        if (time > 4.5 && !detectionTriggered) {
          detectionTriggered = true;
          setHasDetected(true);
          onCriticalDetection();
        }
      }

      animationFrameId = requestAnimationFrame(drawBoxes);
    };

    video.play().catch(e => console.log('Autoplay prevented:', e));
    drawBoxes();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [onCriticalDetection]);

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] bg-slate-950/80 border border-white/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] z-[100] overflow-hidden backdrop-blur-xl flex flex-col animate-fade-in-scale">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full animate-pulse bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
          <span className="text-sky-100 font-bold tracking-widest text-sm">无人机巡视实时 AI 推理链路 [古蔺林场区]</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          &#10005; {/* X mark */}
        </button>
      </div>
      
      {/* Video Content Layer */}
      <div className="relative w-full aspect-video bg-black">
        {/* The Aerial MP4 File */}
        <video 
          ref={videoRef}
          src="/videos/drone_firesmoke.mp4" 
          crossOrigin="anonymous"
          className="absolute top-0 left-0 w-full h-full object-cover"
          loop
          muted
          playsInline
        />
        {/* Canvas for transparent drawing on top of video */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
        
        {/* HUD Info Overlays */}
        <div className="absolute top-4 left-4 text-xs font-mono text-cyan-400/80 drop-shadow flex flex-col gap-1">
          <span>ALT: 452.1m AGL</span>
          <span>SPD: 12.4 m/s</span>
          <span>LAT: 28.0315°N</span>
          <span>LON: 105.8112°E</span>
        </div>

        {hasDetected && (
          <div className="absolute bottom-6 inset-x-0 mx-auto w-fit bg-red-600/90 text-white px-6 py-2 rounded font-bold animate-bounce shadow-[0_0_20px_#ef4444] tracking-widest border border-red-400 text-lg">
            ⚠️ 系统已确认火险坐标 正在执行自动定位
          </div>
        )}
      </div>
    </div>
  );
};

export default DronePanel;
