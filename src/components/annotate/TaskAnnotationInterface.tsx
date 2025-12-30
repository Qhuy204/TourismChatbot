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
  Loader2,
  ClipboardList
} from 'lucide-react';
import { DatasetRecord, QAPair, AnnotationTask } from '@/types/dataset';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TaskAnnotationInterfaceProps {
  tasks: AnnotationTask[];
  onRecordUpdate: (record: DatasetRecord) => void;
  initialTaskId?: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'needs_review';

export function TaskAnnotationInterface({ 
  tasks,
  onRecordUpdate, 
  initialTaskId
}: TaskAnnotationInterfaceProps) {
  // Selected task state
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(initialTaskId);
  
  // Task record IDs - fetched when task is selected
  const [taskRecordIds, setTaskRecordIds] = useState<string[]>([]);
  const [isLoadingTaskRecords, setIsLoadingTaskRecords] = useState(false);
  
  // Cache for loaded records
  const [recordCache, setRecordCache] = useState<Map<string, DatasetRecord>>(new Map());
  const [loadingRecordIds, setLoadingRecordIds] = useState<Set<string>>(new Set());

  // Fetch task record IDs when task is selected
  useEffect(() => {
    if (!selectedTaskId) {
      setTaskRecordIds([]);
      setRecordCache(new Map());
      return;
    }

    let isCancelled = false;

    const fetchTaskRecordIds = async () => {
      setIsLoadingTaskRecords(true);
      setRecordCache(new Map()); // Clear cache when switching tasks
      
      try {
        // Fetch ALL image IDs for the task with pagination
        const allRecordIds: string[] = [];
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore && !isCancelled) {
          const { data: batch, error } = await supabase
            .from('anno_task_details')
            .select('image_id')
            .eq('task_id', selectedTaskId)
            .range(offset, offset + pageSize - 1);

          if (error) {
            console.error('Error fetching task records batch:', error);
            toast.error('Không thể tải records của task');
            return;
          }

          if (!batch || batch.length === 0) {
            hasMore = false;
          } else {
            allRecordIds.push(...batch.map(tr => tr.image_id));
            if (batch.length < pageSize) {
              hasMore = false;
            } else {
              offset += pageSize;
            }
          }
        }

        if (!isCancelled) {
          console.log(`Loaded ${allRecordIds.length} record IDs for task ${selectedTaskId}`);
          setTaskRecordIds(allRecordIds);
        }
      } catch (err) {
        console.error('Error fetching task record IDs:', err);
        toast.error('Có lỗi xảy ra khi tải task');
      } finally {
        if (!isCancelled) {
          setIsLoadingTaskRecords(false);
        }
      }
    };

    fetchTaskRecordIds();

    return () => {
      isCancelled = true;
    };
  }, [selectedTaskId]);

  // Batch load records when taskRecordIds changes
  useEffect(() => {
    if (taskRecordIds.length === 0) return;

    const idsToFetch = taskRecordIds.filter(id => !recordCache.has(id));
    if (idsToFetch.length === 0) return;

    let isCancelled = false;

    const fetchRecords = async () => {
      setLoadingRecordIds(prev => new Set([...prev, ...idsToFetch]));
      try {
        // Fetch in batches of 500
        const batchSize = 500;
        for (let i = 0; i < idsToFetch.length; i += batchSize) {
          if (isCancelled) break;

          const batch = idsToFetch.slice(i, i + batchSize);
          const { data, error } = await supabase
            .from('dataset_records')
            .select('*')
            .in('id', batch);

          if (isCancelled) break;

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
        if (!isCancelled) {
          setLoadingRecordIds(new Set());
        }
      }
    };

    fetchRecords();

    return () => {
      isCancelled = true;
    };
  }, [taskRecordIds]);

  // Get sidebar items from cache
  const allSidebarItems = useMemo(() => {
    return taskRecordIds.map(id => {
      const cached = recordCache.get(id);
      return {
        id,
        record_id: cached?.id || id,
        status: cached?.status,
        landmark_name: cached?.metadata?.landmark_name || 'Loading...',
      };
    });
  }, [taskRecordIds, recordCache]);

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Visible count for infinite scroll
  const [visibleCount, setVisibleCount] = useState(100);

  // Filtered and sorted sidebar items
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

  // Visible items for rendering
  const visibleSidebarItems = useMemo(() => {
    return filteredSidebarItems.slice(0, visibleCount);
  }, [filteredSidebarItems, visibleCount]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(100);
  }, [searchQuery, statusFilter, sortAsc]);

  // Reset index when task changes
  useEffect(() => {
    setCurrentIndex(0);
    setEditedRecord(null);
  }, [selectedTaskId]);

  // Handle scroll to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      setVisibleCount(prev => Math.min(prev + 100, filteredSidebarItems.length));
    }
  }, [filteredSidebarItems.length]);

  // Current record
  const currentRecordId = filteredSidebarItems[currentIndex]?.id;
  const currentRecord = currentRecordId ? recordCache.get(currentRecordId) : undefined;
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
    if (toUpdate) {
      onRecordUpdate({ ...toUpdate, status: 'needs_review', reviewedAt: new Date().toISOString() });
      toast.warning('Đã đánh dấu cần kiểm tra lại');
      setEditedRecord(null);
      goNext();
    }
  };

  const handleReject = () => {
    const toUpdate = editedRecord || record;
    if (toUpdate) {
      onRecordUpdate({ ...toUpdate, status: 'rejected', reviewedAt: new Date().toISOString() });
      toast.error('Đã từ chối record');
      setEditedRecord(null);
      goNext();
    }
  };

  const handleApprove = () => {
    const toUpdate = editedRecord || record;
    if (toUpdate) {
      onRecordUpdate({ ...toUpdate, status: 'approved', reviewedAt: new Date().toISOString() });
      toast.success('Đã phê duyệt');
      setEditedRecord(null);
      goNext();
    }
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

  // Get image source
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

  // Show task selection if no task selected
  if (!selectedTaskId) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="shrink-0 h-14 px-6 flex items-center border-b bg-background">
          <span className="font-semibold text-lg">Annotate Task</span>
        </div>
        <div className="flex-1 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Chọn Task để bắt đầu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.length === 0 ? (
                <p className="text-muted-foreground">Chưa có task nào được giao</p>
              ) : (
                tasks.map(task => (
                  <Button
                    key={task.task_id}
                    variant="outline"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => setSelectedTaskId(task.task_id)}
                  >
                    <div className="text-left">
                      <p className="font-medium">{task.task_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.progress?.total || 0} records • 
                        {task.progress?.approved || 0} approved
                      </p>
                    </div>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoadingTaskRecords) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải records của task...</p>
        </div>
      </div>
    );
  }

  // Show empty state if no records
  if (taskRecordIds.length === 0) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b bg-background">
          <span className="font-semibold text-lg">Annotate Task</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedTaskId(undefined)}>
            Chọn task khác
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
            <h3 className="text-xl font-semibold">Task không có dữ liệu</h3>
            <p className="text-muted-foreground">Task này chưa có record nào được giao</p>
          </div>
        </div>
      </div>
    );
  }

  // Main annotation view
  const displayRecord = record;
  const selectedTask = tasks.find(t => t.task_id === selectedTaskId);

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b bg-background">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTaskId(undefined)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Tasks
          </Button>
          <span className="text-muted-foreground">•</span>
          <span className="font-semibold">{selectedTask?.task_name}</span>
          {displayRecord && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-mono">{displayRecord.id}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {currentIndex + 1} / {filteredSidebarItems.length}
          </Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <div className="w-72 shrink-0 border-r bg-background flex flex-col">
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold">Task Records</h3>
              <p className="text-xs text-muted-foreground">{taskRecordIds.length} records in this task</p>
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

            {/* Filters */}
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-2"
                onClick={() => setSortAsc(!sortAsc)}
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Records list */}
          <div className="flex-1 overflow-auto" onScroll={handleScroll}>
            <div className="space-y-1 p-2">
              {visibleSidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectRecord(item.id)}
                  className={cn(
                    "w-full text-left p-2 rounded-lg transition-colors text-sm",
                    item.id === currentRecordId
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="truncate flex-1">{item.landmark_name}</span>
                  </div>
                  <p className={cn(
                    "text-xs truncate mt-0.5",
                    item.id === currentRecordId ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {item.record_id}
                  </p>
                </button>
              ))}
              {visibleSidebarItems.length < filteredSidebarItems.length && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  Scroll to load more...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!displayRecord ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              {/* Image panel */}
              <ResizablePanel defaultSize={40} minSize={30}>
                <div className="h-full flex flex-col p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Image Preview</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowMetadataDialog(true)}>
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                    {getImageSrc(displayRecord) ? (
                      <img
                        src={getImageSrc(displayRecord)!}
                        alt={displayRecord.metadata?.landmark_name || 'Image'}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-muted-foreground text-sm">No image available</div>
                    )}
                  </div>

                  {displayRecord.metadata && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium">{displayRecord.metadata.landmark_name}</span>
                      </div>
                      {displayRecord.metadata.location?.city && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {displayRecord.metadata.location.city}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* QA panel */}
              <ResizablePanel defaultSize={60} minSize={40}>
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Q&A Pairs</span>
                      <Badge variant="secondary" className="text-xs">
                        {displayRecord.qa_pairs?.length || 0}
                      </Badge>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {displayRecord.qa_pairs?.map((qa, idx) => (
                        <div key={idx} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={cn("text-xs", getTypeBadgeClass(qa.type))}>
                              {qa.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Question</Label>
                            <Textarea
                              value={qa.q}
                              onChange={(e) => handleFieldChange(`qa_pairs[${idx}].q`, e.target.value)}
                              className="mt-1 text-sm min-h-[60px]"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Answer</Label>
                            <Textarea
                              value={qa.a}
                              onChange={(e) => handleFieldChange(`qa_pairs[${idx}].a`, e.target.value)}
                              className="mt-1 text-sm min-h-[80px]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Action buttons */}
                  <div className="p-4 border-t bg-background">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={goNext} disabled={currentIndex >= filteredSidebarItems.length - 1}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleReset}>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleNeedsRecheck} className="text-chart-4 border-chart-4">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Needs Review
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleReject}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button size="sm" onClick={handleApprove}>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      </div>

      {/* Metadata dialog */}
      <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Metadata</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
            {JSON.stringify(displayRecord?.metadata, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
