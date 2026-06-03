// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, AlertCircle, Info, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface Log {
  id: string;
  function_name: string;
  level: string;
  message: string;
  metadata: any;
  created_at: string;
}

export default function QualiopiLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('function_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'ALL') {
        query = query.eq('level', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-50 border-red-200';
      case 'WARNING':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Logs des fonctions</h1>

          <div className="flex gap-2 mb-6">
            {['ALL', 'INFO', 'WARNING', 'ERROR'].map((level) => (
              <button
                key={level}
                onClick={() => {
                  setFilter(level);
                  fetchLogs();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Chargement des logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              Aucun log trouvé
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 ${getLevelColor(log.level)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getLevelIcon(log.level)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {log.function_name}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            log.level === 'ERROR' ? 'bg-red-100 text-red-800' :
                            log.level === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {log.level}
                          </span>
                        </div>

                        <p className="text-gray-900 mb-2">{log.message}</p>

                        {log.metadata?.aiResponse && (
                          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <p className="text-xs font-semibold text-emerald-800 uppercase mb-2">Données extraites par IA</p>
                            <div className="space-y-1 text-sm">
                              {log.metadata.aiResponse.title && (
                                <div>
                                  <span className="font-semibold text-gray-700">Titre:</span>{' '}
                                  <span className="text-gray-900">{log.metadata.aiResponse.title}</span>
                                </div>
                              )}
                              {log.metadata.aiResponse.duration_days && (
                                <div>
                                  <span className="font-semibold text-gray-700">Durée:</span>{' '}
                                  <span className="text-gray-900">{log.metadata.aiResponse.duration_days} jour(s)</span>
                                </div>
                              )}
                              {log.metadata.aiResponse.description && (
                                <div>
                                  <span className="font-semibold text-gray-700">Description:</span>{' '}
                                  <span className="text-gray-900">{log.metadata.aiResponse.description.substring(0, 150)}...</span>
                                </div>
                              )}
                              {log.metadata.aiResponse.meta_json?.trainer && (
                                <div>
                                  <span className="font-semibold text-gray-700">Formateur:</span>{' '}
                                  <span className="text-gray-900">{log.metadata.aiResponse.meta_json.trainer}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(log.created_at).toLocaleString('fr-FR')}
                          </div>
                        </div>

                        {hasMetadata && (
                          <div className="mt-3">
                            <button
                              onClick={() => toggleExpand(log.id)}
                              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Masquer les détails
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  Afficher les détails
                                </>
                              )}
                            </button>

                            {isExpanded && (
                              <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
