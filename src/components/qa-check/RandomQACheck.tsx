import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Shuffle, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  BarChart3,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { DatasetRecord } from '@/types/dataset';
import { toast } from 'sonner';

interface RandomQACheckProps {
  records: DatasetRecord[];
  onRecordUpdate: (record: DatasetRecord) => void;
}

interface QACheckResult {
  recordId: string;
  entityName: string;
  passed: boolean;
  issues: string[];
  checkedAt: string;
}

export function RandomQACheck({ records, onRecordUpdate }: RandomQACheckProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [sampledRecords, setSampledRecords] = useState<DatasetRecord[]>([]);
  const [checkResults, setCheckResults] = useState<QACheckResult[]>([]);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);

  const sampleSize = Math.ceil(records.length * 0.1);

  // Keyboard navigation
  useEffect(() => {
    if (!isRunning) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePass();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, currentCheckIndex, sampledRecords]);

  const generateSample = useCallback(() => {
    const shuffled = [...records].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, sampleSize);
    setSampledRecords(sample);
    setCheckResults([]);
    setCurrentCheckIndex(0);
    toast.success(`Đã lấy mẫu ${sample.length} records (10%)`);
  }, [records, sampleSize]);

  const startCheck = () => {
    if (sampledRecords.length === 0) {
      generateSample();
    }
    setIsRunning(true);
  };

  const currentRecord = sampledRecords[currentCheckIndex];

  const validateRecord = (record: DatasetRecord): string[] => {
    const issues: string[] = [];

    // Check metadata
    if (!record.metadata.entity_name?.trim()) {
      issues.push('Entity name is empty');
    }

    // Check scenario consistency
    record.qa_items.forEach((qa, index) => {
      if (qa.scenario.startsWith('text') && !qa.query.text) {
        issues.push(`QA ${index + 1}: Text scenario but no text query`);
      }
      if (qa.scenario.startsWith('audio') && !qa.query.audio_query_path) {
        issues.push(`QA ${index + 1}: Audio scenario but no audio query`);
      }
      if (qa.scenario.includes('image') && !record.assets.image_path) {
        issues.push(`QA ${index + 1}: Image scenario but no image asset`);
      }
      if (qa.scenario.includes('audio') && !record.assets.audio_evidence) {
        issues.push(`QA ${index + 1}: Audio scenario but no audio evidence`);
      }
      if (!qa.target.answer?.trim()) {
        issues.push(`QA ${index + 1}: Empty answer`);
      }
    });

    // Check assets
    if (record.assets.audio_evidence) {
      if (!record.assets.audio_evidence.transcript?.trim()) {
        issues.push('Audio evidence missing transcript');
      }
      if (record.assets.audio_evidence.duration_sec <= 0) {
        issues.push('Invalid audio duration');
      }
    }

    return issues;
  };

  const handlePass = () => {
    if (!currentRecord) return;
    
    const issues = validateRecord(currentRecord);
    const result: QACheckResult = {
      recordId: currentRecord.record_id,
      entityName: currentRecord.metadata.entity_name,
      passed: issues.length === 0,
      issues,
      checkedAt: new Date().toISOString()
    };

    setCheckResults(prev => [...prev, result]);

    if (issues.length === 0) {
      onRecordUpdate({ ...currentRecord, status: 'approved', reviewedAt: new Date().toISOString() });
      toast.success('Record passed QA check');
    } else {
      toast.warning(`Found ${issues.length} issue(s)`);
    }

    goNext();
  };

  const handleFail = () => {
    if (!currentRecord) return;
    
    const result: QACheckResult = {
      recordId: currentRecord.record_id,
      entityName: currentRecord.metadata.entity_name,
      passed: false,
      issues: ['Manually marked as failed'],
      checkedAt: new Date().toISOString()
    };

    setCheckResults(prev => [...prev, result]);
    onRecordUpdate({ ...currentRecord, status: 'rejected', reviewedAt: new Date().toISOString() });
    toast.error('Record marked as failed');
    goNext();
  };

  const goNext = () => {
    if (currentCheckIndex < sampledRecords.length - 1) {
      setCurrentCheckIndex(currentCheckIndex + 1);
    } else {
      setIsRunning(false);
      toast.success('QA Check completed!');
    }
  };

  const goToPrev = () => {
    if (currentCheckIndex > 0) {
      setCurrentCheckIndex(currentCheckIndex - 1);
    }
  };

  const passedCount = checkResults.filter(r => r.passed).length;
  const failedCount = checkResults.filter(r => !r.passed).length;
  const passRate = checkResults.length > 0 ? (passedCount / checkResults.length) * 100 : 0;

  if (!isRunning) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Random QA Check</h2>
          <p className="text-muted-foreground">Kiểm tra ngẫu nhiên 10% dataset để đảm bảo chất lượng</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Shuffle className="h-12 w-12 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold">Sample Size</h3>
              <p className="text-3xl font-bold text-primary mt-2">{sampleSize}</p>
              <p className="text-sm text-muted-foreground">records (10%)</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-chart-1 mb-4" />
              <h3 className="text-lg font-semibold">Total Dataset</h3>
              <p className="text-3xl font-bold text-chart-1 mt-2">{records.length}</p>
              <p className="text-sm text-muted-foreground">total records</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-accent-foreground mb-4" />
              <h3 className="text-lg font-semibold">Pass Rate</h3>
              <p className="text-3xl font-bold text-accent-foreground mt-2">
                {checkResults.length > 0 ? `${passRate.toFixed(1)}%` : '--'}
              </p>
              <p className="text-sm text-muted-foreground">
                {passedCount}/{checkResults.length} passed
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bắt đầu QA Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Semi-Automatic Check</AlertTitle>
              <AlertDescription>
                Hệ thống sẽ tự động validate format và consistency của dữ liệu. 
                Bạn sẽ review kết quả và quyết định pass/fail cho từng record.
                <br />
                <strong>Phím tắt:</strong> ← Quay lại | → Pass & Next
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button onClick={generateSample} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Lấy mẫu mới
              </Button>
              <Button onClick={startCheck} className="flex-1" disabled={records.length === 0}>
                <Play className="h-4 w-4 mr-2" />
                Bắt đầu kiểm tra ({sampledRecords.length || sampleSize} records)
              </Button>
            </div>

            {records.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Chưa có data</AlertTitle>
                <AlertDescription>
                  Vui lòng import data trước khi chạy QA Check.
                </AlertDescription>
              </Alert>
            )}

            {sampledRecords.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Sample preview:</p>
                <div className="flex flex-wrap gap-2">
                  {sampledRecords.slice(0, 10).map(r => (
                    <Badge key={r.record_id} variant="outline" className="text-xs">
                      {r.metadata.entity_name}
                    </Badge>
                  ))}
                  {sampledRecords.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{sampledRecords.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previous Results */}
        {checkResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Kết quả kiểm tra</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {checkResults.map((result) => (
                    <div 
                      key={result.recordId} 
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        result.passed ? 'bg-accent/50 border-accent-foreground/20' : 'bg-destructive/10 border-destructive/20'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">{result.entityName}</p>
                        <p className="text-xs text-muted-foreground">{result.recordId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.issues.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {result.issues.length} issue(s)
                          </Badge>
                        )}
                        {result.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Running mode - show current record for review in a dialog
  return (
    <Dialog open={isRunning} onOpenChange={(open) => !open && setIsRunning(false)}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Navigation */}
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={goToPrev}
                  disabled={currentCheckIndex <= 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {currentCheckIndex + 1} / {sampledRecords.length}
                </span>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={goNext}
                  disabled={currentCheckIndex >= sampledRecords.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <DialogTitle>QA Check - {currentRecord?.metadata.entity_name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Phím tắt: ← Quay lại | → Pass & Next
                </p>
              </div>
            </div>
            <Progress value={(currentCheckIndex / sampledRecords.length) * 100} className="w-32 h-2" />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Record Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Record Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Record ID</p>
                    <p className="font-mono text-sm">{currentRecord?.record_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Entity</p>
                    <p className="font-medium">{currentRecord?.metadata.entity_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p>{currentRecord?.metadata.location.city}, {currentRecord?.metadata.location.district}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Assets</p>
                    <div className="flex gap-2">
                      <Badge variant={currentRecord?.assets.image_path ? 'default' : 'outline'}>
                        Image: {currentRecord?.assets.image_path ? '✓' : '✗'}
                      </Badge>
                      <Badge variant={currentRecord?.assets.audio_evidence ? 'default' : 'outline'}>
                        Audio: {currentRecord?.assets.audio_evidence ? '✓' : '✗'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Validation Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Auto Validation</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentRecord && (() => {
                    const issues = validateRecord(currentRecord);
                    if (issues.length === 0) {
                      return (
                        <Alert className="bg-accent/50 border-accent-foreground/20">
                          <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
                          <AlertTitle>Passed</AlertTitle>
                          <AlertDescription>
                            Không tìm thấy lỗi format hoặc consistency
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <Alert className="bg-destructive/10 border-destructive/20">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <AlertTitle>Found {issues.length} issue(s)</AlertTitle>
                        </Alert>
                        <ul className="space-y-1">
                          {issues.map((issue, i) => (
                            <li key={i} className="text-sm text-destructive flex items-start gap-2">
                              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* QA Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">QA Items ({currentRecord?.qa_items.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentRecord?.qa_items.map((qa, index) => (
                  <div key={qa.qa_id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline">{qa.qa_id}</Badge>
                      <Badge>{qa.scenario}</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Query</p>
                        <p className="text-sm">{qa.query.text || qa.query.audio_query_transcript || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Answer</p>
                        <p className="text-sm font-medium">{qa.target.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Action Bar */}
        <div className="px-6 py-4 border-t shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-accent text-accent-foreground">{passedCount} Passed</Badge>
                <Badge variant="destructive">{failedCount} Failed</Badge>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsRunning(false)}>
                Tạm dừng
              </Button>
              <Button variant="destructive" onClick={handleFail}>
                <XCircle className="h-4 w-4 mr-2" />
                Fail
              </Button>
              <Button onClick={handlePass}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Pass
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
