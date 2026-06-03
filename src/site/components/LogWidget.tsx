// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Terminal, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface LogWidgetProps {
  logs: LogEntry[];
  onClear: () => void;
}

export default function LogWidget({ logs, onClear }: LogWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isExpanded && logs.length > 0) {
      setUnreadCount(prev => prev + 1);
    }
  }, [logs.length]);

  useEffect(() => {
    if (isExpanded) {
      setUnreadCount(0);
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isExpanded, logs]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-emerald-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-amber-600';
      default:
        return 'text-slate-600';
    }
  };

  const getLogBg = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all z-50 group"
      >
        <Terminal className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 transition-all duration-300 ${
        isExpanded ? 'w-96 h-96' : 'w-80'
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          <span className="font-semibold">Logs d'analyse</span>
          {logs.length > 0 && (
            <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {logs.length > 0 && (
            <button
              onClick={onClear}
              className="p-1.5 hover:bg-blue-700 rounded transition-colors"
              title="Vider les logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-blue-700 rounded transition-colors"
            title={isExpanded ? 'Réduire' : 'Agrandir'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-blue-700 rounded transition-colors"
            title="Minimiser"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className={`overflow-y-auto ${
          isExpanded ? 'h-[calc(100%-3rem)]' : 'max-h-60'
        }`}
      >
        {logs.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun log pour le moment</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border text-sm ${getLogBg(log.type)} animate-in slide-in-from-bottom-2 duration-200`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs text-slate-500 shrink-0">
                    {log.timestamp.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <p className={`flex-1 ${getLogColor(log.type)} font-medium leading-tight`}>
                    {log.message}
                  </p>
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
