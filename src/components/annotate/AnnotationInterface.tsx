import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
  Volume2,
  Loader2
} from 'lucide-react';
import { DatasetRecord, QAPair } from '@/types/dataset';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface AnnotationInterfaceProps {
  records: DatasetRecord[];
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
  onRecordUpdate: (record: DatasetRecord) => void;
  initialRecordId?: string;
  filteredRecordIds?: string[];
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'needs_review';

export function AnnotationInterface({ 
  records, 
  totalCount = 0,
  loadedCount = 0,
  onLoadMore,
  onRecordUpdate, 
  initialRecordId,
  filteredRecordIds 
}: AnnotationInterfaceProps) {
  // Get working records - only IDs for sidebar, load full data on demand
  // filteredRecordIds are UUIDs (db_id), records.id is record_id (string from data)
  const workingRecordIds = useMemo(() => {
    if (filteredRecordIds && filteredRecordIds.length > 0) {
      // filteredRecordIds are database UUIDs (db_id), so use db_id for matching
      return filteredRecordIds;
    }
    // When no filter, use db_id for consistency
    return records.map(r => r.db_id || r.id);
  }, [records, filteredRecordIds]);

  // Cache for loaded records
  const [recordCache, setRecordCache] = useState<Map<string, DatasetRecord>>(new Map());
  const [loadingRecordIds, setLoadingRecordIds] = useState<Set<string>>(new Set());

  // Load record data when needed (recordId could be db_id or record.id)
  const loadRecord = useCallback(async (recordId: string) => {
    if (recordCache.has(recordId) || loadingRecordIds.has(recordId)) return;
    
    // Try to find by db_id first (for task-based annotation), then by id
    const record = records.find(r => r.db_id === recordId || r.id === recordId);
    if (record) {
      setRecordCache(prev => new Map(prev).set(recordId, record));
      return;
    }
    
    // If not found in local records, fetch from database (for task-based annotation)
    setLoadingRecordIds(prev => new Set(prev).add(recordId));
    try {
      const { data, error } = await supabase
        .from('dataset_records')
        .select('*')
        .eq('id', recordId)
        .single();
      
      if (!error && data) {
        const recordData = data.data as unknown as DatasetRecord;
        const mapped: DatasetRecord = {
          ...recordData,
          status: data.status as DatasetRecord['status'],
          db_id: data.id,
        };
        setRecordCache(prev => new Map(prev).set(recordId, mapped));
      }
    } catch (err) {
      console.error('Error loading record:', err);
    } finally {
      setLoadingRecordIds(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  }, [records, recordCache, loadingRecordIds]);

  // Batch load records when filteredRecordIds is provided (task-based annotation)
  const hasLoadedFilteredRecords = useRef(false);
  useEffect(() => {
    if (!filteredRecordIds || filteredRecordIds.length === 0 || hasLoadedFilteredRecords.current) return;
    
    // Check which IDs need to be fetched from DB
    const idsToFetch = filteredRecordIds.filter(id => 
      !recordCache.has(id) && !records.find(r => r.db_id === id)
    );
    
    if (idsToFetch.length === 0) {
      hasLoadedFilteredRecords.current = true;
      return;
    }
    
    // Batch fetch records from database
    const fetchRecords = async () => {
      setLoadingRecordIds(prev => new Set([...prev, ...idsToFetch]));
      try {
        // Fetch in batches of 100
        const batchSize = 100;
        for (let i = 0; i < idsToFetch.length; i += batchSize) {
          const batch = idsToFetch.slice(i, i + batchSize);
          const { data, error } = await supabase
            .from('dataset_records')
            .select('*')
            .in('id', batch);
          
          if (!error && data) {
            const mappedRecords = new Map<string, DatasetRecord>();
            for (const row of data) {
              const recordData = row.data as unknown as DatasetRecord;
              mappedRecords.set(row.id, {
                ...recordData,
                status: row.status as DatasetRecord['status'],
                db_id: row.id,
              });
            }
            setRecordCache(prev => new Map([...prev, ...mappedRecords]));
          }
        }
      } catch (err) {
        console.error('Error batch loading records:', err);
      } finally {
        setLoadingRecordIds(new Set());
        hasLoadedFilteredRecords.current = true;
      }
    };
    
    fetchRecords();
  }, [filteredRecordIds, records, recordCache]);

  // Get sidebar items (minimal data) - create from records directly for efficiency
  const allSidebarItems = useMemo(() => {
    return workingRecordIds.map(workingId => {
      const cached = recordCache.get(workingId);
      // workingId could be db_id (UUID) or record.id depending on filter mode
      const original = records.find(r => r.db_id === workingId || r.id === workingId);
      return {
        id: workingId,
        record_id: original?.id || cached?.id || workingId, // for display
        status: cached?.status || original?.status,
        landmark_name: cached?.metadata?.landmark_name || original?.metadata?.landmark_name || 'Loading...',
      };
    });
  }, [workingRecordIds, recordCache, records]);

  // Sidebar state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Main state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedRecord, setEditedRecord] = useState<DatasetRecord | null>(null);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Infinite scroll state - start with 5% of total
  const initialVisibleCount = useMemo(() => {
    const fivePercent = Math.ceil((totalCount || records.length) * 0.05);
    return Math.max(100, Math.min(fivePercent, records.length));
  }, [totalCount, records.length]);
  
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Filtered and sorted sidebar items (full list for navigation)
  const filteredSidebarItems = useMemo(() => {
    let filtered = allSidebarItems.filter(item => {
      const matchesSearch = 
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.landmark_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      const comparison = a.landmark_name.localeCompare(b.landmark_name);
      return sortAsc ? comparison : -comparison;
    });

    return filtered;
  }, [allSidebarItems, searchQuery, statusFilter, sortAsc]);

  // Visible items for rendering (limited for performance)
  const visibleSidebarItems = useMemo(() => {
    return filteredSidebarItems.slice(0, visibleCount);
  }, [filteredSidebarItems, visibleCount]);

  // Reset visible count when filters change - use 5% of filtered list
  useEffect(() => {
    const fivePercent = Math.ceil(filteredSidebarItems.length * 0.05);
    setVisibleCount(Math.max(100, fivePercent));
  }, [searchQuery, statusFilter, sortAsc, filteredSidebarItems.length]);

  // Handle scroll to load more (5% more each time)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // Load more when scrolled to 80% of the list
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      const fivePercent = Math.ceil((totalCount || records.length) * 0.05);
      const increment = Math.max(100, fivePercent);
      setVisibleCount(prev => Math.min(prev + increment, filteredSidebarItems.length));
      
      // Also trigger loading more from database if needed
      if (onLoadMore && loadedCount < (totalCount || 0) && visibleCount >= loadedCount * 0.8) {
        onLoadMore();
      }
    }
  }, [filteredSidebarItems.length, totalCount, records.length, onLoadMore, loadedCount, visibleCount]);

  // Get filtered record IDs for navigation
  const filteredRecordIds_internal = useMemo(() => filteredSidebarItems.map(i => i.id), [filteredSidebarItems]);

  // Initialize to first pending or specified record
  useEffect(() => {
    if (initialRecordId) {
      // Match by id (which could be db_id or record_id depending on source)
      const idx = filteredSidebarItems.findIndex(r => 
        r.id === initialRecordId || r.record_id === initialRecordId
      );
      if (idx !== -1) {
        setCurrentIndex(idx);
        // Make sure the record is visible in the list
        if (idx >= visibleCount) {
          setVisibleCount(idx + 50);
        }
      }
    } else {
      const pendingIdx = filteredSidebarItems.findIndex(r => r.status === 'pending' || r.status === 'needs_review');
      if (pendingIdx !== -1) setCurrentIndex(pendingIdx);
    }
  }, [initialRecordId, filteredSidebarItems.length]);

  // Load current record on demand
  const currentRecordId = filteredSidebarItems[currentIndex]?.id;
  useEffect(() => {
    if (currentRecordId) loadRecord(currentRecordId);
  }, [currentRecordId, loadRecord]);

  const currentRecord = currentRecordId ? (recordCache.get(currentRecordId) || records.find(r => r.db_id === currentRecordId || r.id === currentRecordId)) : undefined;
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
  }, [currentIndex, filteredSidebarItems.length]);

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
    if (currentIndex < filteredSidebarItems.length - 1) {
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
    const idx = filteredSidebarItems.findIndex(r => r.id === recordId);
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

  // Get image source - uses displayRecord which is defined after render checks
  const getImageSrc = (rec: DatasetRecord | undefined) => {
    if (!rec) return null;
    const imagePath = rec.paths?.image;
    if (imagePath?.startsWith('http')) return imagePath;
    if (rec.metadata?.image_spec?.original_url) return rec.metadata.image_spec.original_url;
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

  // Only show empty state if there are NO records at all (not when search has no results)
  if (!record && records.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
          <h3 className="text-xl font-semibold">Không có dữ liệu</h3>
          <p className="text-muted-foreground">Chưa có record nào trong hệ thống</p>
        </div>
      </div>
    );
  }

  // If search/filter has no results but we have records, show the first available record
  const displayRecord = record || records[0];

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b bg-background">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-lg">Annotate</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground font-mono">{displayRecord.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {currentIndex + 1} / {filteredSidebarItems.length}
          </Badge>
        </div>
      </div>

      {/* Main content with resizable panels */}
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

          {/* Record list with infinite scroll */}
          <ScrollArea className="flex-1" onScrollCapture={handleScroll}>
            <div className="p-2 space-y-1">
              {visibleSidebarItems.length === 0 && filteredSidebarItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Không tìm thấy kết quả
                </div>
              ) : (
                visibleSidebarItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectRecord(item.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors",
                      item.id === (displayRecord?.db_id || displayRecord?.id)
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs truncate">{item.record_id}</span>
                      </div>
                      {getStatusIcon(item.status)}
                    </div>
                    <p className="font-medium text-sm mt-1 truncate">{item.landmark_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.landmark_name.toLowerCase().replace(/\s+/g, '_')}
                    </p>
                  </button>
                ))
              )}
              {visibleCount < filteredSidebarItems.length && (
                <div className="p-3 text-center text-muted-foreground text-xs">
                  Scroll để tải thêm...
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t text-xs text-muted-foreground">
            Showing {Math.min(visibleCount, filteredSidebarItems.length).toLocaleString()} / {loadedCount > 0 ? loadedCount.toLocaleString() : filteredSidebarItems.length.toLocaleString()} (total: {(totalCount || workingRecordIds.length).toLocaleString()})
          </div>
        </div>

        {/* Resizable area for Media Viewer and QA Editor */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-w-0">
          {/* Panel 2: Media Viewer */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full flex flex-col bg-background">
          {/* Media Header */}
          <div className="p-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{displayRecord.metadata.landmark_name}</h2>
              <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 border-blue-200">
                {displayRecord.metadata.location.city}
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
                {getImageSrc(displayRecord) ? (
                  <img 
                    src={getImageSrc(displayRecord)!} 
                    alt={displayRecord.metadata.landmark_name}
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
              
              {displayRecord.metadata.image_spec?.original_url && (
                <a 
                  href={displayRecord.metadata.image_spec.original_url}
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
                    disabled={!displayRecord.paths?.audio_evidence}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </Button>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium truncate">
                      {displayRecord.paths?.audio_evidence?.split('/').pop() || 'No audio'}
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
                {displayRecord.metadata.audio_spec?.transcript && (
                  <div className="bg-blue-50/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
                      {displayRecord.metadata.audio_spec.transcript}
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
              disabled={currentIndex === filteredSidebarItems.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Panel 3: QA Editor */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col bg-background">
              <div className="p-4 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">QA Pairs</h3>
                  <Badge variant="outline">{displayRecord.qa_pairs?.length || 0} samples</Badge>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {displayRecord.qa_pairs?.map((qa, qaIndex) => (
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Metadata Dialog - wider */}
      <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Metadata
              <span className="text-muted-foreground font-normal text-sm">
                {displayRecord.id} • {displayRecord.metadata.landmark_name}
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
                    value={displayRecord.metadata.location.city}
                    onChange={(e) => handleFieldChange('metadata.location.city', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">District</Label>
                  <Input
                    value={displayRecord.metadata.location.district}
                    onChange={(e) => handleFieldChange('metadata.location.district', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={displayRecord.metadata.location.gps?.lat || ''}
                    onChange={(e) => handleFieldChange('metadata.location.gps.lat', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Longitude (LON)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={displayRecord.metadata.location.gps?.lon || ''}
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
                    value={displayRecord.metadata.image_spec?.original_url || ''}
                    onChange={(e) => handleFieldChange('metadata.image_spec.original_url', e.target.value)}
                    className="bg-purple-50 border-purple-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Source</Label>
                    <Input
                      value={displayRecord.metadata.image_spec?.source || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.source', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">License</Label>
                    <Input
                      value={displayRecord.metadata.image_spec?.license || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.license', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                  <Input
                    value={displayRecord.metadata.image_spec?.description || ''}
                    onChange={(e) => handleFieldChange('metadata.image_spec.description', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Match Info</Label>
                  <Input
                    value={displayRecord.metadata.image_spec?.match_info || ''}
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
                    value={displayRecord.metadata.audio_spec?.transcript || ''}
                    onChange={(e) => handleFieldChange('metadata.audio_spec.transcript', e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Voice ID</Label>
                  <Input
                    value={displayRecord.metadata.audio_spec?.voice_id || ''}
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
      {displayRecord.paths?.audio_evidence && (
        <audio 
          ref={audioRef}
          src={displayRecord.paths.audio_evidence}
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
