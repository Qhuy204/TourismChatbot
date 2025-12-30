import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shuffle, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { DatasetRecord } from '@/types/dataset';
import { toast } from 'sonner';

interface RandomQACheckProps {
  records: DatasetRecord[];
  totalCount?: number;
  onRecordUpdate: (record: DatasetRecord) => void;
  onStartAnnotation?: (recordIds: string[]) => void;
}

interface QACheckResult {
  recordId: string;
  landmarkName: string;
  passed: boolean;
  issues: string[];
  checkedAt: string;
}

export function RandomQACheck({ records, totalCount, onRecordUpdate, onStartAnnotation }: RandomQACheckProps) {
  const [sampledRecords, setSampledRecords] = useState<DatasetRecord[]>([]);
  const [checkResults, setCheckResults] = useState<QACheckResult[]>([]);

  const actualTotal = totalCount || records.length;
  const sampleSize = Math.ceil(actualTotal * 0.1);

  const generateSample = useCallback(() => {
    const shuffled = [...records].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, sampleSize);
    setSampledRecords(sample);
    setCheckResults([]);
    toast.success(`Đã lấy mẫu ${sample.length} records (10%)`);
  }, [records, sampleSize]);

  const startCheck = () => {
    if (sampledRecords.length === 0) {
      generateSample();
    }
    
    // Navigate to Annotate with the sampled records
    if (onStartAnnotation && sampledRecords.length > 0) {
      onStartAnnotation(sampledRecords.map(r => r.id));
    } else if (onStartAnnotation && records.length > 0) {
      // Generate sample first then navigate
      const shuffled = [...records].sort(() => Math.random() - 0.5);
      const sample = shuffled.slice(0, sampleSize);
      setSampledRecords(sample);
      onStartAnnotation(sample.map(r => r.id));
    }
  };

  const passedCount = checkResults.filter(r => r.passed).length;
  const failedCount = checkResults.filter(r => !r.passed).length;
  const passRate = checkResults.length > 0 ? (passedCount / checkResults.length) * 100 : 0;

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
            <p className="text-3xl font-bold text-chart-1 mt-2">{actualTotal.toLocaleString()}</p>
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
              Hệ thống sẽ chọn ngẫu nhiên 10% dữ liệu và chuyển sang tab Annotate để kiểm tra.
              <br />
              <strong>Phím tắt:</strong> ← Quay lại | → Next
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
              <AlertDescription>Vui lòng import data trước khi chạy QA Check.</AlertDescription>
            </Alert>
          )}

          {sampledRecords.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Sample preview:</p>
              <div className="flex flex-wrap gap-2">
                {sampledRecords.slice(0, 10).map(r => (
                  <Badge key={r.id} variant="outline" className="text-xs">
                    {r.metadata.landmark_name}
                  </Badge>
                ))}
                {sampledRecords.length > 10 && (
                  <Badge variant="outline" className="text-xs">+{sampledRecords.length - 10} more</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                      <p className="font-medium text-sm">{result.landmarkName}</p>
                      <p className="text-xs text-muted-foreground">{result.recordId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.issues.length > 0 && (
                        <Badge variant="outline" className="text-xs">{result.issues.length} issue(s)</Badge>
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
