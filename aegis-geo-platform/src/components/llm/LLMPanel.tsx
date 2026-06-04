import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAegis } from '../../store/AegisContext';

interface LLMPanelProps {
  onClose: () => void;
  onLLMCommand?: (cmd: string, args: any[]) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_GREETING = "您好，我是御险·时空智脑协同调度助理。您可以向我询问全域态势、要求启动洪水或火线推演，或让我飞往泸州任意区域进行监控。";

const QUICK_COMMANDS = [
  { label: '泸州防汛态势', prompt: '分析当前泸州市长江沿线防汛态势' },
  { label: '古蔺火线推演', prompt: '飞往古蔺林区并启动火线蔓延推演' },
  { label: '全域洪水推演', prompt: '启动泸州全域洪水淹没推演' },
  { label: '救援力量调度', prompt: '推演当前可用的应急救援力量部署方案' },
];

const ACTION_PATTERNS = [
  { regex: /<ACTION_FLYTO:\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]>/g, type: 'FLY_TO' },
  { regex: /<ACTION_SIM_FLOOD>/g, type: 'SIM_FLOOD' },
  { regex: /<ACTION_SIM_FIRE>/g, type: 'SIM_FIRE' },
  { regex: /<ACTION_ALERT:([^>]+)>/g, type: 'SHOW_ALERT' },
];

const LLMPanel: React.FC<LLMPanelProps> = ({ onClose, onLLMCommand }) => {
  const { addEvent, dispatch: aegisDispatch, state } = useAegis();
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: INITIAL_GREETING }]);
  const [inputVal, setInputVal] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const commandsExecutedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const extractAndExecuteCommands = useCallback((text: string, executeNew: boolean = false) => {
    let cleaned = text;
    const newCommands: Array<{ type: string; args: any[] }> = [];

    for (const pattern of ACTION_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        cleaned = cleaned.replace(match[0], '');
        const cmdKey = match[0];

        if (executeNew && !commandsExecutedRef.current.has(cmdKey)) {
          commandsExecutedRef.current.add(cmdKey);

          if (pattern.type === 'FLY_TO') {
            const lng = parseFloat(match[1]);
            const lat = parseFloat(match[2]);
            if (!isNaN(lng) && !isNaN(lat)) {
              newCommands.push({ type: 'FLY_TO', args: [lng, lat] });
            }
          } else if (pattern.type === 'SIM_FLOOD') {
            newCommands.push({ type: 'SIM_FLOOD', args: [] });
          } else if (pattern.type === 'SIM_FIRE') {
            newCommands.push({ type: 'SIM_FIRE', args: [] });
          } else if (pattern.type === 'SHOW_ALERT') {
            newCommands.push({ type: 'SHOW_ALERT', args: [match[1]] });
          }
        }
      }
    }

    if (executeNew) {
      for (const cmd of newCommands) {
        onLLMCommand?.(cmd.type, cmd.args);

        if (cmd.type === 'FLY_TO') {
          addEvent('llm', `AI 空间锁定 [${cmd.args[0]}, ${cmd.args[1]}]`, '三维地球镜头已由 LLM 接管', '#8b5cf6');
        } else if (cmd.type === 'SIM_FLOOD') {
          aegisDispatch({ type: 'SET_SIM_MODE', mode: 'flood' });
          addEvent('llm', 'AI 启动洪水推演', 'LLM 决策触发洪水淹没模拟', '#3b82f6');
        } else if (cmd.type === 'SIM_FIRE') {
          aegisDispatch({ type: 'SET_SIM_MODE', mode: 'fire' });
          addEvent('llm', 'AI 启动火线推演', 'LLM 决策触发火线蔓延模拟', '#ef4444');
        } else if (cmd.type === 'SHOW_ALERT') {
          const found = state.alerts.find(a => a.title.includes(cmd.args[0]));
          if (found) {
            aegisDispatch({ type: 'SELECT_ALERT', id: found.id });
            onLLMCommand?.('FLY_TO', [found.lng, found.lat]);
            addEvent('llm', `AI 聚焦告警: ${found.title}`, undefined, '#ef4444');
          }
        }
      }
    }

    return cleaned.trim();
  }, [onLLMCommand, addEvent, aegisDispatch, state.alerts]);

  const handleSend = useCallback(async (overrideMessage?: string) => {
    const userMsg = (overrideMessage || inputVal).trim();
    if (!userMsg || isStreaming) return;

    commandsExecutedRef.current.clear();
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setInputVal('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    addEvent('llm', `调度员指令: ${userMsg.slice(0, 40)}${userMsg.length > 40 ? '...' : ''}`);

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: newMessages.slice(1, -1), stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Network response was not ok');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) accumulated += parsed.error;
            else if (parsed.delta) accumulated += parsed.delta;
          } catch { /* skip */ }
        }

        const cleaned = extractAndExecuteCommands(accumulated, false);
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: cleaned };
          return copy;
        });
      }

      const finalText = extractAndExecuteCommands(accumulated, true);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: finalText };
        return copy;
      });
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: '连接基带核心异常：无法穿透物理网络。请检查后端微服务连接。' };
        return copy;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [inputVal, isStreaming, messages, extractAndExecuteCommands, addEvent]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <div className="absolute right-6 bottom-24 w-[420px] flex flex-col bg-slate-950/80 border border-white/10 rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.9)] z-[100] backdrop-blur-2xl overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900/50 via-slate-900/50 to-sky-900/40 border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-50" />
          </div>
          <span className="text-sky-100 font-bold tracking-widest text-[15px]">御险 · LLM 智能体</span>
          {isStreaming && <span className="text-[10px] text-indigo-300 animate-pulse tracking-wider">推演中...</span>}
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Quick Commands */}
      <div className="px-4 py-2 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
        {QUICK_COMMANDS.map(cmd => (
          <button key={cmd.label} onClick={() => handleSend(cmd.prompt)} disabled={isStreaming}
            className="flex-none text-[11px] px-3 py-1.5 bg-slate-800/60 hover:bg-indigo-800/50 border border-white/5 hover:border-indigo-500/30 text-slate-300 hover:text-indigo-200 rounded-full transition-all disabled:opacity-40 whitespace-nowrap">
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 h-[420px] custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-indigo-600/70 text-white rounded-2xl rounded-br-sm shadow-lg'
                : 'bg-slate-800/70 border border-sky-500/15 text-sky-50 rounded-2xl rounded-tl-sm'
            }`}>
              {msg.content}
              {isStreaming && idx === messages.length - 1 && msg.role === 'assistant' && (
                <span className="inline-block w-[2px] h-4 bg-cyan-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/5 bg-slate-900/50 flex gap-2">
        <input type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="输入调度指令、推演意图..."
          className="flex-1 bg-slate-800/70 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sky-100 placeholder-slate-500 text-sm focus:outline-none transition-colors"
          disabled={isStreaming} />
        {isStreaming ? (
          <button onClick={handleStop} className="bg-red-600/60 hover:bg-red-500/70 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            停止
          </button>
        ) : (
          <button onClick={() => handleSend()} disabled={!inputVal.trim()}
            className="bg-indigo-600/70 hover:bg-indigo-500/80 disabled:bg-slate-700/40 disabled:text-slate-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg">
            发送
          </button>
        )}
      </div>
    </div>
  );
};

export default LLMPanel;
