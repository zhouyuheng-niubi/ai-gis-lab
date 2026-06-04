import { useEffect, useState } from 'react';

const TICKER_MESSAGES = [
  "【江阳区】防汛物资储备库 A 级调拨已完成 14/20 批次",
  "【龙马潭区】防汛抗旱指挥部提升沿江区域响应等级至 II 级",
  "【古蔺县】巡飞无人机群已抵达林区 105.81, 28.03 开启热力扫描...",
  "【示例地区区】化工园区监测组回报各项指标暂且稳定在安全阀值内",
  "【全局公告】水利气象联合解算完毕：预计长江洪峰明晨 04:00 过境泸州市主城区"
];

export default function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const timeStr = time.toLocaleTimeString('zh-CN', { hour12: false });

  return (
    <header className="absolute top-0 left-0 w-full z-50 pointer-events-none select-none">
      {/* Gradient backdrop */}
      <div className="absolute inset-0 h-24 bg-gradient-to-b from-slate-950/95 via-slate-950/80 to-transparent" />

      {/* Decorative top border glow */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />

      {/* Ticker Bar */}
      <div className="absolute top-[2px] left-0 w-full h-6 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl overflow-hidden flex items-center shadow-[0_0_10px_rgba(14,165,233,0.1)]">
        <div className="flex whitespace-nowrap animate-[ticker_35s_linear_infinite] gap-12 font-mono text-xs text-sky-400/90 tracking-widest pl-[100%]">
          {TICKER_MESSAGES.map((msg, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="text-amber-500 font-bold">LIVE</span>
              <span>{msg}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex items-center justify-between px-6 h-16 mt-6">
        {/* Left: Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
            </span>
            <span className="text-xs text-green-400/80 tracking-wide font-mono">SYSTEM ONLINE</span>
          </div>
        </div>

        {/* Center: Title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
            </svg>
            <h1 className="text-2xl font-bold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
              泸 州 市 · 时 空 智 脑
            </h1>
            <svg className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <p className="text-[10px] text-cyan-500/60 tracking-[0.5em] mt-0.5 uppercase font-mono">
            Luzhou Emergency Command Center
          </p>
        </div>

        {/* Right: Clock */}
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-lg font-mono text-cyan-300 tracking-wider tabular-nums">
              {timeStr}
            </div>
            <div className="text-[10px] text-slate-400 tracking-wider font-mono">
              {dateStr}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom decorative line */}
      <div className="relative mx-6">
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        <div className="absolute left-0 -top-1 w-2 h-2 border-l border-t border-cyan-500/50" />
        <div className="absolute right-0 -top-1 w-2 h-2 border-r border-t border-cyan-500/50" />
      </div>
    </header>
  );
}
