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
  Filter,
  Copy
} from 'lucide-react';
import { DatasetRecord, DatasetStats } from '@/types/dataset';
import { toast } from 'sonner';

interface ExportInterfaceProps {
  records: DatasetRecord[];
  stats: DatasetStats;
}

interface ExportedQAPair {
  q: string;
  a: string;
  type: 'ask_image' | 'ask_audio' | 'ask_both';
  paths?: {
    question_audio?: string;
    answer_audio?: string;
  };
  audio_meta?: {
    q_voice?: {
      id: string;
      rate?: string;
      pitch?: string;
    };
    a_voice?: {
      id: string;
      type?: string;
    };
  };
}

interface ExportedRecord {
  id: string;
  timestamp: string;
  paths: {
    image: string;
    audio_evidence?: string;
  };
  metadata: {
    landmark_name: string;
    location: {
      city: string;
      district: string;
      gps: {
        lat: number;
        lng: number;
      };
    };
    image_spec: {
      resolution?: string;
      license?: string;
      source_url?: string;
    };
    audio_spec?: {
      transcript?: string;
      voice_id?: string;
    };
  };
  qa_pairs: ExportedQAPair[];
}

export function ExportInterface({ records, stats }: ExportInterfaceProps) {
  const [exportFormat, setExportFormat] = useState<'json' | 'jsonl' | 'csv'>('json');
  const [statusFilters, setStatusFilters] = useState({
    pending: false,
    reviewed: true,
    approved: true,
    rejected: false,
    warning: false
  });
  const [includeFields, setIncludeFields] = useState({
    paths: true,
    metadata: true,
    qa_pairs: true,
    audio_meta: true
  });

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const status = record.status || 'pending';
      return statusFilters[status as keyof typeof statusFilters];
    });
  }, [records, statusFilters]);

  const exportData = useMemo(() => {
    return filteredRecords.map(record => {
      const landmarkName = record.metadata?.geographic_info?.location_name || 
                           record.metadata?.entity_name || 
                           'Unknown';
      
      const city = record.metadata?.geographic_info?.city || 
                   record.metadata?.location?.city || 
                   '';
      
      const district = record.metadata?.location?.district || 
                       `${landmarkName}, ${city}`;
      
      const lat = record.metadata?.geographic_info?.lat 
        ? parseFloat(record.metadata.geographic_info.lat) 
        : record.metadata?.location?.lat_long?.[0] || 0;
      
      const lng = record.metadata?.geographic_info?.lon 
        ? parseFloat(record.metadata.geographic_info.lon) 
        : record.metadata?.location?.lat_long?.[1] || 0;

      const imagePath = record.assets?.image_path || record.assets?.image_url || '';
      
      // Convert qa_items to new format
      const qaPairs: ExportedQAPair[] = record.qa_items.map((item, index) => {
        // Determine type based on scenario or evidence_source
        let type: 'ask_image' | 'ask_audio' | 'ask_both' = 'ask_image';
        if (item.scenario?.includes('audio') && item.scenario?.includes('image')) {
          type = 'ask_both';
        } else if (item.scenario?.includes('audio') || item.target?.evidence_source === 'audio') {
          type = 'ask_audio';
        }

        const baseName = record.record_id.replace('IMG', 'VN_LM_2025_');
        const qaIndex = String(index + 1).padStart(2, '0');
        
        const qaPair: ExportedQAPair = {
          q: item.query?.text || item.query?.audio_query_transcript || '',
          a: item.target?.answer || (item.target?.alternative_answers?.[0]) || '',
          type
        };

        if (includeFields.paths) {
          const folderName = landmarkName.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
          qaPair.paths = {
            question_audio: `audio_queries/${folderName}/q_${baseName}_qa_${qaIndex}.wav`,
            answer_audio: `audio_answers/${folderName}/a_${baseName}_qa_${qaIndex}.wav`
          };
        }

        if (includeFields.audio_meta) {
          qaPair.audio_meta = {
            q_voice: {
              id: 'vi-VN-HoaiMyNeural',
              rate: '-10%',
              pitch: '+0Hz'
            },
            a_voice: {
              id: 'vi-VN-HoaiMyNeural',
              type: 'fixed_target'
            }
          };
        }

        return qaPair;
      });

      const exported: ExportedRecord = {
        id: record.record_id.replace('IMG', 'VN_LM_2025_').replace(/(\d+)$/, (m) => m.padStart(3, '0') + '_00'),
        timestamp: record.createdAt || new Date().toISOString(),
        paths: {
          image: imagePath,
        },
        metadata: {
          landmark_name: landmarkName,
          location: {
            city,
            district,
            gps: { lat, lng }
          },
          image_spec: {
            source_url: record.assets?.image_url || undefined,
            license: 'CC BY-SA 4.0'
          }
        },
        qa_pairs: qaPairs
      };

      // Add audio evidence if available
      if (record.assets?.audio_evidence) {
        exported.paths.audio_evidence = record.assets.audio_evidence.path;
        exported.metadata.audio_spec = {
          transcript: record.assets.audio_evidence.transcript,
          voice_id: 'vi-VN-NamMinhNeural'
        };
      }

      // Add image/knowledge descriptions if available
      if (record.metadata?.image_description) {
        (exported.metadata as any).image_description = record.metadata.image_description;
      }
      if (record.metadata?.knowledge_description) {
        (exported.metadata as any).knowledge_description = record.metadata.knowledge_description;
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
      filename = `vn_landmark_dataset_${Date.now()}.json`;
      mimeType = 'application/json';
    } else if (exportFormat === 'jsonl') {
      content = exportData.map(r => JSON.stringify(r)).join('\n');
      filename = `vn_landmark_dataset_${Date.now()}.jsonl`;
      mimeType = 'application/x-jsonlines';
    } else {
      // CSV export - flatten the data
      const headers = ['id', 'timestamp', 'landmark_name', 'city', 'lat', 'lng', 'question', 'answer', 'type'];
      const rows: string[][] = [];
      
      exportData.forEach(record => {
        record.qa_pairs.forEach(qa => {
          rows.push([
            record.id,
            record.timestamp,
            record.metadata.landmark_name,
            record.metadata.location.city,
            String(record.metadata.location.gps.lat),
            String(record.metadata.location.gps.lng),
            qa.q,
            qa.a,
            qa.type
          ]);
        });
      });
      
      content = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      filename = `vn_landmark_dataset_${Date.now()}.csv`;
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
        <p className="text-muted-foreground">Xuất dataset theo định dạng VN Landmark chuẩn</p>
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
              <span className="text-muted-foreground">Warning</span>
              <Badge className="bg-chart-4/10 text-chart-4">{stats.warning}</Badge>
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
            <div className="bg-muted rounded-lg p-4 max-h-80 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {exportFormat === 'csv' 
                  ? 'id,timestamp,landmark_name,city,lat,lng,question,answer,type\n...'
                  : JSON.stringify(exportData.slice(0, 1), null, 2)}
                {exportData.length > 1 && '\n\n... và ' + (exportData.length - 1) + ' records nữa'}
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
              {filteredRecords.length} records sẽ được export theo format VN Landmark
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
