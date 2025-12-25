import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AudioPlayer } from '@/components/ui/audio-player';
import { 
  MapPin, 
  Image, 
  Volume2, 
  MessageSquare, 
  FileJson,
  Copy,
  CheckCircle2,
  XCircle
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
      onUpdate({ ...record, status: 'approved', reviewedAt: new Date().toISOString() });
    }
    toast.success('Đã phê duyệt record');
    onClose();
  };

  const handleReject = () => {
    if (onUpdate) {
      onUpdate({ ...record, status: 'rejected', reviewedAt: new Date().toISOString() });
    }
    toast.error('Đã từ chối record');
    onClose();
  };

  return (
    <Dialog open={!!record} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{record.metadata.entity_name}</DialogTitle>
              <p className="text-sm text-muted-foreground font-mono mt-1">{record.record_id}</p>
            </div>
            <Badge className={
              record.status === 'approved' ? 'bg-accent text-accent-foreground' :
              record.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
              record.status === 'reviewed' ? 'bg-chart-3/10 text-chart-3' :
              'bg-muted text-muted-foreground'
            }>
              {record.status || 'pending'}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="qa">QA Items ({record.qa_items.length})</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Topic</p>
                  <p className="font-medium">{record.metadata.topic}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Địa điểm</p>
                  <p className="font-medium">{record.metadata.location.city}, {record.metadata.location.district}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tọa độ</p>
                  <p className="font-medium font-mono text-xs">
                    [{record.metadata.location.lat_long[0].toFixed(4)}, {record.metadata.location.lat_long[1].toFixed(4)}]
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {record.metadata.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assets" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Image Asset
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {record.assets.image_path ? (
                    <div className="space-y-2">
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                        <div className="text-center">
                          <Image className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mt-2">Preview</p>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        {record.assets.image_path}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Không có ảnh</p>
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
                      <AudioPlayer src={record.assets.audio_evidence.path} />
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-mono break-all text-muted-foreground">
                          {record.assets.audio_evidence.path}
                        </p>
                      </div>
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
                      <div>
                        <p className="text-muted-foreground text-xs">Transcript</p>
                        <p className="text-sm mt-1">{record.assets.audio_evidence.transcript}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Không có audio</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="qa" className="space-y-4 mt-4">
            {record.qa_items.map((qa, index) => (
              <Card key={qa.qa_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {qa.qa_id}
                    </CardTitle>
                    <Badge variant="outline">{qa.scenario}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    {qa.modality_in.map((mod) => (
                      <Badge key={mod} className="bg-primary/10 text-primary">
                        {mod}
                      </Badge>
                    ))}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-muted-foreground text-xs font-medium mb-2">Query</p>
                    {qa.query.text && (
                      <p className="text-sm bg-muted p-3 rounded-lg">{qa.query.text}</p>
                    )}
                    {qa.query.audio_query_path && (
                      <div className="mt-2 space-y-2">
                        <AudioPlayer src={qa.query.audio_query_path} />
                        {qa.query.audio_query_transcript && (
                          <p className="text-sm text-muted-foreground italic">
                            "{qa.query.audio_query_transcript}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground text-xs font-medium mb-2">Target Answer</p>
                    <div className="bg-accent/50 p-3 rounded-lg">
                      <p className="text-sm">{qa.target.answer}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          Source: {qa.target.evidence_source}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Format: {qa.target.answer_format}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="json" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON Data
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleCopyJson}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(record, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Đóng
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
      </DialogContent>
    </Dialog>
  );
}
