import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Key,
  Plus,
  Trash2,
  Loader2,
  Shield,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  HardDrive,
  Activity,
  Zap,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = 'http://localhost:3001';

interface ApiKey {
  id: string;
  key_name: string;
  provider: string;
  is_active: boolean;
  created_at: string;
  is_valid?: boolean;
  last_error?: string;
}

interface SystemStatus {
  memory: {
    percent: number;
    used_mb: number;
    total_mb: number;
    available_mb: number;
  };
  gemini?: {
    keys: Array<{ key_id: string; is_valid: boolean; requests_today: number }>;
    total_keys: number;
  };
  huggingface?: {
    keys: Array<{ key_id: string; is_valid: boolean; requests_today: number }>;
    total_keys: number;
  };
}

export function ApiKeyManagement() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [apiConnected, setApiConnected] = useState(false);

  // Add form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newProvider, setNewProvider] = useState('gemini');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Fetch system status from Python API
  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api-keys/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
        setApiConnected(true);
      } else {
        setApiConnected(false);
      }
    } catch {
      setApiConnected(false);
    }
  }, []);

  // Fetch keys from Supabase
  const fetchKeys = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-keys`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'list' }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setKeys(data.keys || []);
    } catch (error) {
      console.error('Error fetching keys:', error);
      // Use local storage as fallback
      const localKeys = localStorage.getItem('api_keys');
      if (localKeys) {
        setKeys(JSON.parse(localKeys));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSystemStatus]);

  const handleAddKey = async () => {
    if (!newKeyName.trim() || !newApiKey.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setIsSubmitting(true);
    setIsValidating(true);

    try {
      // Validate with Python API first
      const validateRes = await fetch(`${API_BASE_URL}/api-keys/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider, api_key: newApiKey })
      });

      const validateData = await validateRes.json();

      if (!validateData.valid) {
        toast.error(`Key không hợp lệ: ${validateData.message}`);
        setIsSubmitting(false);
        setIsValidating(false);
        return;
      }

      // Add to Python API for tracking
      await fetch(`${API_BASE_URL}/api-keys/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider, api_key: newApiKey })
      });

      // Try to save to Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-keys`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'add',
                key_name: newKeyName,
                api_key: newApiKey,
                provider: newProvider,
              }),
            }
          );
        }
      } catch {
        // Fallback to localStorage
        const localKeys = JSON.parse(localStorage.getItem('api_keys') || '[]');
        localKeys.push({
          id: Date.now().toString(),
          key_name: newKeyName,
          provider: newProvider,
          is_active: true,
          created_at: new Date().toISOString(),
          is_valid: true
        });
        localStorage.setItem('api_keys', JSON.stringify(localKeys));
      }

      toast.success(`Đã thêm ${newProvider === 'gemini' ? 'Gemini' : 'HuggingFace'} API key: ${validateData.message}`);
      setIsAddDialogOpen(false);
      setNewKeyName('');
      setNewApiKey('');
      fetchKeys();
      fetchSystemStatus();

    } catch (error: any) {
      toast.error(error.message || 'Không thể thêm API key');
    } finally {
      setIsSubmitting(false);
      setIsValidating(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKeyId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-keys`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'delete', id: deleteKeyId }),
          }
        );
      }

      toast.success('Đã xóa API key');
      setDeleteKeyId(null);
      fetchKeys();
    } catch (error: any) {
      toast.error(error.message || 'Không thể xóa API key');
    }
  };

  const handleToggleKey = async (id: string, isActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-keys`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'toggle', id, is_active: isActive }),
          }
        );
      }

      setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: isActive } : k));
      toast.success(isActive ? 'Đã kích hoạt API key' : 'Đã vô hiệu hóa API key');
    } catch (error: any) {
      toast.error(error.message || 'Không thể cập nhật API key');
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'gemini': return 'Gemini';
      case 'huggingface': return 'HuggingFace';
      case 'vertex_ai': return 'Gemini';
      case 'google_cloud': return 'HuggingFace';
      default: return provider;
    }
  };

  const getMemoryColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* System Status Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Real-time API và memory monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Memory */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Memory</span>
              </div>
              {systemStatus?.memory ? (
                <>
                  <div className="text-2xl font-bold">{systemStatus.memory.percent.toFixed(0)}%</div>
                  <Progress
                    value={systemStatus.memory.percent}
                    className={`h-2 mt-2 ${getMemoryColor(systemStatus.memory.percent)}`}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {(systemStatus.memory.used_mb / 1024).toFixed(1)} / {(systemStatus.memory.total_mb / 1024).toFixed(1)} GB
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">API Offline</div>
              )}
            </div>

            {/* Gemini Keys */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Gemini</span>
              </div>
              <div className="text-2xl font-bold">
                {systemStatus?.gemini?.total_keys || keys.filter(k => k.provider === 'gemini' || k.provider === 'vertex_ai').length}
              </div>
              <div className="text-xs text-muted-foreground">Active keys</div>
            </div>

            {/* HuggingFace Keys */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">HuggingFace</span>
              </div>
              <div className="text-2xl font-bold">
                {systemStatus?.huggingface?.total_keys || keys.filter(k => k.provider === 'huggingface' || k.provider === 'google_cloud').length}
              </div>
              <div className="text-xs text-muted-foreground">Active keys</div>
            </div>

            {/* API Status */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">API Server</span>
              </div>
              <div className="flex items-center gap-2">
                {apiConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">Online</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-600 font-medium">Offline</span>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">localhost:3001</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Quản lý Gemini và HuggingFace API keys
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchKeys(); fetchSystemStatus(); }} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Thêm API Key</DialogTitle>
                    <DialogDescription>
                      Key sẽ được validate trước khi lưu
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select value={newProvider} onValueChange={setNewProvider}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Gemini (Google AI)</SelectItem>
                          <SelectItem value="huggingface">HuggingFace</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tên định danh</Label>
                      <Input
                        placeholder="VD: My Gemini Key"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder={newProvider === 'gemini' ? 'AIzaSy...' : 'hf_...'}
                          value={newApiKey}
                          onChange={(e) => setNewApiKey(e.target.value)}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button onClick={handleAddKey} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {isValidating ? 'Đang validate...' : 'Đang lưu...'}
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4 mr-2" />
                          Thêm
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có API key</p>
              <p className="text-sm">Thêm Gemini hoặc HuggingFace key để bắt đầu</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.key_name}</TableCell>
                    <TableCell>
                      <Badge variant={key.provider === 'gemini' || key.provider === 'vertex_ai' ? 'default' : 'secondary'}>
                        {getProviderLabel(key.provider)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={key.is_active}
                          onCheckedChange={(checked) => handleToggleKey(key.id, checked)}
                        />
                        <span className={key.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(key.created_at).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteKeyId(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteKeyId} onOpenChange={(open) => !open && setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey} className="bg-destructive">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
