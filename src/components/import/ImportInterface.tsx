import { useState, useCallback } from 'react';
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
  AlertTriangle,
  Trash2,
  Download,
  Eye,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { DatasetRecord } from '@/types/dataset';
import { toast } from 'sonner';
import {
  detectAndParseFile,
  mergeDataByImageId,
  convertMergedDataToRecords,
  parseHuggingFaceDataset,
} from '@/lib/dataParser';

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

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        const { type, data } = detectAndParseFile(content, file.name);

        newFiles.push({
          id: `${Date.now()}_${file.name}`,
          name: file.name,
          size: file.size,
          type: file.type,
          content,
          parsedData: data,
          detectedType: type,
        });
      } catch (error) {
        toast.error(`Lỗi đọc file ${file.name}`);
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    toast.success(`Đã upload ${newFiles.length} file(s)`);

    // Reset input
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
      const dataArrays = uploadedFiles.map(f => ({
        type: f.detectedType,
        data: f.parsedData,
        filename: f.name,
      }));

      const mergedMap = mergeDataByImageId(dataArrays);
      const records = convertMergedDataToRecords(mergedMap);

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
    if (hfRepos.length === 0) {
      toast.error('Chưa có repo nào được thêm');
      return;
    }

    setIsLoadingHf(true);
    setHfRecords([]);

    // Simulate loading from Hugging Face (in real implementation, you'd use HF API)
    for (const repo of hfRepos) {
      setHfRepos(prev => prev.map(r =>
        r.id === repo.id ? { ...r, status: 'loading' } : r
      ));

      await new Promise(r => setTimeout(r, 1500));

      // Generate mock data based on the repo name
      const mockData = generateMockHuggingFaceData(repo.name, 10);
      const records = parseHuggingFaceDataset(mockData);

      setHfRecords(prev => [...prev, ...records]);

      setHfRepos(prev => prev.map(r =>
        r.id === repo.id ? { ...r, status: 'done', recordsCount: records.length } : r
      ));
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
        <p className="text-muted-foreground">
          Upload local files hoặc import từ Hugging Face datasets
        </p>
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
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Click để upload hoặc kéo thả files
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Hỗ trợ: JSON, JSONL
                    </span>
                  </Label>
                </div>

                {uploadedFiles.length > 0 && (
                  <>
                    <Separator />
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {uploadedFiles.map(file => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <FileJson className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatFileSize(file.size)}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {file.detectedType}
                                  </Badge>
                                  <span>{file.parsedData.length} items</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(file.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <Button
                      onClick={processFiles}
                      disabled={isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Merge & Process ({uploadedFiles.length} files)
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
                    <p className="text-xs mt-1">
                      Upload files và nhấn Process để merge data theo IMG ID
                    </p>
                  </div>
                ) : (
                  <>
                    <Alert className="bg-accent/50">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Xử lý hoàn tất</AlertTitle>
                      <AlertDescription>
                        {processedRecords.length} records đã được merge từ{' '}
                        {uploadedFiles.length} files
                      </AlertDescription>
                    </Alert>

                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {processedRecords.slice(0, 20).map(record => (
                          <div
                            key={record.record_id}
                            className="flex items-center justify-between p-2 bg-muted/30 rounded"
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {record.record_id}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {record.qa_items.length} QA pairs
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewRecord(record)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {processedRecords.length > 20 && (
                          <p className="text-xs text-center text-muted-foreground py-2">
                            ... và {processedRecords.length - 20} records khác
                          </p>
                        )}
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

          {/* Format Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Supported Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <Badge className="mb-2">JSONL (VQA)</Badge>
                  <p className="text-xs text-muted-foreground">
                    Mỗi dòng là 1 JSON object với image_id, file_path, vqa_pairs
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <Badge className="mb-2">JSON (Metadata)</Badge>
                  <p className="text-xs text-muted-foreground">
                    Array hoặc object với image_id, image_url, file_path, keyword...
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <Badge className="mb-2">JSON (Conversation)</Badge>
                  <p className="text-xs text-muted-foreground">
                    Array role/content pairs được convert thành QA pairs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hugging Face Tab */}
        <TabsContent value="huggingface" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* HF Repo Input */}
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
                    <Button onClick={addHuggingFaceRepo} variant="outline">
                      Thêm
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ví dụ: username/vietnam-landmarks-vqa
                  </p>
                </div>

                <Separator />

                {hfRepos.length > 0 && (
                  <div className="space-y-2">
                    {hfRepos.map(repo => (
                      <div
                        key={repo.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Database className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{repo.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-48">
                              {repo.url}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {repo.status === 'done' && (
                            <Badge className="bg-accent text-accent-foreground">
                              {repo.recordsCount} records
                            </Badge>
                          )}
                          {repo.status === 'loading' && (
                            <Badge className="bg-chart-3/10 text-chart-3">
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Loading...
                            </Badge>
                          )}
                          {repo.status === 'error' && (
                            <Badge variant="destructive">Error</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHfRepo(repo.id)}
                            disabled={isLoadingHf}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hfRepos.length > 0 && (
                  <Button
                    onClick={loadHuggingFaceData}
                    disabled={isLoadingHf}
                    className="w-full"
                  >
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

            {/* HF Results */}
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
                    <p className="text-xs mt-1">
                      Thêm repo và nhấn Load để import data
                    </p>
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
                        {hfRecords.slice(0, 20).map(record => (
                          <div
                            key={record.record_id}
                            className="flex items-center justify-between p-2 bg-muted/30 rounded"
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {record.record_id}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {record.qa_items.length} QA pairs
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewRecord(record)}
                            >
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

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Lưu ý</AlertTitle>
            <AlertDescription>
              Hiện tại đang sử dụng mock data. Để kết nối thực sự với Hugging Face API, 
              cần cấu hình access token.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      {previewRecord && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Preview: {previewRecord.record_id}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPreviewRecord(null)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
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

// Helper function to generate mock HF data
function generateMockHuggingFaceData(repoName: string, count: number): any[] {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      image_id: `HF_${repoName.replace('/', '_')}_${String(i + 1).padStart(4, '0')}`,
      file_path: `data/images/${repoName.split('/')[1] || 'dataset'}_${i + 1}.jpg`,
      image_url: `https://example.com/images/${i + 1}.jpg`,
      vqa_pairs: [
        {
          question_id: `Q_${i + 1}_1`,
          question: 'Mô tả nội dung hình ảnh này',
          answers: ['Đây là mô tả mẫu từ Hugging Face dataset'],
          answer_type: 'description',
        },
        {
          question_id: `Q_${i + 1}_2`,
          question: 'Địa điểm này nằm ở đâu?',
          answers: ['Việt Nam'],
          answer_type: 'location',
        },
      ],
    });
  }
  return data;
}
