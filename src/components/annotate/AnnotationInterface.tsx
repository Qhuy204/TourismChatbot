import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  Edit3
} from 'lucide-react';
import { DatasetRecord, QAItem, Scenario } from '@/types/dataset';
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Annotation Interface</h2>
          <p className="text-muted-foreground">Chỉnh sửa và xác thực dữ liệu dataset</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Record {currentIndex + 1} / {pendingRecords.length}</p>
          <Progress value={progress} className="w-48 h-2 mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              {record.assets.image_path ? (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center">
                    <Image className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2 px-4 break-all">
                      {record.assets.image_path}
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
              {record.assets.audio_evidence ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-mono break-all">
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
                      value={record.assets.audio_evidence.transcript}
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
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entity Name</Label>
                <Input
                  value={record.metadata.entity_name}
                  onChange={(e) => handleFieldChange('metadata.entity_name', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Topic</Label>
                <Input
                  value={record.metadata.topic}
                  onChange={(e) => handleFieldChange('metadata.topic', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={record.metadata.location.city}
                  onChange={(e) => handleFieldChange('metadata.location.city', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>District</Label>
                <Input
                  value={record.metadata.location.district}
                  onChange={(e) => handleFieldChange('metadata.location.district', e.target.value)}
                  className="mt-1"
                />
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
                    {qa.qa_id}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{qa.scenario}</Badge>
                    {qa.modality_in.map(m => (
                      <Badge key={m} className="bg-primary/10 text-primary text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Scenario</Label>
                  <Select
                    value={qa.scenario}
                    onValueChange={(v) => handleFieldChange(`qa_items[${qaIndex}].scenario`, v)}
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

                <Separator />

                <div>
                  <Label>Query Text</Label>
                  <Textarea
                    value={qa.query.text || ''}
                    onChange={(e) => handleFieldChange(`qa_items[${qaIndex}].query.text`, e.target.value || null)}
                    className="mt-1"
                    rows={2}
                    placeholder="Nhập câu hỏi..."
                  />
                </div>

                {qa.query.audio_query_path && (
                  <div>
                    <Label>Audio Query Transcript</Label>
                    <Textarea
                      value={qa.query.audio_query_transcript || ''}
                      onChange={(e) => handleFieldChange(`qa_items[${qaIndex}].query.audio_query_transcript`, e.target.value || null)}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                )}

                <Separator />

                <div>
                  <Label>Target Answer</Label>
                  <Textarea
                    value={qa.target.answer}
                    onChange={(e) => handleFieldChange(`qa_items[${qaIndex}].target.answer`, e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Evidence Source</Label>
                    <Select
                      value={qa.target.evidence_source}
                      onValueChange={(v) => handleFieldChange(`qa_items[${qaIndex}].target.evidence_source`, v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Answer Format</Label>
                    <Select
                      value={qa.target.answer_format}
                      onValueChange={(v) => handleFieldChange(`qa_items[${qaIndex}].target.answer_format`, v)}
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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
