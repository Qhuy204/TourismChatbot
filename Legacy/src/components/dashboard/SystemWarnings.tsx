import { useSystemUsage } from '@/hooks/useSystemUsage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, RefreshCw, Database, Wifi, WifiOff, HardDrive, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function SystemWarnings() {
  const { usageData, warnings, loading, connectionStatus, fetchUsage, checkConnection } = useSystemUsage();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getUsageIcon = (type: string) => {
    switch (type) {
      case 'api_calls_daily':
        return <Activity className="h-4 w-4" />;
      case 'storage_mb':
        return <HardDrive className="h-4 w-4" />;
      case 'records_count':
        return <Database className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getUsageLabel = (type: string) => {
    switch (type) {
      case 'api_calls_daily':
        return 'API Calls (Hàng ngày)';
      case 'storage_mb':
        return 'Storage (MB)';
      case 'records_count':
        return 'Số lượng Records';
      default:
        return type;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-destructive';
    if (percentage >= 80) return 'bg-chart-4';
    return 'bg-primary';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchUsage}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <Wifi className="h-4 w-4 text-accent-foreground" />
            ) : connectionStatus === 'disconnected' ? (
              <WifiOff className="h-4 w-4 text-destructive" />
            ) : (
              <Wifi className="h-4 w-4 text-muted-foreground animate-pulse" />
            )}
            <span className="text-sm font-medium">Supabase Connection</span>
          </div>
          <Badge
            variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
            className={connectionStatus === 'connected' ? 'bg-accent text-accent-foreground' : ''}
          >
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
          </Badge>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning) => (
              <Alert key={warning.type} variant={warning.isCritical ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm font-medium">
                  {warning.isCritical ? 'Cảnh báo nghiêm trọng!' : 'Cảnh báo'}
                </AlertTitle>
                <AlertDescription className="text-sm">
                  {warning.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Usage Stats */}
        <div className="space-y-3">
          {usageData.map((usage) => {
            const percentage = usage.max_limit > 0 ? (usage.current_value / usage.max_limit) * 100 : 0;
            
            return (
              <div key={usage.usage_type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getUsageIcon(usage.usage_type)}
                    <span>{getUsageLabel(usage.usage_type)}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {usage.current_value.toLocaleString()} / {usage.max_limit.toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <Progress 
                    value={Math.min(percentage, 100)} 
                    className="h-2"
                  />
                  <div 
                    className={`absolute inset-0 h-2 rounded-full ${getProgressColor(percentage)}`} 
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {percentage.toFixed(1)}%
                </p>
              </div>
            );
          })}
        </div>

        {/* All Good Message */}
        {warnings.length === 0 && connectionStatus === 'connected' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 text-accent-foreground">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Hệ thống hoạt động bình thường</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
