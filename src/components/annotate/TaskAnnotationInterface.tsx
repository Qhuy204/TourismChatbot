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
  onTaskStatusUpdate?: () => void; // Callback to refresh task list
}

// Status from anno_task_details
interface TaskDetailStatus {
  [imageId: string]: 'pending' | 'approved' | 'rejected' | 'needs_review';
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'needs_review';

export function TaskAnnotationInterface({ 
  tasks,
  onRecordUpdate, 
  initialTaskId,
  onTaskStatusUpdate
}: TaskAnnotationInterfaceProps) {
  // Selected task state
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(initialTaskId);
  
  // Task record IDs - fetched when task is selected
  const [taskRecordIds, setTaskRecordIds] = useState<string[]>([]);
  const [isLoadingTaskRecords, setIsLoadingTaskRecords] = useState(false);
  
  // Cache for loaded records
  const [recordCache, setRecordCache] = useState<Map<string, DatasetRecord>>(new Map());
  const [loadingRecordIds, setLoadingRecordIds] = useState<Set<string>>(new Set());
  
  // Status from anno_task_details - separate from dataset_records status
  const [taskDetailStatuses, setTaskDetailStatuses] = useState<TaskDetailStatus>({});

  // Fetch task record IDs and statuses when task is selected
  useEffect(() => {
    if (!selectedTaskId) {
      setTaskRecordIds([]);
      setRecordCache(new Map());
      setTaskDetailStatuses({});
      return;
    }

    let isCancelled = false;

    const fetchTaskRecordIdsAndStatuses = async () => {
      setIsLoadingTaskRecords(true);
      setRecordCache(new Map()); // Clear cache when switching tasks
      setTaskDetailStatuses({}); // Clear statuses
      
      try {
        // Fetch ALL image IDs and statuses for the task with pagination
        const allRecordIds: string[] = [];
        const statusMap: TaskDetailStatus = {};
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore && !isCancelled) {
          const { data: batch, error } = await supabase
            .from('anno_task_details')
            .select('image_id, status')
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
            batch.forEach(tr => {
              allRecordIds.push(tr.image_id);
              statusMap[tr.image_id] = tr.status as 'pending' | 'approved' | 'rejected' | 'needs_review';
            });
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
          setTaskDetailStatuses(statusMap);
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

    fetchTaskRecordIdsAndStatuses();

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

  // Get sidebar items from cache - use taskDetailStatuses for status
  const allSidebarItems = useMemo(() => {
    return taskRecordIds.map(id => {
      const cached = recordCache.get(id);
      return {
        id,
        record_id: cached?.id || id,
        status: taskDetailStatuses[id] || 'pending', // Use task-specific status
        landmark_name: cached?.metadata?.landmark_name || 'Loading...',
      };
    });
  }, [taskRecordIds, recordCache, taskDetailStatuses]);

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

  // Infinite scroll state
  const initialVisibleCount = useMemo(() => {
    const fivePercent = Math.ceil(taskRecordIds.length * 0.05);
    return Math.max(100, Math.min(fivePercent, taskRecordIds.length));
  }, [taskRecordIds.length]);
  
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

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
    const fivePercent = Math.ceil(filteredSidebarItems.length * 0.05);
    setVisibleCount(Math.max(100, fivePercent));
  }, [searchQuery, statusFilter, sortAsc, filteredSidebarItems.length]);

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
      const fivePercent = Math.ceil(taskRecordIds.length * 0.05);
      const increment = Math.max(100, fivePercent);
      setVisibleCount(prev => Math.min(prev + increment, filteredSidebarItems.length));
    }
  }, [filteredSidebarItems.length, taskRecordIds.length]);

  // Current record
  const currentRecordId = filteredSidebarItems[currentIndex]?.id;
  const currentRecord = currentRecordId ? recordCache.get(currentRecordId) : undefined;
  const record = editedRecord || currentRecord;

  // Calculate task progress stats from taskDetailStatuses
  const taskStats = useMemo(() => {
    const total = Object.keys(taskDetailStatuses).length;
    let approved = 0, pending = 0, rejected = 0, needs_review = 0;
    
    Object.values(taskDetailStatuses).forEach(status => {
      switch (status) {
        case 'approved': approved++; break;
        case 'rejected': rejected++; break;
        case 'needs_review': needs_review++; break;
        default: pending++; break;
      }
    });

    return { total, approved, pending, rejected, needs_review };
  }, [taskDetailStatuses]);

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

  // Update status in anno_task_details table
  const updateTaskDetailStatus = useCallback(async (imageId: string, status: 'pending' | 'approved' | 'rejected' | 'needs_review') => {
    if (!selectedTaskId) return false;
    
    try {
      const { error } = await supabase
        .from('anno_task_details')
        .update({ 
          status,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('task_id', selectedTaskId)
        .eq('image_id', imageId);

      if (error) {
        console.error('Error updating task detail status:', error);
        toast.error('Không thể cập nhật trạng thái');
        return false;
      }

      // Update local state immediately
      setTaskDetailStatuses(prev => ({
        ...prev,
        [imageId]: status
      }));
      
      // Notify parent to refresh task progress
      onTaskStatusUpdate?.();
      
      return true;
    } catch (err) {
      console.error('Error updating task detail status:', err);
      return false;
    }
  }, [selectedTaskId, onTaskStatusUpdate]);

  const handleNeedsRecheck = async () => {
    const toUpdate = editedRecord || record;
    if (toUpdate && currentRecordId) {
      await updateTaskDetailStatus(currentRecordId, 'needs_review');
      // Save edited data including QA Pairs, Metadata, and audio paths
      const finalRecord = { ...toUpdate, status: 'needs_review' as const, reviewedAt: new Date().toISOString() };
      onRecordUpdate(finalRecord);
      toast.warning('Đã đánh dấu cần kiểm tra lại');
      setEditedRecord(null);
      goNext();
    }
  };

  const handleReject = async () => {
    const toUpdate = editedRecord || record;
    if (toUpdate && currentRecordId) {
      await updateTaskDetailStatus(currentRecordId, 'rejected');
      // Save edited data including QA Pairs, Metadata, and audio paths
      const finalRecord = { ...toUpdate, status: 'rejected' as const, reviewedAt: new Date().toISOString() };
      onRecordUpdate(finalRecord);
      toast.error('Đã từ chối record');
      setEditedRecord(null);
      goNext();
    }
  };

  const handleApprove = async () => {
    const toUpdate = editedRecord || record;
    if (toUpdate && currentRecordId) {
      await updateTaskDetailStatus(currentRecordId, 'approved');
      // Save edited data including QA Pairs, Metadata, and audio paths
      const finalRecord = { ...toUpdate, status: 'approved' as const, reviewedAt: new Date().toISOString() };
      onRecordUpdate(finalRecord);
      toast.success('Đã phê duyệt và lưu thay đổi');
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

  // If no display record yet (loading)
  if (!displayRecord) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header - Clone từ AnnotationInterface */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b bg-background">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTaskId(undefined)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Tasks
          </Button>
          <span className="text-muted-foreground">•</span>
          <span className="font-semibold">{selectedTask?.task_name || 'Annotate'}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground font-mono text-xs">{displayRecord.id}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress Stats */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-primary font-medium">{taskStats.approved} approved</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-chart-4">{taskStats.needs_review} review</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-destructive">{taskStats.rejected} rejected</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">{taskStats.pending} pending</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {currentIndex + 1} / {filteredSidebarItems.length}
          </Badge>
        </div>
      </div>

      {/* Main content with resizable panels - Clone từ AnnotationInterface */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Panel 1: Data Sidebar - Resizable */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <div className="h-full border-r bg-background flex flex-col">
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
                Showing {Math.min(visibleCount, filteredSidebarItems.length).toLocaleString()} / {filteredSidebarItems.length.toLocaleString()} (total: {taskRecordIds.length.toLocaleString()})
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Panel 2: Media Viewer */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full flex flex-col bg-background">
              {/* Media Header */}
              <div className="p-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{displayRecord.metadata?.landmark_name}</h2>
                  <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 border-blue-200">
                    {displayRecord.metadata?.location?.city}
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
                        alt={displayRecord.metadata?.landmark_name}
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
                  
                  {displayRecord.metadata?.image_spec?.original_url && (
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

                    {/* Audio Path Input */}
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase text-muted-foreground">Audio Path</Label>
                      <Input
                        value={displayRecord.paths?.audio_evidence || ''}
                        onChange={(e) => handleFieldChange('paths.audio_evidence', e.target.value)}
                        placeholder="Enter audio path..."
                        className="text-sm font-mono"
                      />
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
                    {displayRecord.metadata?.audio_spec?.transcript && (
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
                        </div>

                        {/* Audio Paths */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs uppercase text-muted-foreground">Question Audio Path</Label>
                            <Input
                              value={qa.paths?.question_audio || ''}
                              onChange={(e) => handleFieldChange(`qa_pairs[${qaIndex}].paths.question_audio`, e.target.value)}
                              placeholder="Enter question audio path..."
                              className="text-xs font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase text-muted-foreground">Answer Audio Path</Label>
                            <Input
                              value={qa.paths?.answer_audio || ''}
                              onChange={(e) => handleFieldChange(`qa_pairs[${qaIndex}].paths.answer_audio`, e.target.value)}
                              placeholder="Enter answer audio path..."
                              className="text-xs font-mono"
                            />
                          </div>
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

      {/* Metadata Dialog - wider - Clone từ AnnotationInterface */}
      <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Metadata
              <span className="text-muted-foreground font-normal text-sm">
                {displayRecord.id} • {displayRecord.metadata?.landmark_name}
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
                    value={displayRecord.metadata?.location?.city || ''}
                    onChange={(e) => handleFieldChange('metadata.location.city', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">District</Label>
                  <Input
                    value={displayRecord.metadata?.location?.district || ''}
                    onChange={(e) => handleFieldChange('metadata.location.district', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={displayRecord.metadata?.location?.gps?.lat || ''}
                    onChange={(e) => handleFieldChange('metadata.location.gps.lat', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Longitude (LON)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={displayRecord.metadata?.location?.gps?.lon || ''}
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
                    value={displayRecord.metadata?.image_spec?.original_url || ''}
                    onChange={(e) => handleFieldChange('metadata.image_spec.original_url', e.target.value)}
                    className="bg-purple-50 border-purple-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Source</Label>
                    <Input
                      value={displayRecord.metadata?.image_spec?.source || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.source', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">License</Label>
                    <Input
                      value={displayRecord.metadata?.image_spec?.license || ''}
                      onChange={(e) => handleFieldChange('metadata.image_spec.license', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                  <Input
                    value={displayRecord.metadata?.image_spec?.description || ''}
                    onChange={(e) => handleFieldChange('metadata.image_spec.description', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Match Info</Label>
                  <Input
                    value={displayRecord.metadata?.image_spec?.match_info || ''}
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
                    value={displayRecord.metadata?.audio_spec?.transcript || ''}
                    onChange={(e) => handleFieldChange('metadata.audio_spec.transcript', e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Voice ID</Label>
                  <Input
                    value={displayRecord.metadata?.audio_spec?.voice_id || ''}
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
