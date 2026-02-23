import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';

export interface SystemUsage {
  id: string;
  usage_type: string;
  current_value: number;
  max_limit: number;
  warning_threshold: number;
  last_checked_at: string;
}

export interface UsageWarning {
  type: string;
  percentage: number;
  isWarning: boolean;
  isCritical: boolean;
  message: string;
}

export function useSystemUsage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [usageData, setUsageData] = useState<SystemUsage[]>([]);
  const [warnings, setWarnings] = useState<UsageWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Check Supabase connection
  const checkConnection = useCallback(async () => {
    setConnectionStatus('checking');
    try {
      const { error } = await supabase.from('dataset_records').select('id', { count: 'exact', head: true });
      setConnectionStatus(error ? 'disconnected' : 'connected');
      return !error;
    } catch {
      setConnectionStatus('disconnected');
      return false;
    }
  }, []);

  // Fetch usage data and calculate warnings
  const fetchUsage = useCallback(async () => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check connection first
      await checkConnection();

      // Fetch system usage data
      const { data, error } = await supabase
        .from('system_usage')
        .select('*');

      if (error) {
        console.error('Error fetching system usage:', error);
        setLoading(false);
        return;
      }

      // Get actual record count
      const { count: recordCount } = await supabase
        .from('dataset_records')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);

      // Map data and update records_count
      const mappedData: SystemUsage[] = (data || []).map((row: any) => ({
        id: row.id,
        usage_type: row.usage_type,
        current_value: row.usage_type === 'records_count' ? (recordCount || 0) : Number(row.current_value),
        max_limit: Number(row.max_limit),
        warning_threshold: Number(row.warning_threshold),
        last_checked_at: row.last_checked_at,
      }));

      setUsageData(mappedData);

      // Calculate warnings
      const newWarnings: UsageWarning[] = mappedData.map(usage => {
        const percentage = usage.max_limit > 0 ? (usage.current_value / usage.max_limit) * 100 : 0;
        const isWarning = percentage >= usage.warning_threshold;
        const isCritical = percentage >= 95;

        let message = '';
        if (isCritical) {
          message = `${getUsageLabel(usage.usage_type)}: Đã đạt ${percentage.toFixed(1)}% giới hạn! Cần nâng cấp ngay.`;
        } else if (isWarning) {
          message = `${getUsageLabel(usage.usage_type)}: Đạt ${percentage.toFixed(1)}% giới hạn. Cân nhắc nâng cấp.`;
        }

        return {
          type: usage.usage_type,
          percentage,
          isWarning,
          isCritical,
          message,
        };
      });

      setWarnings(newWarnings.filter(w => w.isWarning));
    } catch (error) {
      console.error('Error in fetchUsage:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, checkConnection]);

  // Update usage limits (admin only)
  const updateUsageLimit = useCallback(async (usageType: string, newLimit: number) => {
    if (!user || !isAdmin) return false;

    try {
      const { error } = await supabase
        .from('system_usage')
        .update({ max_limit: newLimit })
        .eq('usage_type', usageType);

      if (error) {
        console.error('Error updating usage limit:', error);
        return false;
      }

      await fetchUsage();
      return true;
    } catch (error) {
      console.error('Error updating usage limit:', error);
      return false;
    }
  }, [user, isAdmin, fetchUsage]);

  // Initial fetch
  useEffect(() => {
    if (user && isAdmin) {
      fetchUsage();
    } else {
      setLoading(false);
    }
  }, [user, isAdmin, fetchUsage]);

  return {
    usageData,
    warnings,
    loading,
    connectionStatus,
    checkConnection,
    fetchUsage,
    updateUsageLimit,
  };
}

function getUsageLabel(type: string): string {
  switch (type) {
    case 'api_calls_daily':
      return 'API Calls (Hàng ngày)';
    case 'storage_mb':
      return 'Storage';
    case 'records_count':
      return 'Số lượng Records';
    default:
      return type;
  }
}
