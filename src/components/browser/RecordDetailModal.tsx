import { useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AudioPlayer } from '@/components/ui/audio-player';
import { 
  MapPin, 
  Image as ImageIcon, 
  Volume2, 
  MessageSquare, 
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { DatasetRecord } from '@/types/dataset';
import { toast } from 'sonner';

interface RecordDetailModalProps {
  record: DatasetRecord | null;
  onClose: () => void;
  onUpdate?: (record: DatasetRecord) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  currentIndex?: number;
  totalRecords?: number;
}

export function RecordDetailModal({ 
  record, 
  onClose, 
  onUpdate, 
  onNavigate,
  currentIndex = -1,
  totalRecords = 0 
}: RecordDetailModalProps) {
  
  // Keyboard navigation
  useEffect(() => {
    if (!record || !onNavigate) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate('next');
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [record, onNavigate, onClose]);

  const exportFormatJson = useMemo(() => {
    if (!record) return '';
    return JSON.stringify(record, null, 2);
  }, [record]);

  if (!record) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(exportFormatJson);
    toast.success('Đã copy JSON vào clipboard');
  };

  const handleStatusChange = (newStatus: 'approved' | 'rejected' | 'needs_review' | 'pending') => {
    if (onUpdate) {
      onUpdate({ ...record, status: newStatus, reviewedAt: new Date().toISOString() });
    }
    const messages = {
      approved: 'Đã phê duyệt record',
      rejected: 'Đã từ chối record',
      needs_review: 'Đã đánh dấu cần xem xét',
      pending: 'Đã đặt lại về trạng thái chờ xử lý'
    };
    const toastFn = newStatus === 'approved' ? toast.success : 
                    newStatus === 'rejected' ? toast.error : 
                    toast.warning;
    toastFn(messages[newStatus]);
  };

  const handleApprove = () => handleStatusChange('approved');
  const handleReject = () => handleStatusChange('rejected');
  const handleNeedsReview = () => handleStatusChange('needs_review');
  const handleResetToPending = () => handleStatusChange('pending');

  const isAlreadyReviewed = record.status === 'approved' || record.status === 'rejected';

  const getImageSrc = () => {
    const imagePath = record.paths?.image;
    if (imagePath?.startsWith('http')) return imagePath;
    // Check image_spec for original_url
    if (record.metadata.image_spec?.original_url) return record.metadata.image_spec.original_url;
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
              <div className="flex items-center gap-4">
                {/* Navigation buttons */}
                {onNavigate && (
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => onNavigate('prev')}
                      disabled={currentIndex <= 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      {currentIndex + 1} / {totalRecords}
                    </span>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => onNavigate('next')}
                      disabled={currentIndex >= totalRecords - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div>
                  <DialogTitle className="text-xl">{record.metadata.landmark_name}</DialogTitle>
                  <p className="text-sm text-muted-foreground font-mono mt-1">{record.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={
                  record.status === 'approved' ? 'bg-accent text-accent-foreground' :
                  record.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                  record.status === 'needs_review' ? 'bg-chart-4/10 text-chart-4' :
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
            <p className="text-xs text-muted-foreground mt-2">
              Sử dụng phím ← → để chuyển record
            </p>
          </DialogHeader>

          {/* Main Content with ScrollArea */}
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 min-h-full">
              {/* Left Column - Image & Assets */}
              <div className="lg:col-span-1 border-r p-4 space-y-4">
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
                            alt={record.metadata.landmark_name}
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
                    <p className="text-xs font-mono text-muted-foreground mt-2 break-all">
                      Path: {record.paths?.image}
                    </p>
                  </CardContent>
                </Card>

                {/* Audio Evidence */}
                {record.paths?.audio_evidence && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Volume2 className="h-4 w-4" />
                        Audio Evidence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <AudioPlayer src={record.paths.audio_evidence} />
                      {record.metadata.audio_spec?.transcript && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Transcript</p>
                          <p className="text-sm bg-muted p-2 rounded max-h-32 overflow-y-auto">
                            {record.metadata.audio_spec.transcript}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Metadata */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Landmark</p>
                      <p className="font-medium">{record.metadata.landmark_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{record.metadata.location.city}, {record.metadata.location.district}</span>
                    </div>
                    {record.metadata.location.gps && (
                      <div className="text-xs font-mono text-muted-foreground">
                        GPS: [{record.metadata.location.gps.lat?.toFixed(4)}, {record.metadata.location.gps.lon?.toFixed(4)}]
                      </div>
                    )}
                    {record.metadata.image_spec?.license && (
                      <div>
                        <p className="text-muted-foreground text-xs">License</p>
                        <p>{record.metadata.image_spec.license}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Middle Column - JSON */}
              <div className="lg:col-span-1 border-r p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">JSON Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[60vh]">
                      <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">
                        {exportFormatJson}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - QA Pairs */}
              <div className="lg:col-span-1 p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      QA Pairs ({record.qa_pairs?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[60vh]">
                      <div className="space-y-4">
                        {record.qa_pairs?.map((qa, idx) => (
                          <div key={idx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">QA #{idx + 1}</span>
                              <Badge variant="outline">{qa.type}</Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Question</p>
                              <p className="text-sm">{qa.q}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Answer</p>
                              <p className="text-sm">{qa.a}</p>
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">
                              <p>Q Audio: {qa.paths?.question_audio}</p>
                              <p>A Audio: {qa.paths?.answer_audio}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ScrollArea>

          {/* Action Bar */}
          <div className="border-t px-6 py-4 shrink-0 flex items-center justify-between gap-3">
            {/* Left side - Edit/Reset option for already reviewed records */}
            <div>
              {isAlreadyReviewed && (
                <Button variant="ghost" onClick={handleResetToPending}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Đặt lại về Pending (Sửa lại)
                </Button>
              )}
            </div>
            
            {/* Right side - Review actions */}
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleNeedsReview}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
