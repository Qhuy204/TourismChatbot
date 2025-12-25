import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AudioPlayer } from '@/components/ui/audio-player';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  SkipForward,
  CheckCircle2,
  XCircle,
  Image,
  Volume2,
  MessageSquare,
  Edit3,
  MapPin
} from 'lucide-react';
import { DatasetRecord, QAItem } from '@/types/dataset';
import { toast } from 'sonner';

interface AnnotationInterfaceProps {
  records: DatasetRecord[];
  onRecordUpdate: (record: DatasetRecord) => void;
}

export function AnnotationInterface({ records, onRecordUpdate }: AnnotationInterfaceProps) {
  const pendingRecords = useMemo(() => 
    records.filter(r => r.status === 'pending' || r.status === 'reviewed'), 
    [records]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedRecord, setEditedRecord] = useState<DatasetRecord | null>(null);

  const currentRecord = pendingRecords[currentIndex];
  const record = editedRecord || currentRecord;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, pendingRecords.length]);

  if (!record) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-primary mb-4" />
          <h3 className="text-xl font-semibold">Hoàn tất!</h3>
          <p className="text-muted-foreground mt-2">Tất cả records đã được xem xét.</p>
        </Card>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / pendingRecords.length) * 100;

  const handleFieldChange = (path: string, value: any) => {
    if (!editedRecord) {
      setEditedRecord({ ...record });
    }
    
    const updated = { ...(editedRecord || record) };
    const keys = path.split('.');
    let obj: any = updated;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i].includes('[')) {
        const [key, indexStr] = keys[i].split('[');
        const index = parseInt(indexStr.replace(']', ''));
        obj = obj[key][index];
      } else {
        if (!obj[keys[i]]) {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }
    }
    
    obj[keys[keys.length - 1]] = value;
    setEditedRecord(updated);
  };

  const handleSave = () => {
    if (editedRecord) {
      onRecordUpdate({ ...editedRecord, status: 'reviewed', reviewedAt: new Date().toISOString() });
      toast.success('Đã lưu thay đổi');
    }
    setEditedRecord(null);
  };

  const handleApprove = () => {
    const toUpdate = editedRecord || record;
    onRecordUpdate({ ...toUpdate, status: 'approved', reviewedAt: new Date().toISOString() });
    toast.success('Đã phê duyệt');
    setEditedRecord(null);
    goNext();
  };

  const handleReject = () => {
    const toUpdate = editedRecord || record;
    onRecordUpdate({ ...toUpdate, status: 'rejected', reviewedAt: new Date().toISOString() });
    toast.error('Đã từ chối');
    setEditedRecord(null);
    goNext();
  };

  const goNext = () => {
    if (currentIndex < pendingRecords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditedRecord(null);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setEditedRecord(null);
    }
  };

  // Get geographic info with fallbacks
  const geo = record.metadata.geographic_info || {};
  const landmarkName = geo.location_name || record.metadata.entity_name || '';
  const city = geo.city || record.metadata.location?.city || '';
  const district = geo.district || record.metadata.location?.district || '';
  const lat = geo.lat || record.metadata.location?.lat_long?.[0] || '';
  const lng = geo.lon || record.metadata.location?.lat_long?.[1] || '';
  const sourceUrl = geo.page_url || '';
  const license = geo.license_info || '';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Annotation Interface</h2>
          <p className="text-muted-foreground">Chỉnh sửa và xác thực dữ liệu dataset (← → để chuyển)</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Record {currentIndex + 1} / {pendingRecords.length}</p>
          <Progress value={progress} className="w-48 h-2 mt-2" />
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-250px)]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pr-4">
          {/* Left Panel - Assets Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Image Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {record.assets?.image_path || record.assets?.image_url ? (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                    <div className="text-center">
                      <Image className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mt-2 px-4 break-all">
                        {record.assets.image_path || record.assets.image_url}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">No image</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Audio Evidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                {record.assets?.audio_evidence ? (
                  <div className="space-y-3">
                    <AudioPlayer src={record.assets.audio_evidence.path} />
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs font-mono break-all text-muted-foreground">
                        {record.assets.audio_evidence.path}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Badge variant="outline">{record.assets.audio_evidence.type}</Badge>
                      <Badge variant="outline">{record.assets.audio_evidence.duration_sec}s</Badge>
                    </div>
                    <div>
                      <Label className="text-xs">Transcript</Label>
                      <Textarea
                        value={record.assets.audio_evidence.transcript || ''}
                        onChange={(e) => handleFieldChange('assets.audio_evidence.transcript', e.target.value)}
                        className="mt-1 text-sm"
                        rows={3}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No audio</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Middle Panel - Metadata & QA */}
          <div className="lg:col-span-2 space-y-4">
            {/* Metadata - New Format */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Landmark Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Landmark Name (location_name)</Label>
                    <Input
                      value={landmarkName}
                      onChange={(e) => handleFieldChange('metadata.geographic_info.location_name', e.target.value)}
                      className="mt-1"
                      placeholder="Tên địa danh..."
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={city}
                      onChange={(e) => handleFieldChange('metadata.geographic_info.city', e.target.value)}
                      className="mt-1"
                      placeholder="Thành phố..."
                    />
                  </div>
                  <div>
                    <Label>District</Label>
                    <Input
                      value={district}
                      onChange={(e) => handleFieldChange('metadata.geographic_info.district', e.target.value)}
                      className="mt-1"
                      placeholder="Quận/Huyện..."
                    />
                  </div>
                  <div>
                    <Label>Latitude (lat)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => handleFieldChange('metadata.geographic_info.lat', e.target.value)}
                      className="mt-1"
                      placeholder="10.123456"
                    />
                  </div>
                  <div>
                    <Label>Longitude (lon → lng)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={lng}
                      onChange={(e) => handleFieldChange('metadata.geographic_info.lon', e.target.value)}
                      className="mt-1"
                      placeholder="106.123456"
                    />
                  </div>
                  <div>
                    <Label>Source URL (page_url)</Label>
                    <Input
                      value={sourceUrl}
                      onChange={(e) => handleFieldChange('metadata.geographic_info.page_url', e.target.value)}
                      className="mt-1"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>License (license_info)</Label>
                    <Input
                      value={license}
                      onChange={(e) => handleFieldChange('metadata.geographic_info.license_info', e.target.value)}
                      className="mt-1"
                      placeholder="CC BY-SA 4.0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QA Items */}
            {record.qa_items.map((qa, qaIndex) => (
              <Card key={qa.qa_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      QA #{qaIndex + 1}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{getQAType(qa)}</Badge>
                      {qa.modality_in?.map(m => (
                        <Badge key={m} className="bg-primary/10 text-primary text-xs">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={getQAType(qa)}
                      onValueChange={(v) => {
                        // Update scenario based on type
                        let scenario = qa.scenario;
                        if (v === 'ask_image') scenario = 'text_ask_image';
                        else if (v === 'ask_audio') scenario = 'text_ask_audio';
                        else scenario = 'text_ask_image'; // ask_both defaults to image
                        handleFieldChange(`qa_items[${qaIndex}].scenario`, scenario);
                      }}
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

                  <Separator />

                  <div>
                    <Label>Question (q)</Label>
                    <Textarea
                      value={qa.query?.text || qa.query?.audio_query_transcript || ''}
                      onChange={(e) => handleFieldChange(`qa_items[${qaIndex}].query.text`, e.target.value)}
                      className="mt-1"
                      rows={2}
                      placeholder="Nhập câu hỏi..."
                    />
                  </div>

                  <div>
                    <Label>Answer (a)</Label>
                    <Textarea
                      value={qa.target?.answer || ''}
                      onChange={(e) => handleFieldChange(`qa_items[${qaIndex}].target.answer`, e.target.value)}
                      className="mt-1"
                      rows={3}
                      placeholder="Nhập câu trả lời..."
                    />
                  </div>

                  {qa.query?.audio_query_path && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Audio Query</Label>
                      <AudioPlayer src={qa.query.audio_query_path} className="mt-1" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Action Bar */}
      <Card className="sticky bottom-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={goPrev} disabled={currentIndex === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Trước
              </Button>
              <Button variant="outline" onClick={goNext} disabled={currentIndex === pendingRecords.length - 1}>
                Sau
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <div className="flex gap-2">
              {editedRecord && (
                <Button variant="outline" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Lưu thay đổi
                </Button>
              )}
              <Button variant="outline" onClick={goNext}>
                <SkipForward className="h-4 w-4 mr-2" />
                Bỏ qua
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                <XCircle className="h-4 w-4 mr-2" />
                Từ chối
              </Button>
              <Button onClick={handleApprove}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Phê duyệt
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getQAType(qa: QAItem): string {
  if (qa.scenario === 'text_ask_audio' || qa.scenario === 'audio_ask_audio') {
    return 'ask_audio';
  }
  if (qa.target?.evidence_source === 'audio' && qa.scenario?.includes('image')) {
    return 'ask_both';
  }
  return 'ask_image';
}
