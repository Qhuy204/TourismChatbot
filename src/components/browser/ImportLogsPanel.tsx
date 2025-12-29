import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { getImportLogs, subscribeToLogs, clearImportLogs, ImportLogEntry } from '@/lib/importLogs';

export function ImportLogsPanel() {
  const [logs, setLogs] = useState<ImportLogEntry[]>(getImportLogs());

  useEffect(() => {
    return subscribeToLogs(setLogs);
  }, []);

  const getLevelIcon = (level: ImportLogEntry['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-chart-4" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-accent-foreground" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getLevelBadge = (level: ImportLogEntry['level']) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge className="bg-chart-4/10 text-chart-4">Warning</Badge>;
      case 'success':
        return <Badge className="bg-accent text-accent-foreground">Success</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5" />
            Import Logs
          </CardTitle>
          {logs.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearImportLogs}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-hidden">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có logs</p>
              <p className="text-sm">Logs sẽ hiển thị khi import data</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full pr-4">
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border ${
                    log.level === 'error'
                      ? 'bg-destructive/5 border-destructive/20'
                      : log.level === 'warning'
                      ? 'bg-chart-4/5 border-chart-4/20'
                      : log.level === 'success'
                      ? 'bg-accent/50 border-accent'
                      : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">{getLevelIcon(log.level)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getLevelBadge(log.level)}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(log.timestamp)}
                        </span>
                        {log.recordId && (
                          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {log.recordId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1">{log.message}</p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-1 break-all">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
