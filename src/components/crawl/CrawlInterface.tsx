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
  Trash2,
  Globe
} from 'lucide-react';
import { DatasetRecord } from '@/types/dataset';
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

type QAType = 'ask_image' | 'ask_audio' | 'ask_both';

export function CrawlInterface({ onAddRecords }: CrawlInterfaceProps) {
  const [sources, setSources] = useState<CrawlSource[]>([
    { id: '1', name: 'Vietnam Landmarks Wikipedia', url: 'https://vi.wikipedia.org/wiki/Danh_lam_thắng_cảnh', type: 'wikipedia', status: 'pending' },
  ]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [crawledRecords, setCrawledRecords] = useState<DatasetRecord[]>([]);

  const [manualEntry, setManualEntry] = useState({
    landmark_name: '',
    city: '',
    district: '',
    tags: '',
    image_path: '',
    audio_path: '',
    audio_transcript: '',
    question: '',
    answer: '',
    qa_type: 'ask_image' as QAType
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

      for (let j = 0; j < 5; j++) {
        await new Promise(r => setTimeout(r, 500));
        setProgress(((i * 5 + j + 1) / totalSteps) * 100);

        const idNumber = String(mockRecords.length + 1).padStart(3, '0');
        const record: DatasetRecord = {
          id: `VN_CRAWL_${idNumber}_00`,
          timestamp: new Date().toISOString(),
          paths: {
            image: `images/crawled/VN_CRAWL_${idNumber}_00.jpg`
          },
          metadata: {
            landmark_name: `Địa danh mẫu ${mockRecords.length + 1}`,
            location: {
              city: ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'][Math.floor(Math.random() * 3)],
              district: 'Quận 1',
              gps: {
                lat: 20 + Math.random() * 3,
                lon: 105 + Math.random() * 5
              }
            }
          },
          qa_pairs: [{
            q: 'Mô tả kiến trúc của địa danh này?',
            a: 'Đây là mô tả mẫu được crawl tự động.',
            type: 'ask_image',
            paths: {
              question_audio: '',
              answer_audio: ''
            },
            audio_meta: {
              q_voice: { id: 'vi-VN-HoaiMyNeural' },
              a_voice: { id: 'vi-VN-HoaiMyNeural' }
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
    if (!manualEntry.landmark_name || !manualEntry.question || !manualEntry.answer) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    const idNumber = String(Date.now()).slice(-6);
    const newRecord: DatasetRecord = {
      id: `VN_MANUAL_${idNumber}`,
      timestamp: new Date().toISOString(),
      paths: {
        image: manualEntry.image_path || '',
        ...(manualEntry.audio_path && { audio_evidence: manualEntry.audio_path })
      },
      metadata: {
        landmark_name: manualEntry.landmark_name,
        location: {
          city: manualEntry.city || 'Unknown',
          district: manualEntry.district || '',
          gps: { lat: 21.0, lon: 105.8 }
        },
        ...(manualEntry.audio_transcript && {
          audio_spec: {
            transcript: manualEntry.audio_transcript,
            voice_id: 'vi-VN-NamMinhNeural'
          }
        })
      },
      qa_pairs: [{
        q: manualEntry.question,
        a: manualEntry.answer,
        type: manualEntry.qa_type,
        paths: {
          question_audio: '',
          answer_audio: ''
        },
        audio_meta: {
          q_voice: { id: 'vi-VN-HoaiMyNeural' },
          a_voice: { id: 'vi-VN-HoaiMyNeural' }
        }
      }],
      status: 'pending'
    };

    onAddRecords([newRecord]);
    toast.success('Đã thêm record mới');

    setManualEntry({
      landmark_name: '',
      city: '',
      district: '',
      tags: '',
      image_path: '',
      audio_path: '',
      audio_transcript: '',
      question: '',
      answer: '',
      qa_type: 'ask_image'
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
        <p className="text-muted-foreground">Crawl dữ liệu từ nguồn hoặc nhập thủ công</p>
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
                <div key={source.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{source.type}</Badge>
                    <div>
                      <p className="font-medium text-sm">{source.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-48">{source.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {source.status === 'done' && (
                      <Badge className="bg-accent text-accent-foreground">{source.recordsCount} records</Badge>
                    )}
                    {source.status === 'crawling' && (
                      <Badge className="bg-chart-3/10 text-chart-3 animate-pulse">Crawling...</Badge>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeSource(source.id)} disabled={isCrawling}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Thêm nguồn mới</Label>
              <Input placeholder="Tên nguồn" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} />
              <Input placeholder="URL" value={newSourceUrl} onChange={(e) => setNewSourceUrl(e.target.value)} />
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
                  <span className="text-sm text-muted-foreground">Đã crawl {crawledRecords.length} records...</span>
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
                <Label>Landmark Name *</Label>
                <Input
                  value={manualEntry.landmark_name}
                  onChange={(e) => setManualEntry({ ...manualEntry, landmark_name: e.target.value })}
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
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Image Path</Label>
                <Input
                  value={manualEntry.image_path}
                  onChange={(e) => setManualEntry({ ...manualEntry, image_path: e.target.value })}
                  placeholder="images/example.jpg"
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label>Audio Path</Label>
                <Input
                  value={manualEntry.audio_path}
                  onChange={(e) => setManualEntry({ ...manualEntry, audio_path: e.target.value })}
                  placeholder="audio_evidence/example.wav"
                  className="mt-1"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label>QA Type *</Label>
                <Select 
                  value={manualEntry.qa_type}
                  onValueChange={(v: QAType) => setManualEntry({ ...manualEntry, qa_type: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ask_image">ask_image</SelectItem>
                    <SelectItem value="ask_audio">ask_audio</SelectItem>
                    <SelectItem value="ask_both">ask_both</SelectItem>
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
