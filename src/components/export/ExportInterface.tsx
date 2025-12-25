import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileJson, 
  FileSpreadsheet,
  CheckCircle2,
  Filter,
  Copy
} from 'lucide-react';
import { DatasetRecord, DatasetStats } from '@/types/dataset';
import { toast } from 'sonner';

interface ExportInterfaceProps {
  records: DatasetRecord[];
  stats: DatasetStats;
}

export function ExportInterface({ records, stats }: ExportInterfaceProps) {
  const [exportFormat, setExportFormat] = useState<'json' | 'jsonl' | 'csv'>('json');
  const [statusFilters, setStatusFilters] = useState({
    pending: false,
    reviewed: true,
    approved: true,
    rejected: false
  });
  const [includeFields, setIncludeFields] = useState({
    metadata: true,
    assets: true,
    qa_items: true,
    status: true
  });

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const status = record.status || 'pending';
      return statusFilters[status];
    });
  }, [records, statusFilters]);

  const exportData = useMemo(() => {
    return filteredRecords.map(record => {
      const exported: any = { record_id: record.record_id };
      
      if (includeFields.metadata) exported.metadata = record.metadata;
      if (includeFields.assets) exported.assets = record.assets;
      if (includeFields.qa_items) exported.qa_items = record.qa_items;
      if (includeFields.status) {
        exported.status = record.status;
        exported.reviewedAt = record.reviewedAt;
      }
      
      return exported;
    });
  }, [filteredRecords, includeFields]);

  const handleExport = () => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (exportFormat === 'json') {
      content = JSON.stringify(exportData, null, 2);
      filename = `svlm_dataset_${Date.now()}.json`;
      mimeType = 'application/json';
    } else if (exportFormat === 'jsonl') {
      content = exportData.map(r => JSON.stringify(r)).join('\n');
      filename = `svlm_dataset_${Date.now()}.jsonl`;
      mimeType = 'application/x-jsonlines';
    } else {
      // CSV export - flatten the data
      const headers = ['record_id', 'entity_name', 'city', 'scenario', 'question', 'answer', 'status'];
      const rows = exportData.map(r => [
        r.record_id,
        r.metadata?.entity_name || '',
        r.metadata?.location?.city || '',
        r.qa_items?.[0]?.scenario || '',
        r.qa_items?.[0]?.query?.text || r.qa_items?.[0]?.query?.audio_query_transcript || '',
        r.qa_items?.[0]?.target?.answer || '',
        r.status || ''
      ]);
      content = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      filename = `svlm_dataset_${Date.now()}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Đã export ${filteredRecords.length} records`);
  };

  const handleCopyToClipboard = () => {
    const content = exportFormat === 'json' 
      ? JSON.stringify(exportData, null, 2)
      : exportFormat === 'jsonl'
      ? exportData.map(r => JSON.stringify(r)).join('\n')
      : 'CSV format - please use download';
    
    navigator.clipboard.writeText(content);
    toast.success('Đã copy vào clipboard');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Export Dataset</h2>
        <p className="text-muted-foreground">Xuất dataset theo các định dạng khác nhau</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dataset Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Records</span>
              <Badge>{stats.total}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending</span>
              <Badge variant="outline">{stats.pending}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reviewed</span>
              <Badge className="bg-chart-3/10 text-chart-3">{stats.reviewed}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Approved</span>
              <Badge className="bg-accent text-accent-foreground">{stats.approved}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rejected</span>
              <Badge variant="destructive">{stats.rejected}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Selected for Export</span>
              <Badge className="bg-primary text-primary-foreground">{filteredRecords.length}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Export Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Format</Label>
              <RadioGroup value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON (array)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="jsonl" id="jsonl" />
                  <Label htmlFor="jsonl" className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSONL (line-delimited)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (flattened)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Status Filter</Label>
              <div className="space-y-2">
                {Object.entries(statusFilters).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${key}`}
                      checked={value}
                      onCheckedChange={(checked) => 
                        setStatusFilters({ ...statusFilters, [key]: !!checked })
                      }
                    />
                    <Label htmlFor={`status-${key}`} className="capitalize">{key}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Include Fields</Label>
              <div className="space-y-2">
                {Object.entries(includeFields).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${key}`}
                      checked={value}
                      onCheckedChange={(checked) => 
                        setIncludeFields({ ...includeFields, [key]: !!checked })
                      }
                    />
                    <Label htmlFor={`field-${key}`} className="capitalize">{key.replace('_', ' ')}</Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview & Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview & Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 max-h-64 overflow-auto">
              <pre className="text-xs font-mono">
                {exportFormat === 'csv' 
                  ? 'record_id,entity_name,city,scenario,question,answer,status\n...'
                  : JSON.stringify(exportData.slice(0, 2), null, 2)}
                {exportData.length > 2 && '\n... và ' + (exportData.length - 2) + ' records nữa'}
              </pre>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopyToClipboard} variant="outline" className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button onClick={handleExport} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {filteredRecords.length} records sẽ được export
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
