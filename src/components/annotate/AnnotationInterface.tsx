import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  ArrowUpDown,
  Filter,
  FolderOpen,
  Info,
  ExternalLink,
  Play,
  Pause,
  Mic,
  MessageSquare,
  Check,
  Image as ImageIcon,
  MapPin,
  Volume2
} from 'lucide-react';
import { DatasetRecord, QAPair } from '@/types/dataset';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AnnotationInterfaceProps {
  records: DatasetRecord[];
  onRecordUpdate: (record: DatasetRecord) => void;
  initialRecordId?: string;
  filteredRecordIds?: string[];
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'needs_review';

export function AnnotationInterface({ 
  records, 
  onRecordUpdate, 
  initialRecordId,
  filteredRecordIds 
}: AnnotationInterfaceProps) {
  // Get working records
  const workingRecords = useMemo(() => {
    if (filteredRecordIds && filteredRecordIds.length > 0) {
      return records.filter(r => filteredRecordIds.includes(r.id));
    }
    return records;
  }, [records, filteredRecordIds]);

  // Sidebar state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);

  // Main state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedRecord, setEditedRecord] = useState<DatasetRecord | null>(null);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filtered and sorted records for sidebar
  const filteredRecords = useMemo(() => {
    let filtered = workingRecords.filter(record => {
      const matchesSearch = 
        record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.metadata.landmark_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      const comparison = a.metadata.landmark_name.localeCompare(b.metadata.landmark_name);
      return sortAsc ? comparison : -comparison;
    });

    return filtered;
  }, [workingRecords, searchQuery, statusFilter, sortAsc]);

  // Initialize to first pending or specified record
  useEffect(() => {
    if (initialRecordId) {
      const idx = filteredRecords.findIndex(r => r.id === initialRecordId);
      if (idx !== -1) setCurrentIndex(idx);
    } else {
      const pendingIdx = filteredRecords.findIndex(r => r.status === 'pending' || r.status === 'needs_review');
      if (pendingIdx !== -1) setCurrentIndex(pendingIdx);
    }
  }, [initialRecordId, filteredRecords.length]);

  const currentRecord = filteredRecords[currentIndex];
  const record = editedRecord || currentRecord;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredRecords.length]);

  const handleFieldChange = useCallback((path: string, value: any) => {
    const updated = JSON.parse(JSON.stringify(editedRecord || currentRecord));
    const keys = path.split('.');
    let obj: any = updated;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i].includes('[')) {
        const [key, indexStr] = keys[i].split('[');
        const index = parseInt(indexStr.replace(']', ''));
        if (!obj[key]) obj[key] = [];
        if (!obj[key][index]) obj[key][index] = {};
        obj = obj[key][index];
      } else {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
    }
    
    obj[keys[keys.length - 1]] = value;
    setEditedRecord(updated);
  }, [editedRecord, currentRecord]);

  const handleReset = () => {
    setEditedRecord(null);
    toast.info('Đã reset về bản gốc');
  };

  const handleNeedsRecheck = () => {
    const toUpdate = editedRecord || record;
    onRecordUpdate({ ...toUpdate, status: 'needs_review', reviewedAt: new Date().toISOString() });
    toast.warning('Đã đánh dấu cần kiểm tra lại');
    setEditedRecord(null);
    goNext();
  };

  const handleReject = () => {
    const toUpdate = editedRecord || record;
    onRecordUpdate({ ...toUpdate, status: 'rejected', reviewedAt: new Date().toISOString() });
    toast.error('Đã từ chối record');
    setEditedRecord(null);
    goNext();
  };

  const handleApprove = () => {
    const toUpdate = editedRecord || record;
    onRecordUpdate({ ...toUpdate, status: 'approved', reviewedAt: new Date().toISOString() });
    toast.success('Đã phê duyệt');
    setEditedRecord(null);
    goNext();
  };

  const goNext = () => {
    if (currentIndex < filteredRecords.length - 1) {
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

  const selectRecord = (recordId: string) => {
    const idx = filteredRecords.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      setCurrentIndex(idx);
      setEditedRecord(null);
    }
  };

  // Audio controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Get image source
  const getImageSrc = () => {
    const imagePath = record?.paths?.image;
    if (imagePath?.startsWith('http')) return imagePath;
    if (record?.metadata?.image_spec?.original_url) return record.metadata.image_spec.original_url;
    return null;
  };

  // Status icon
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'needs_review':
        return <AlertTriangle className="h-4 w-4 text-chart-4" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Type badge color
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'ask_image':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ask_audio':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'ask_both':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Get folder name from id
  const getFolderName = (id: string) => {
    return id.toLowerCase().replace(/_/g, '_').split('_').slice(-2, -1)[0] || 'data';
  };

  if (!record) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
          <h3 className="text-xl font-semibold">Không có dữ liệu</h3>
          <p className="text-muted-foreground">Không tìm thấy record nào phù hợp với bộ lọc</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <div className="shrink-0 h-16 px-6 flex items-center justify-between border-b bg-background">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-lg">Annotate</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">Record {record.id}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search... ⌘K" 
              className="pl-9 w-64 bg-muted/50"
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Panel 1: Data Sidebar */}
        <div className="w-72 shrink-0 border-r bg-background flex flex-col">
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold">Data List</h3>
              <p className="text-xs text-muted-foreground">Select a record to annotate</p>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ID, landmark..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {/* Filter & Sort */}
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="flex-1 text-sm h-9">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="needs_review">Need Recheck</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 shrink-0"
                onClick={() => setSortAsc(!sortAsc)}
              >
                <ArrowUpDown className={cn("h-4 w-4", !sortAsc && "rotate-180")} />
              </Button>
            </div>
          </div>

          {/* Record list */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredRecords.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRecord(r.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors",
                    r.id === record.id 
                      ? "bg-primary/10 border border-primary/20" 
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs truncate">{r.id}</span>
                    </div>
                    {getStatusIcon(r.status)}
                  </div>
                  <p className="font-medium text-sm mt-1 truncate">{r.metadata.landmark_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.metadata.landmark_name.toLowerCase().replace(/\s+/g, '_')}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t text-xs text-muted-foreground">
            Showing {filteredRecords.length} / {workingRecords.length} records
          </div>
        </div>

        {/* Panel 2: Media Viewer */}
        <div className="flex-1 min-w-0 flex flex-col bg-background border-r">
          {/* Media Header */}
          <div className="p-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{record.metadata.landmark_name}</h2>
              <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 border-blue-200">
                {record.metadata.location.city}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowMetadataDialog(true)}
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>

          {/* Media Content */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 pb-4">
              {/* Image */}
              <div className="rounded-xl overflow-hidden bg-muted">
                {getImageSrc() ? (
                  <img 
                    src={getImageSrc()!} 
                    alt={record.metadata.landmark_name}
                    className="w-full h-auto object-cover max-h-80"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                ) : (
                  <div className="aspect-video flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {record.metadata.image_spec?.original_url && (
                <a 
                  href={record.metadata.image_spec.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Source Image
                </a>
              )}

              {/* Audio Evidence */}
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Audio Evidence</span>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
                    onClick={togglePlay}
                    disabled={!record.paths?.audio_evidence}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </Button>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium truncate">
                      {record.paths?.audio_evidence?.split('/').pop() || 'No audio'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-muted rounded-full">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${audioProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        00:00 / 03:00
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transcript */}
                {record.metadata.audio_spec?.transcript && (
                  <div className="bg-blue-50/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
                      {record.metadata.audio_spec.transcript}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Action Bar */}
          <div className="shrink-0 p-4 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={goPrev}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                className="border-chart-4 text-chart-4 hover:bg-chart-4/10"
                onClick={handleNeedsRecheck}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Need Recheck
              </Button>
              <Button 
                variant="outline" 
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleReject}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90"
                onClick={handleApprove}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </div>

            <Button 
              variant="outline" 
              size="icon"
              onClick={goNext}
              disabled={currentIndex === filteredRecords.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Panel 3: QA Editor */}
        <div className="w-[420px] shrink-0 flex flex-col bg-background">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">QA Pairs</h3>
              <Badge variant="outline">{record.qa_pairs?.length || 0} samples</Badge>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {record.qa_pairs?.map((qa, qaIndex) => (
                <div key={qaIndex} className="flex gap-3">
                  {/* Index */}
                  <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {qaIndex + 1}
                  </div>

                  {/* Card */}
                  <div className="flex-1 rounded-lg border p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <Select
                        value={qa.type}
                        onValueChange={(v) => handleFieldChange(`qa_pairs[${qaIndex}].type`, v)}
                      >
                        <SelectTrigger className={cn("w-28 h-7 text-xs font-medium", getTypeBadgeClass(qa.type))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ask_image">ASK IMAGE</SelectItem>
                          <SelectItem value="ask_audio">ASK AUDIO</SelectItem>
                          <SelectItem value="ask_both">ASK BOTH</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground truncate">
                        {qa.paths?.question_audio?.split('/').pop()}
                      </span>
                    </div>

                    {/* Question */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        <Textarea
                          value={qa.q || ''}
                          onChange={(e) => handleFieldChange(`qa_pairs[${qaIndex}].q`, e.target.value)}
                          className="flex-1 min-h-[60px] text-sm resize-none"
                          placeholder="Nhập câu hỏi..."
                        />
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                          {qa.audio_meta?.q_voice?.id || 'vi-VN-HoaiMyNeural'}
                        </Badge>
                        {qa.audio_meta?.q_voice?.rate && (
                          <Badge variant="outline" className="text-xs">
                            🎵 {qa.audio_meta.q_voice.rate}
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <Textarea
                          value={qa.a || ''}
                          onChange={(e) => handleFieldChange(`qa_pairs[${qaIndex}].a`, e.target.value)}
                          className="flex-1 min-h-[80px] text-sm resize-none"
                          placeholder="Nhập câu trả lời..."
                        />
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                          {qa.audio_meta?.a_voice?.id || 'vi-VN-HoaiMyNeural'}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Metadata Dialog */}
      <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Metadata
              <span className="text-muted-foreground font-normal text-sm">
                {record.id} • {record.metadata.landmark_name}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 mt-4">
            {/* Location Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <span className="font-semibold">Location Details</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">City</Label>
                  <Input
                    value={record.metadata.location.city}
                    onChange={(e) => handleFieldChange('metadata.location.city', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">District</Label>
                  <Input
                    value={record.metadata.location.district}
                    onChange={(e) => handleFieldChange('metadata.location.district', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={record.metadata.location.gps?.lat || ''}
                    onChange={(e) => handleFieldChange('metadata.location.gps.lat', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Longitude (LON)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={record.metadata.location.gps?.lon || ''}
                    onChange={(e) => handleFieldChange('metadata.location.gps.lon', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Image Specification */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-purple-600">
                <ImageIcon className="h-4 w-4" />
                <span className="font-semibold">Image Specification</span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Original URL</Label>
                  <Input
                    value={record.metadata.image_spec?.original_url || ''}
                    onChange={(e) => handleFieldChange('metadata.image_spec.original_url', e.target.value)}
                    className="bg-purple-50 border-purple-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Source</Label>
                    <Input
                      value={record.metadata.image_spec?.source || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.source', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">License</Label>
                    <Input
                      value={record.metadata.image_spec?.license || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.license', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                  <Input
                    value={record.metadata.image_spec?.description || ''}
                    onChange={(e) => handleFieldChange('metadata.image_spec.description', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Match Info</Label>
                  <Input
                    value={record.metadata.image_spec?.match_info || ''}
                    onChange={(e) => handleFieldChange('metadata.image_spec.match_info', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Audio Specification - Full width */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Volume2 className="h-4 w-4" />
                <span className="font-semibold">Audio Specification</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Transcript</Label>
                  <Textarea
                    value={record.metadata.audio_spec?.transcript || ''}
                    onChange={(e) => handleFieldChange('metadata.audio_spec.transcript', e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Voice ID</Label>
                  <Input
                    value={record.metadata.audio_spec?.voice_id || ''}
                    onChange={(e) => handleFieldChange('metadata.audio_spec.voice_id', e.target.value)}
                  />
                  <p className="text-xs text-orange-600 mt-2">
                    <strong>Note:</strong> Changing the Voice ID affects generation parameters for future synthesis.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowMetadataDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (editedRecord) {
                onRecordUpdate(editedRecord);
              }
              setShowMetadataDialog(false);
              toast.success('Đã lưu thay đổi metadata');
            }}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden audio element */}
      {record.paths?.audio_evidence && (
        <audio 
          ref={audioRef}
          src={record.paths.audio_evidence}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={(e) => {
            const audio = e.target as HTMLAudioElement;
            setAudioProgress((audio.currentTime / audio.duration) * 100);
          }}
          onLoadedMetadata={(e) => {
            setAudioDuration((e.target as HTMLAudioElement).duration);
          }}
        />
      )}
    </div>
  );
}
