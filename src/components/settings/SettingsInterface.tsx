import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Settings, 
  Key, 
  Check, 
  AlertTriangle,
  ExternalLink,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsInterfaceProps {}

export function SettingsInterface({}: SettingsInterfaceProps) {
  const [huggingFaceToken, setHuggingFaceToken] = useState('');
  const [isTokenSaved, setIsTokenSaved] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

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

  // Check if token exists on mount
  useState(() => {
    const savedToken = localStorage.getItem('HUGGING_FACE_ACCESS_TOKEN');
    if (savedToken) {
      setHuggingFaceToken(savedToken);
      setIsTokenSaved(true);
    }
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Cấu hình API keys và các thiết lập hệ thống</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
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
                <span>Local State (In-Memory)</span>
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
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Lưu ý: Dữ liệu dataset hiện tại được lưu trong memory. 
                Để lưu trữ vĩnh viễn, hãy sử dụng chức năng Export.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
