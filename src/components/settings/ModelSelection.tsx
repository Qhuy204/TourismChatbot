import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Cpu, Volume2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ModelConfig {
  id: string;
  model_type: string;
  model_name: string;
  model_id: string;
  is_default: boolean;
  is_enabled: boolean;
}

export function ModelSelection() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedText2Text, setSelectedText2Text] = useState<string>('');
  const [selectedText2Speech, setSelectedText2Speech] = useState<string>('');

  const fetchModels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_model_configs')
        .select('*')
        .eq('is_enabled', true)
        .order('model_name');

      if (error) throw error;

      // Type assertion since the types.ts is auto-generated
      const modelsData = data as unknown as ModelConfig[];
      setModels(modelsData);

      // Set defaults
      const defaultText2Text = modelsData.find(m => m.model_type === 'text2text' && m.is_default);
      const defaultText2Speech = modelsData.find(m => m.model_type === 'text2speech' && m.is_default);
      
      if (defaultText2Text) setSelectedText2Text(defaultText2Text.model_id);
      if (defaultText2Speech) setSelectedText2Speech(defaultText2Speech.model_id);

      // Load saved preferences from localStorage
      const savedText2Text = localStorage.getItem('selected_text2text_model');
      const savedText2Speech = localStorage.getItem('selected_text2speech_model');
      
      if (savedText2Text && modelsData.some(m => m.model_id === savedText2Text)) {
        setSelectedText2Text(savedText2Text);
      }
      if (savedText2Speech && modelsData.some(m => m.model_id === savedText2Speech)) {
        setSelectedText2Speech(savedText2Speech);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      toast.error('Không thể tải danh sách models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleText2TextChange = (modelId: string) => {
    setSelectedText2Text(modelId);
    localStorage.setItem('selected_text2text_model', modelId);
    toast.success('Đã lưu cài đặt model Text2Text');
  };

  const handleText2SpeechChange = (modelId: string) => {
    setSelectedText2Speech(modelId);
    localStorage.setItem('selected_text2speech_model', modelId);
    toast.success('Đã lưu cài đặt model Text2Speech');
  };

  const text2textModels = models.filter(m => m.model_type === 'text2text');
  const text2speechModels = models.filter(m => m.model_type === 'text2speech');

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Text2Text Models */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Text-to-Text Models (Gemini)
              </CardTitle>
              <CardDescription>
                Chọn model Gemini để sử dụng cho các tác vụ AI
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchModels}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {text2textModels.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Chưa có model nào</p>
          ) : (
            <RadioGroup value={selectedText2Text} onValueChange={handleText2TextChange}>
              <div className="space-y-3">
                {text2textModels.map((model) => (
                  <div
                    key={model.id}
                    className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
                      selectedText2Text === model.model_id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={model.model_id} id={model.id} />
                    <Label htmlFor={model.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{model.model_name}</p>
                          <p className="text-sm text-muted-foreground">{model.model_id}</p>
                        </div>
                        {model.is_default && (
                          <Badge variant="secondary">Mặc định</Badge>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      {/* Text2Speech Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Text-to-Speech Models
          </CardTitle>
          <CardDescription>
            Chọn model để chuyển văn bản thành giọng nói
          </CardDescription>
        </CardHeader>
        <CardContent>
          {text2speechModels.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Chưa có model nào</p>
          ) : (
            <RadioGroup value={selectedText2Speech} onValueChange={handleText2SpeechChange}>
              <div className="space-y-3">
                {text2speechModels.map((model) => (
                  <div
                    key={model.id}
                    className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
                      selectedText2Speech === model.model_id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={model.model_id} id={model.id} />
                    <Label htmlFor={model.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{model.model_name}</p>
                          <p className="text-sm text-muted-foreground">{model.model_id}</p>
                        </div>
                        {model.is_default && (
                          <Badge variant="secondary">Mặc định</Badge>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
