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
  MapPin
} from 'lucide-react';
import { DatasetRecord, QAPair } from '@/types/dataset';
import { toast } from 'sonner';

interface AnnotationInterfaceProps {
  records: DatasetRecord[];
  onRecordUpdate: (record: DatasetRecord) => void;
}

export function AnnotationInterface({ records, onRecordUpdate }: AnnotationInterfaceProps) {
  const pendingRecords = useMemo(() => 
    records.filter(r => r.status === 'pending' || r.status === 'needs_review'), 
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
    
    const updated = JSON.parse(JSON.stringify(editedRecord || record));
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
      onRecordUpdate({ ...editedRecord, status: 'needs_review', reviewedAt: new Date().toISOString() });
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

  // Get image source
  const getImageSrc = () => {
    const imagePath = record.paths?.image;
    if (imagePath?.startsWith('http')) return imagePath;
    if (record.metadata.image_spec?.original_url) return record.metadata.image_spec.original_url;
    return null;
  };

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
                {getImageSrc() ? (
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={getImageSrc()!} 
                      alt={record.metadata.landmark_name}
                      className="w-full h-auto object-contain max-h-64"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Image className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mt-2 px-4 break-all">
                        {record.paths?.image}
                      </p>
                    </div>
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
                {record.paths?.audio_evidence ? (
                  <div className="space-y-3">
                    <AudioPlayer src={record.paths.audio_evidence} />
                    {record.metadata.audio_spec && (
                      <div>
                        <Label className="text-xs">Transcript</Label>
                        <Textarea
                          value={record.metadata.audio_spec.transcript || ''}
                          onChange={(e) => handleFieldChange('metadata.audio_spec.transcript', e.target.value)}
                          className="mt-1 text-sm"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No audio</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Middle Panel - Metadata & QA */}
          <div className="lg:col-span-2 space-y-4">
            {/* Metadata */}
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
                    <Label>Landmark Name</Label>
                    <Input
                      value={record.metadata.landmark_name}
                      onChange={(e) => handleFieldChange('metadata.landmark_name', e.target.value)}
                      className="mt-1"
                      placeholder="Tên địa danh..."
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={record.metadata.location.city}
                      onChange={(e) => handleFieldChange('metadata.location.city', e.target.value)}
                      className="mt-1"
                      placeholder="Thành phố..."
                    />
                  </div>
                  <div>
                    <Label>District</Label>
                    <Input
                      value={record.metadata.location.district}
                      onChange={(e) => handleFieldChange('metadata.location.district', e.target.value)}
                      className="mt-1"
                      placeholder="Quận/Huyện..."
                    />
                  </div>
                  <div>
                    <Label>Latitude (lat)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={record.metadata.location.gps?.lat || ''}
                      onChange={(e) => handleFieldChange('metadata.location.gps.lat', parseFloat(e.target.value) || 0)}
                      className="mt-1"
                      placeholder="10.123456"
                    />
                  </div>
                  <div>
                    <Label>Longitude (lon)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={record.metadata.location.gps?.lon || ''}
                      onChange={(e) => handleFieldChange('metadata.location.gps.lon', parseFloat(e.target.value) || 0)}
                      className="mt-1"
                      placeholder="106.123456"
                    />
                  </div>
                  <div>
                    <Label>Source URL</Label>
                    <Input
                      value={record.metadata.image_spec?.original_url || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.original_url', e.target.value)}
                      className="mt-1"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>License</Label>
                    <Input
                      value={record.metadata.image_spec?.license || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.license', e.target.value)}
                      className="mt-1"
                      placeholder="CC BY-SA 4.0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QA Pairs */}
            {record.qa_pairs?.map((qa, qaIndex) => (
              <Card key={qaIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      QA #{qaIndex + 1}
                    </CardTitle>
                    <Badge variant="outline">{qa.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={qa.type}
                      onValueChange={(v) => handleFieldChange(`qa_pairs[${qaIndex}].type`, v)}
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
                      value={qa.q || ''}
                      onChange={(e) => handleFieldChange(`qa_pairs[${qaIndex}].q`, e.target.value)}
                      className="mt-1"
                      rows={2}
                      placeholder="Nhập câu hỏi..."
                    />
                  </div>

                  <div>
                    <Label>Answer (a)</Label>
                    <Textarea
                      value={qa.a || ''}
                      onChange={(e) => handleFieldChange(`qa_pairs[${qaIndex}].a`, e.target.value)}
                      className="mt-1"
                      rows={3}
                      placeholder="Nhập câu trả lời..."
                    />
                  </div>

                  {qa.paths?.question_audio && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Audio Query</Label>
                      <AudioPlayer src={qa.paths.question_audio} className="mt-1" />
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
