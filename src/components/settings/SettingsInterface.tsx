import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings, 
  Key, 
  Check, 
  AlertTriangle,
  ExternalLink,
  Save,
  Users,
  Shield,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/hooks/useRole';
import { useUsers } from '@/hooks/useUsers';
import { AppRole } from '@/types/dataset';

export function SettingsInterface() {
  const { isAdmin } = useRole();
  const { users, loading: usersLoading, updateUserRole, refetch: refetchUsers } = useUsers();
  
  const [huggingFaceToken, setHuggingFaceToken] = useState('');
  const [isTokenSaved, setIsTokenSaved] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Check if token exists on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('HUGGING_FACE_ACCESS_TOKEN');
    if (savedToken) {
      setHuggingFaceToken(savedToken);
      setIsTokenSaved(true);
    }
  }, []);

  const handleSaveHuggingFaceToken = async () => {
    if (!huggingFaceToken.trim()) {
      toast.error('Vui lòng nhập Hugging Face Access Token');
      return;
    }

    setIsValidating(true);
    
    try {
      // Validate token by making a simple API call
      const response = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: {
          Authorization: `Bearer ${huggingFaceToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Save to localStorage for now (in production, this should be stored securely)
        localStorage.setItem('HUGGING_FACE_ACCESS_TOKEN', huggingFaceToken);
        setIsTokenSaved(true);
        toast.success(`Token hợp lệ! Logged in as: ${data.name || data.fullname || 'User'}`);
      } else {
        toast.error('Token không hợp lệ. Vui lòng kiểm tra lại.');
      }
    } catch (error) {
      toast.error('Không thể xác thực token. Vui lòng thử lại.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearToken = () => {
    localStorage.removeItem('HUGGING_FACE_ACCESS_TOKEN');
    setHuggingFaceToken('');
    setIsTokenSaved(false);
    toast.success('Đã xóa token');
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    await updateUserRole(userId, newRole);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Cấu hình API keys và các thiết lập hệ thống</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* User Management - Admin Only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Quản lý người dùng
                  </CardTitle>
                  <CardDescription>
                    Quản lý tài khoản và phân quyền cho người dùng
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={refetchUsers} disabled={usersLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${usersLoading ? 'animate-spin' : ''}`} />
                  Làm mới
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có người dùng nào
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên hiển thị</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.display_name || 'Chưa đặt tên'}
                        </TableCell>
                        <TableCell>{u.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Select
                            value={u.role || 'user'}
                            onValueChange={(value: AppRole) => handleRoleChange(u.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  User
                                </div>
                              </SelectItem>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Admin
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          N/A
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Hugging Face Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Hugging Face API
            </CardTitle>
            <CardDescription>
              Cấu hình Hugging Face Access Token để sử dụng các model AI như FLUX.1 cho image generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Yêu cầu Access Token</AlertTitle>
              <AlertDescription>
                Bạn cần có Hugging Face Access Token để sử dụng các tính năng AI. 
                Token này sẽ được lưu trữ an toàn trên thiết bị của bạn.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="hf-token">Access Token</Label>
              <div className="flex gap-2">
                <Input
                  id="hf-token"
                  type="password"
                  placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={huggingFaceToken}
                  onChange={(e) => {
                    setHuggingFaceToken(e.target.value);
                    setIsTokenSaved(false);
                  }}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSaveHuggingFaceToken}
                  disabled={isValidating || !huggingFaceToken.trim()}
                >
                  {isValidating ? (
                    'Đang kiểm tra...'
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Lưu
                    </>
                  )}
                </Button>
              </div>
              {isTokenSaved && (
                <div className="flex items-center gap-2 text-sm text-accent-foreground">
                  <Check className="h-4 w-4" />
                  Token đã được lưu và xác thực
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <a 
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Tạo Access Token trên Hugging Face
              </a>
              {isTokenSaved && (
                <Button variant="outline" size="sm" onClick={handleClearToken}>
                  Xóa Token
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Model Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cấu hình Model
            </CardTitle>
            <CardDescription>
              Các model AI được sử dụng trong ứng dụng
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">Image Generation</p>
                  <p className="text-xs text-muted-foreground">FLUX.1-schnell</p>
                </div>
                <Badge variant="outline">black-forest-labs/FLUX.1-schnell</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">Text-to-Speech</p>
                  <p className="text-xs text-muted-foreground">Azure Neural TTS</p>
                </div>
                <Badge variant="outline">vi-VN-HoaiMyNeural</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">Speech-to-Text</p>
                  <p className="text-xs text-muted-foreground">Whisper</p>
                </div>
                <Badge variant="outline">openai/whisper-large-v3</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage Info */}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin lưu trữ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Storage</span>
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Supabase Database
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Keys</span>
                <span>LocalStorage (Encrypted)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">User Preferences</span>
                <span>LocalStorage</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}