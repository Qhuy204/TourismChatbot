import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Download, 
  Plus, 
  Play, 
  Square,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Trash2,
  Copy,
  Globe
} from 'lucide-react';
import { DatasetRecord, Scenario } from '@/types/dataset';
import { toast } from 'sonner';

interface CrawlInterfaceProps {
  onAddRecords: (records: DatasetRecord[]) => void;
}

interface CrawlSource {
  id: string;
  name: string;
  url: string;
  type: 'wikipedia' | 'google' | 'custom';
  status: 'pending' | 'crawling' | 'done' | 'error';
  recordsCount?: number;
}

export function CrawlInterface({ onAddRecords }: CrawlInterfaceProps) {
  const [sources, setSources] = useState<CrawlSource[]>([
    { id: '1', name: 'Vietnam Landmarks Wikipedia', url: 'https://vi.wikipedia.org/wiki/Danh_lam_thắng_cảnh', type: 'wikipedia', status: 'pending' },
  ]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [crawledRecords, setCrawledRecords] = useState<DatasetRecord[]>([]);

  const [manualEntry, setManualEntry] = useState({
    entity_name: '',
    city: '',
    district: '',
    topic: 'vietnam_landmark',
    tags: '',
    image_path: '',
    audio_path: '',
    audio_type: 'environment' as 'environment' | 'speech' | 'music',
    audio_transcript: '',
    question: '',
    answer: '',
    scenario: 'text_ask_image' as Scenario,
    answer_format: 'one_sentence' as 'short_phrase' | 'one_sentence' | 'free'
  });

  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceName, setNewSourceName] = useState('');

  const addSource = () => {
    if (!newSourceUrl || !newSourceName) {
      toast.error('Vui lòng nhập URL và tên nguồn');
      return;
    }

    const newSource: CrawlSource = {
      id: Date.now().toString(),
      name: newSourceName,
      url: newSourceUrl,
      type: 'custom',
      status: 'pending'
    };

    setSources([...sources, newSource]);
    setNewSourceUrl('');
    setNewSourceName('');
    toast.success('Đã thêm nguồn crawl');
  };

  const removeSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
  };

  const simulateCrawl = async () => {
    setIsCrawling(true);
    setProgress(0);
    setCrawledRecords([]);

    const mockRecords: DatasetRecord[] = [];
    const totalSteps = sources.length * 5;

    for (let i = 0; i < sources.length; i++) {
      setSources(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'crawling' } : s
      ));

      // Simulate crawling delay
      for (let j = 0; j < 5; j++) {
        await new Promise(r => setTimeout(r, 500));
        setProgress(((i * 5 + j + 1) / totalSteps) * 100);

        const record: DatasetRecord = {
          record_id: `VN_CRAWL_${Date.now()}_${String(mockRecords.length + 1).padStart(4, '0')}`,
          metadata: {
            topic: 'vietnam_landmark',
            entity_name: `Địa danh mẫu ${mockRecords.length + 1}`,
            location: {
              city: ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'][Math.floor(Math.random() * 3)],
              district: 'Quận 1',
              lat_long: [20 + Math.random() * 3, 105 + Math.random() * 5]
            },
            tags: ['architecture', 'historic']
          },
          assets: {
            image_path: `data/images/crawled_${mockRecords.length + 1}.jpg`,
            audio_evidence: null
          },
          qa_items: [{
            qa_id: `qa_crawl_${mockRecords.length + 1}`,
            scenario: 'text_ask_image',
            modality_in: ['image', 'text'],
            query: {
              text: 'Mô tả kiến trúc của địa danh này?',
              audio_query_path: null,
              audio_query_transcript: null
            },
            target: {
              answer: 'Đây là mô tả mẫu được crawl tự động.',
              evidence_source: 'image',
              answer_format: 'one_sentence'
            }
          }],
          status: 'pending'
        };

        mockRecords.push(record);
        setCrawledRecords([...mockRecords]);
      }

      setSources(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'done', recordsCount: 5 } : s
      ));
    }

    setIsCrawling(false);
    toast.success(`Đã crawl ${mockRecords.length} records`);
  };

  const handleManualAdd = () => {
    if (!manualEntry.entity_name || !manualEntry.question || !manualEntry.answer) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    const newRecord: DatasetRecord = {
      record_id: `VN_MANUAL_${Date.now()}`,
      metadata: {
        topic: manualEntry.topic,
        entity_name: manualEntry.entity_name,
        location: {
          city: manualEntry.city || 'Unknown',
          district: manualEntry.district || 'Unknown',
          lat_long: [21.0, 105.8]
        },
        tags: manualEntry.tags.split(',').map(t => t.trim()).filter(Boolean)
      },
      assets: {
        image_path: manualEntry.image_path || null,
        audio_evidence: manualEntry.audio_path ? {
          path: manualEntry.audio_path,
          type: manualEntry.audio_type,
          transcript: manualEntry.audio_transcript,
          duration_sec: 10,
          sr: 16000
        } : null
      },
      qa_items: [{
        qa_id: `qa_manual_${Date.now()}`,
        scenario: manualEntry.scenario,
        modality_in: manualEntry.scenario === 'text_ask_image' ? ['image', 'text'] :
                     manualEntry.scenario === 'audio_ask_image' ? ['image', 'audio'] :
                     manualEntry.scenario === 'text_ask_audio' ? ['audio', 'text'] : ['audio'],
        query: {
          text: manualEntry.scenario.startsWith('text') ? manualEntry.question : null,
          audio_query_path: manualEntry.scenario.startsWith('audio') ? `data/queries/manual_${Date.now()}.wav` : null,
          audio_query_transcript: manualEntry.scenario.startsWith('audio') ? manualEntry.question : null
        },
        target: {
          answer: manualEntry.answer,
          evidence_source: manualEntry.scenario.includes('image') ? 'image' : 'audio',
          answer_format: manualEntry.answer_format
        }
      }],
      status: 'pending'
    };

    onAddRecords([newRecord]);
    toast.success('Đã thêm record mới');

    // Reset form
    setManualEntry({
      entity_name: '',
      city: '',
      district: '',
      topic: 'vietnam_landmark',
      tags: '',
      image_path: '',
      audio_path: '',
      audio_type: 'environment',
      audio_transcript: '',
      question: '',
      answer: '',
      scenario: 'text_ask_image',
      answer_format: 'one_sentence'
    });
  };

  const importCrawledRecords = () => {
    if (crawledRecords.length === 0) {
      toast.error('Không có records để import');
      return;
    }
    onAddRecords(crawledRecords);
    setCrawledRecords([]);
    toast.success(`Đã import ${crawledRecords.length} records vào dataset`);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Crawl & Import Data</h2>
        <p className="text-muted-foreground">Crawl dữ liệu từ nguồn hoặc nhập thủ công theo format</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Crawl Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Nguồn Crawl
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {sources.map((source) => (
                <div 
                  key={source.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{source.type}</Badge>
                    <div>
                      <p className="font-medium text-sm">{source.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-48">{source.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {source.status === 'done' && (
                      <Badge className="bg-accent text-accent-foreground">
                        {source.recordsCount} records
                      </Badge>
                    )}
                    {source.status === 'crawling' && (
                      <Badge className="bg-chart-3/10 text-chart-3 animate-pulse">
                        Crawling...
                      </Badge>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeSource(source.id)}
                      disabled={isCrawling}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Thêm nguồn mới</Label>
              <Input
                placeholder="Tên nguồn"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
              <Input
                placeholder="URL"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
              />
              <Button onClick={addSource} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Thêm nguồn
              </Button>
            </div>

            <Separator />

            {isCrawling ? (
              <div className="space-y-3">
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Đã crawl {crawledRecords.length} records...
                  </span>
                  <Button variant="destructive" size="sm" onClick={() => setIsCrawling(false)}>
                    <Square className="h-4 w-4 mr-2" />
                    Dừng
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={simulateCrawl} className="w-full" disabled={sources.length === 0}>
                <Play className="h-4 w-4 mr-2" />
                Bắt đầu Crawl
              </Button>
            )}

            {crawledRecords.length > 0 && !isCrawling && (
              <Alert className="bg-accent/50">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Crawl hoàn tất</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{crawledRecords.length} records sẵn sàng import</span>
                  <Button size="sm" onClick={importCrawledRecords}>
                    <Download className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nhập thủ công
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Entity Name *</Label>
                <Input
                  value={manualEntry.entity_name}
                  onChange={(e) => setManualEntry({ ...manualEntry, entity_name: e.target.value })}
                  placeholder="Ví dụ: Chùa Một Cột"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={manualEntry.city}
                  onChange={(e) => setManualEntry({ ...manualEntry, city: e.target.value })}
                  placeholder="Hà Nội"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>District</Label>
                <Input
                  value={manualEntry.district}
                  onChange={(e) => setManualEntry({ ...manualEntry, district: e.target.value })}
                  placeholder="Ba Đình"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Topic</Label>
                <Select 
                  value={manualEntry.topic}
                  onValueChange={(v) => setManualEntry({ ...manualEntry, topic: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vietnam_landmark">Vietnam Landmark</SelectItem>
                    <SelectItem value="vietnam_temple">Vietnam Temple</SelectItem>
                    <SelectItem value="vietnam_cuisine">Vietnam Cuisine</SelectItem>
                    <SelectItem value="vietnam_nature">Vietnam Nature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags (comma separated)</Label>
                <Input
                  value={manualEntry.tags}
                  onChange={(e) => setManualEntry({ ...manualEntry, tags: e.target.value })}
                  placeholder="architecture, historic"
                  className="mt-1"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Image Path</Label>
                <Input
                  value={manualEntry.image_path}
                  onChange={(e) => setManualEntry({ ...manualEntry, image_path: e.target.value })}
                  placeholder="data/images/example.jpg"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Audio Path</Label>
                <Input
                  value={manualEntry.audio_path}
                  onChange={(e) => setManualEntry({ ...manualEntry, audio_path: e.target.value })}
                  placeholder="data/audio/example.wav"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Audio Type</Label>
                <Select 
                  value={manualEntry.audio_type}
                  onValueChange={(v) => setManualEntry({ ...manualEntry, audio_type: v as 'environment' | 'speech' | 'music' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="speech">Speech</SelectItem>
                    <SelectItem value="music">Music</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label>Scenario *</Label>
                <Select 
                  value={manualEntry.scenario}
                  onValueChange={(v: Scenario) => setManualEntry({ ...manualEntry, scenario: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text_ask_image">Text → Image</SelectItem>
                    <SelectItem value="audio_ask_image">Audio → Image</SelectItem>
                    <SelectItem value="text_ask_audio">Text → Audio</SelectItem>
                    <SelectItem value="audio_ask_audio">Audio → Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Question *</Label>
                <Textarea
                  value={manualEntry.question}
                  onChange={(e) => setManualEntry({ ...manualEntry, question: e.target.value })}
                  placeholder="Nhập câu hỏi..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>Answer *</Label>
                <Textarea
                  value={manualEntry.answer}
                  onChange={(e) => setManualEntry({ ...manualEntry, answer: e.target.value })}
                  placeholder="Nhập câu trả lời..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label>Answer Format</Label>
                <Select 
                  value={manualEntry.answer_format}
                  onValueChange={(v) => setManualEntry({ ...manualEntry, answer_format: v as 'short_phrase' | 'one_sentence' | 'free' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short_phrase">Short Phrase</SelectItem>
                    <SelectItem value="one_sentence">One Sentence</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleManualAdd} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Thêm Record
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
