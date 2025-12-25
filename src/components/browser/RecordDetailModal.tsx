import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AudioPlayer } from '@/components/ui/audio-player';
import { 
  MapPin, 
  Image as ImageIcon, 
  Volume2, 
  MessageSquare, 
  FileJson,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Clock,
  Tag,
  Info,
  BookOpen
} from 'lucide-react';
import { DatasetRecord } from '@/types/dataset';
import { toast } from 'sonner';

interface RecordDetailModalProps {
  record: DatasetRecord | null;
  onClose: () => void;
  onUpdate?: (record: DatasetRecord) => void;
}

export function RecordDetailModal({ record, onClose, onUpdate }: RecordDetailModalProps) {
  if (!record) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    toast.success('Đã copy JSON vào clipboard');
  };

  const handleApprove = () => {
    if (onUpdate) {
      onUpdate({ ...record, status: 'approved', reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    toast.success('Đã phê duyệt record');
    onClose();
  };

  const handleReject = () => {
    if (onUpdate) {
      onUpdate({ ...record, status: 'rejected', reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    toast.error('Đã từ chối record');
    onClose();
  };

  const handleWarning = () => {
    if (onUpdate) {
      onUpdate({ ...record, status: 'warning', reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    toast.warning('Đã đánh dấu cần xem xét');
    onClose();
  };

  const getImageSrc = () => {
    if (record.assets.image_url) return record.assets.image_url;
    if (record.assets.image_path?.startsWith('http')) return record.assets.image_path;
    return null;
  };

  const imageSrc = getImageSrc();

  return (
    <Dialog open={!!record} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl">{record.metadata.entity_name}</DialogTitle>
                <p className="text-sm text-muted-foreground font-mono mt-1">{record.record_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={
                  record.status === 'approved' ? 'bg-accent text-accent-foreground' :
                  record.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                  record.status === 'reviewed' ? 'bg-chart-3/10 text-chart-3' :
                  record.status === 'warning' ? 'bg-chart-4/10 text-chart-4' :
                  'bg-muted text-muted-foreground'
                }>
                  {record.status || 'pending'}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleCopyJson}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
              {/* Left Column - Image & Assets */}
              <div className="lg:col-span-1 border-r overflow-y-auto p-4 space-y-4">
                {/* Image Preview */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Hình ảnh
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {imageSrc ? (
                      <div className="space-y-2">
                        <div className="rounded-lg overflow-hidden bg-muted">
                          <img 
                            src={imageSrc} 
                            alt={record.metadata.entity_name}
                            className="w-full h-auto object-contain max-h-80"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>
                        <a 
                          href={imageSrc} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Mở ảnh gốc
                        </a>
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {record.assets.image_path && !imageSrc && (
                      <p className="text-xs font-mono text-muted-foreground mt-2 break-all">
                        Path: {record.assets.image_path}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Audio Evidence */}
                {record.assets.audio_evidence && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Volume2 className="h-4 w-4" />
                        Audio Evidence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <AudioPlayer src={record.assets.audio_evidence.path} />
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Type</p>
                          <Badge variant="outline">{record.assets.audio_evidence.type}</Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Duration</p>
                          <p className="font-medium">{record.assets.audio_evidence.duration_sec}s</p>
                        </div>
                      </div>
                      {record.assets.audio_evidence.transcript && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Transcript</p>
                          <p className="text-sm bg-muted p-2 rounded">{record.assets.audio_evidence.transcript}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Metadata */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Metadata
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Topic</p>
                      <p className="font-medium">{record.metadata.topic}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{record.metadata.location.city}, {record.metadata.location.district}</span>
                    </div>
                    {record.metadata.location.lat_long[0] !== 0 && (
                      <div className="text-xs font-mono text-muted-foreground">
                        Tọa độ: [{record.metadata.location.lat_long[0].toFixed(4)}, {record.metadata.location.lat_long[1].toFixed(4)}]
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {record.metadata.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {record.createdAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Tạo: {new Date(record.createdAt).toLocaleString('vi-VN')}
                      </div>
                    )}
                    {record.reviewedAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Review: {new Date(record.reviewedAt).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Geographic Info */}
                {record.metadata.geographic_info && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Thông tin địa lý
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {record.metadata.geographic_info.location_name && (
                        <div>
                          <p className="text-muted-foreground text-xs">Tên địa điểm</p>
                          <p className="font-medium">{record.metadata.geographic_info.location_name}</p>
                        </div>
                      )}
                      {record.metadata.geographic_info.location_type && (
                        <div>
                          <p className="text-muted-foreground text-xs">Loại địa điểm</p>
                          <p>{record.metadata.geographic_info.location_type}</p>
                        </div>
                      )}
                      {record.metadata.geographic_info.opening_hours && (
                        <div>
                          <p className="text-muted-foreground text-xs">Giờ mở cửa</p>
                          <p>{record.metadata.geographic_info.opening_hours}</p>
                        </div>
                      )}
                      {record.metadata.geographic_info.ticket_price && (
                        <div>
                          <p className="text-muted-foreground text-xs">Giá vé</p>
                          <p>{record.metadata.geographic_info.ticket_price}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Middle Column - Descriptions */}
              <div className="lg:col-span-1 border-r overflow-y-auto p-4 space-y-4">
                {/* Image Description */}
                {record.metadata.image_description && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Mô tả hình ảnh
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{record.metadata.image_description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Knowledge Description */}
                {record.metadata.knowledge_description && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Kiến thức
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{record.metadata.knowledge_description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* JSON Preview */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSON Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-60">
                      <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto">
                        {JSON.stringify(record, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - QA Items */}
              <div className="lg:col-span-1 overflow-y-auto p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  QA Items ({record.qa_items.length})
                </h3>
                
                <div className="space-y-3">
                  {record.qa_items.map((qa, index) => (
                    <Card key={qa.qa_id} className="overflow-hidden">
                      <CardHeader className="py-2 px-3 bg-muted/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono">{qa.qa_id}</span>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">{qa.scenario}</Badge>
                            {qa.answer_type && (
                              <Badge variant="secondary" className="text-xs">{qa.answer_type}</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 space-y-3">
                        {/* Query */}
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-1">Câu hỏi</p>
                          {qa.query.text && (
                            <p className="text-sm bg-primary/5 p-2 rounded border-l-2 border-primary">
                              {qa.query.text}
                            </p>
                          )}
                          {qa.query.audio_query_path && (
                            <div className="mt-2">
                              <AudioPlayer src={qa.query.audio_query_path} />
                              {qa.query.audio_query_transcript && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  "{qa.query.audio_query_transcript}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Answer */}
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-1">Câu trả lời</p>
                          <p className="text-sm bg-accent/30 p-2 rounded border-l-2 border-accent">
                            {qa.target.answer}
                          </p>
                          {qa.target.alternative_answers && qa.target.alternative_answers.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-muted-foreground">Câu trả lời khác:</p>
                              {qa.target.alternative_answers.map((alt, i) => (
                                <p key={i} className="text-xs bg-muted p-2 rounded">
                                  {alt}
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {qa.target.evidence_source}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {qa.target.answer_format}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button variant="outline" onClick={handleWarning}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Cần xem xét
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
      </DialogContent>
    </Dialog>
  );
}
