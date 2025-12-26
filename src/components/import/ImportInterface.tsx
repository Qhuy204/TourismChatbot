import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  FileJson,
  Database,
  CheckCircle2,
  Trash2,
  Download,
  Eye,
  Loader2,
  FolderOpen,
  Key,
} from 'lucide-react';
import { DatasetRecord, QAPair } from '@/types/dataset';
import { toast } from 'sonner';

interface ImportInterfaceProps {
  onAddRecords: (records: DatasetRecord[]) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  parsedData: any[];
  detectedType: string;
}

interface HuggingFaceRepo {
  id: string;
  name: string;
  url: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  recordsCount?: number;
  error?: string;
}

// Convert any input format to the standard DatasetRecord format
function convertToDatasetRecord(item: any, index: number): DatasetRecord {
  // If already in correct format
  if (item.id && item.paths && item.metadata && item.qa_pairs) {
    return {
      ...item,
      status: item.status || 'pending'
    };
  }

  // Generate ID
  const idNumber = String(index + 1).padStart(3, '0');
  const id = item.id || `VN_LM_2025_${idNumber}_00`;

  // Extract landmark name
  const landmarkName = item.metadata?.landmark_name ||
    item.metadata?.geographic_info?.location_name ||
    item.metadata?.entity_name ||
    item.geographic_info?.location_name ||
    item.entity_name ||
    item.landmark_name ||
    'Unknown';

  // Extract location
  const city = item.metadata?.location?.city ||
    item.metadata?.geographic_info?.city ||
    item.geographic_info?.city ||
    item.city ||
    '';
  
  const district = item.metadata?.location?.district ||
    item.metadata?.geographic_info?.district ||
    item.geographic_info?.district ||
    item.district ||
    '';

  // Extract GPS
  const gpsLat = item.metadata?.location?.gps?.lat ||
    item.metadata?.geographic_info?.lat ||
    item.geographic_info?.lat ||
    item.lat ||
    0;
  
  const gpsLon = item.metadata?.location?.gps?.lon ||
    item.metadata?.geographic_info?.lon ||
    item.geographic_info?.lon ||
    item.lon ||
    0;

  // Extract paths
  const imagePath = item.paths?.image ||
    item.image_path ||
    item.file_path ||
    '';
  
  const audioEvidencePath = item.paths?.audio_evidence ||
    item.audio_evidence_path ||
    '';

  // Extract image spec
  const imageSpec = item.metadata?.image_spec || {
    original_url: item.metadata?.geographic_info?.page_url || item.image_url || '',
    license: item.metadata?.geographic_info?.license_info || 'CC BY-SA 4.0'
  };

  // Extract audio spec
  const audioSpec = item.metadata?.audio_spec || (item.audio_transcript ? {
    transcript: item.audio_transcript,
    voice_id: 'vi-VN-NamMinhNeural'
  } : undefined);

  // Convert QA pairs
  let qaPairs: QAPair[] = [];
  
  if (item.qa_pairs && Array.isArray(item.qa_pairs)) {
    qaPairs = item.qa_pairs.map((qa: any, qaIdx: number) => ({
      q: qa.q || qa.question || '',
      a: qa.a || qa.answer || qa.answers?.[0] || '',
      type: qa.type || 'ask_image',
      paths: qa.paths || {
        question_audio: '',
        answer_audio: ''
      },
      audio_meta: qa.audio_meta || {
        q_voice: { id: 'vi-VN-HoaiMyNeural' },
        a_voice: { id: 'vi-VN-HoaiMyNeural' }
      }
    }));
  } else if (item.vqa_pairs && Array.isArray(item.vqa_pairs)) {
    qaPairs = item.vqa_pairs.map((qa: any, qaIdx: number) => ({
      q: qa.question || '',
      a: qa.answers?.[0] || qa.answer || '',
      type: 'ask_image' as const,
      paths: {
        question_audio: '',
        answer_audio: ''
      },
      audio_meta: {
        q_voice: { id: 'vi-VN-HoaiMyNeural' },
        a_voice: { id: 'vi-VN-HoaiMyNeural' }
      }
    }));
  }

  const record: DatasetRecord = {
    id,
    timestamp: item.timestamp || new Date().toISOString(),
    paths: {
      image: imagePath,
      ...(audioEvidencePath && { audio_evidence: audioEvidencePath })
    },
    metadata: {
      landmark_name: landmarkName,
      location: {
        city,
        district,
        gps: {
          lat: typeof gpsLat === 'number' ? gpsLat : parseFloat(gpsLat) || 0,
          lon: typeof gpsLon === 'number' ? gpsLon : parseFloat(gpsLon) || 0
        }
      },
      image_spec: imageSpec,
      ...(audioSpec && { audio_spec: audioSpec })
    },
    qa_pairs: qaPairs,
    status: 'pending'
  };

  return record;
}

export function ImportInterface({ onAddRecords }: ImportInterfaceProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedRecords, setProcessedRecords] = useState<DatasetRecord[]>([]);
  const [previewRecord, setPreviewRecord] = useState<DatasetRecord | null>(null);

  // Hugging Face state
  const [hfRepoUrl, setHfRepoUrl] = useState('');
  const [hfRepos, setHfRepos] = useState<HuggingFaceRepo[]>([]);
  const [hfRecords, setHfRecords] = useState<DatasetRecord[]>([]);
  const [isLoadingHf, setIsLoadingHf] = useState(false);
  const [hasHfToken, setHasHfToken] = useState(false);

  // Check for HF token on mount
  useEffect(() => {
    const token = localStorage.getItem('HUGGING_FACE_ACCESS_TOKEN');
    setHasHfToken(!!token);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        let parsedData: any[] = [];
        let detectedType = 'unknown';

        if (file.name.endsWith('.jsonl')) {
          parsedData = content.split('\n').filter(line => line.trim()).map(line => {
            try { return JSON.parse(line); } catch { return null; }
          }).filter(Boolean);
          detectedType = 'jsonl';
        } else if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          parsedData = Array.isArray(parsed) ? parsed : [parsed];
          detectedType = 'json';
        }

        newFiles.push({
          id: `${Date.now()}_${file.name}`,
          name: file.name,
          size: file.size,
          type: file.type,
          content,
          parsedData,
          detectedType,
        });
      } catch (error) {
        toast.error(`Lỗi đọc file ${file.name}`);
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    toast.success(`Đã upload ${newFiles.length} file(s)`);
    event.target.value = '';
  }, []);

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const processFiles = useCallback(() => {
    if (uploadedFiles.length === 0) {
      toast.error('Chưa có file nào được upload');
      return;
    }

    setIsProcessing(true);

    try {
      const allItems: any[] = [];
      uploadedFiles.forEach(file => {
        allItems.push(...file.parsedData);
      });

      const records = allItems.map((item, idx) => convertToDatasetRecord(item, idx));
      setProcessedRecords(records);
      toast.success(`Đã xử lý ${records.length} records từ ${uploadedFiles.length} files`);
    } catch (error) {
      toast.error('Lỗi xử lý files');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFiles]);

  const importProcessedRecords = () => {
    if (processedRecords.length === 0) {
      toast.error('Không có records để import');
      return;
    }
    onAddRecords(processedRecords);
    setProcessedRecords([]);
    setUploadedFiles([]);
    toast.success(`Đã import ${processedRecords.length} records vào dataset`);
  };

  // Hugging Face functions
  const addHuggingFaceRepo = () => {
    if (!hfRepoUrl.trim()) {
      toast.error('Vui lòng nhập URL hoặc tên repo Hugging Face');
      return;
    }

    const repoName = hfRepoUrl.includes('huggingface.co')
      ? hfRepoUrl.split('/').slice(-2).join('/')
      : hfRepoUrl;

    const newRepo: HuggingFaceRepo = {
      id: Date.now().toString(),
      name: repoName,
      url: `https://huggingface.co/datasets/${repoName}`,
      status: 'pending',
    };

    setHfRepos(prev => [...prev, newRepo]);
    setHfRepoUrl('');
    toast.success('Đã thêm repo Hugging Face');
  };

  const removeHfRepo = (id: string) => {
    setHfRepos(prev => prev.filter(r => r.id !== id));
  };

  const loadHuggingFaceData = async () => {
    const token = localStorage.getItem('HUGGING_FACE_ACCESS_TOKEN');
    if (!token) {
      toast.error('Vui lòng cấu hình Hugging Face Access Token trong Settings');
      return;
    }

    if (hfRepos.length === 0) {
      toast.error('Chưa có repo nào được thêm');
      return;
    }

    setIsLoadingHf(true);
    setHfRecords([]);

    for (const repo of hfRepos) {
      setHfRepos(prev => prev.map(r =>
        r.id === repo.id ? { ...r, status: 'loading' } : r
      ));

      try {
        const response = await fetch(
          `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(repo.name)}&config=default&split=train&offset=0&length=100`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rows = data.rows?.map((row: any) => row.row) || [];
          const records = rows.map((item: any, idx: number) => convertToDatasetRecord(item, idx));

          setHfRecords(prev => [...prev, ...records]);
          setHfRepos(prev => prev.map(r =>
            r.id === repo.id ? { ...r, status: 'done', recordsCount: records.length } : r
          ));
        } else {
          setHfRepos(prev => prev.map(r =>
            r.id === repo.id ? { ...r, status: 'error', error: 'Không thể load data từ repo' } : r
          ));
        }
      } catch (error) {
        setHfRepos(prev => prev.map(r =>
          r.id === repo.id ? { ...r, status: 'error', error: 'Lỗi kết nối' } : r
        ));
      }
    }

    setIsLoadingHf(false);
    toast.success('Đã load dữ liệu từ Hugging Face');
  };

  const importHfRecords = () => {
    if (hfRecords.length === 0) {
      toast.error('Không có records để import');
      return;
    }
    onAddRecords(hfRecords);
    setHfRecords([]);
    setHfRepos([]);
    toast.success(`Đã import ${hfRecords.length} records từ Hugging Face`);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Import Data</h2>
        <p className="text-muted-foreground">Upload local files hoặc import từ Hugging Face datasets</p>
      </div>

      <Tabs defaultValue="local" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="local" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Local Upload
          </TabsTrigger>
          <TabsTrigger value="huggingface" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Hugging Face
          </TabsTrigger>
        </TabsList>

        {/* Local Upload Tab */}
        <TabsContent value="local" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Upload Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <Input
                    type="file"
                    multiple
                    accept=".json,.jsonl"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <span className="text-sm font-medium">Click để upload hoặc kéo thả files</span>
                    <span className="text-xs text-muted-foreground">Hỗ trợ: JSON, JSONL</span>
                  </Label>
                </div>

                {uploadedFiles.length > 0 && (
                  <>
                    <Separator />
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {uploadedFiles.map(file => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileJson className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatFileSize(file.size)}</span>
                                  <Badge variant="outline" className="text-xs">{file.detectedType}</Badge>
                                  <span>{file.parsedData.length} items</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <Button onClick={processFiles} disabled={isProcessing} className="w-full">
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Process ({uploadedFiles.length} files)
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Processed Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Kết quả xử lý
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {processedRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileJson className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Chưa có dữ liệu được xử lý</p>
                  </div>
                ) : (
                  <>
                    <Alert className="bg-accent/50">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Xử lý hoàn tất</AlertTitle>
                      <AlertDescription>
                        {processedRecords.length} records đã sẵn sàng import
                      </AlertDescription>
                    </Alert>

                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {processedRecords.slice(0, 20).map((record, idx) => (
                          <div key={record.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div>
                              <p className="font-medium text-sm">{record.id}</p>
                              <p className="text-xs text-muted-foreground">{record.qa_pairs?.length || 0} QA pairs</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewRecord(record)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <Button onClick={importProcessedRecords} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Import {processedRecords.length} Records
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hugging Face Tab */}
        <TabsContent value="huggingface" className="space-y-6">
          {!hasHfToken && (
            <Alert>
              <Key className="h-4 w-4" />
              <AlertTitle>Cần cấu hình Access Token</AlertTitle>
              <AlertDescription>
                Vui lòng vào Settings và nhập Hugging Face Access Token để sử dụng tính năng này.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Hugging Face Datasets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Dataset URL hoặc tên repo</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="username/dataset-name"
                      value={hfRepoUrl}
                      onChange={e => setHfRepoUrl(e.target.value)}
                    />
                    <Button onClick={addHuggingFaceRepo} variant="outline">Thêm</Button>
                  </div>
                </div>

                <Separator />

                {hfRepos.length > 0 && (
                  <div className="space-y-2">
                    {hfRepos.map(repo => (
                      <div key={repo.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Database className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{repo.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-48">{repo.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {repo.status === 'done' && (
                            <Badge className="bg-accent text-accent-foreground">{repo.recordsCount} records</Badge>
                          )}
                          {repo.status === 'loading' && (
                            <Badge className="bg-chart-3/10 text-chart-3">
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Loading...
                            </Badge>
                          )}
                          {repo.status === 'error' && (
                            <Badge variant="destructive">{repo.error || 'Error'}</Badge>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => removeHfRepo(repo.id)} disabled={isLoadingHf}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hfRepos.length > 0 && (
                  <Button onClick={loadHuggingFaceData} disabled={isLoadingHf || !hasHfToken} className="w-full">
                    {isLoadingHf ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Đang load...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Load Data từ Hugging Face
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Kết quả
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hfRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Chưa có dữ liệu từ Hugging Face</p>
                  </div>
                ) : (
                  <>
                    <Alert className="bg-accent/50">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Load hoàn tất</AlertTitle>
                      <AlertDescription>
                        {hfRecords.length} records từ {hfRepos.length} repos
                      </AlertDescription>
                    </Alert>

                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {hfRecords.slice(0, 20).map((record) => (
                          <div key={record.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div>
                              <p className="font-medium text-sm">{record.id}</p>
                              <p className="text-xs text-muted-foreground">{record.qa_pairs?.length || 0} QA pairs</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewRecord(record)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <Button onClick={importHfRecords} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Import {hfRecords.length} Records
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      {previewRecord && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Preview: {previewRecord.id}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPreviewRecord(null)}>✕</Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[65vh]">
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(previewRecord, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
