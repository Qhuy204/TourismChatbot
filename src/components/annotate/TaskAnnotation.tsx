import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Play,
  ListTodo,
  ArrowLeft,
} from 'lucide-react';
import { DatasetRecord, AnnotationTask } from '@/types/dataset';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TaskAnnotationProps {
  tasks: AnnotationTask[];
  onBack: () => void;
  onTaskUpdate: () => void;
}

interface TaskRecord {
  id: string;
  task_id: string;
  record_id: string;
  status: string;
  annotated_at: string | null;
  annotated_by: string | null;
}

export function TaskAnnotation({ tasks, onBack, onTaskUpdate }: TaskAnnotationProps) {
  const { user } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskRecords, setTaskRecords] = useState<TaskRecord[]>([]);
  const [recordsData, setRecordsData] = useState<Map<string, DatasetRecord>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  
  // Fetch task records when task is selected
  useEffect(() => {
    if (!selectedTaskId) return;
    
    const fetchTaskRecords = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('task_records')
          .select('*')
          .eq('task_id', selectedTaskId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        setTaskRecords(data || []);
        
        // Find first pending record
        const pendingIdx = (data || []).findIndex(r => r.status === 'pending');
        if (pendingIdx !== -1) {
          setCurrentIndex(pendingIdx);
        } else {
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error('Error fetching task records:', error);
        toast.error('Không thể tải task records');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTaskRecords();
  }, [selectedTaskId]);
  
  // Load current record data
  const currentTaskRecord = taskRecords[currentIndex];
  
  useEffect(() => {
    if (!currentTaskRecord) return;
    
    const fetchRecordData = async () => {
      if (recordsData.has(currentTaskRecord.record_id)) return;
      
      const { data, error } = await supabase
        .from('dataset_records')
        .select('*')
        .eq('id', currentTaskRecord.record_id)
        .single();
      
      if (!error && data) {
        const recordData = data.data as unknown as DatasetRecord;
        const mapped: DatasetRecord = {
          ...recordData,
          status: data.status as DatasetRecord['status'],
          db_id: data.id,
        };
        setRecordsData(prev => new Map(prev).set(currentTaskRecord.record_id, mapped));
      }
    };
    
    fetchRecordData();
  }, [currentTaskRecord, recordsData]);
  
  const currentRecord = currentTaskRecord ? recordsData.get(currentTaskRecord.record_id) : null;
  
  // Progress calculation
  const progress = useMemo(() => {
    if (!taskRecords.length) return { completed: 0, pending: 0, needs_review: 0, rejected: 0 };
    return {
      completed: taskRecords.filter(r => r.status === 'completed').length,
      pending: taskRecords.filter(r => r.status === 'pending').length,
      needs_review: taskRecords.filter(r => r.status === 'needs_review').length,
      rejected: taskRecords.filter(r => r.status === 'rejected').length,
    };
  }, [taskRecords]);
  
  const progressPercent = taskRecords.length > 0 
    ? ((progress.completed + progress.rejected) / taskRecords.length) * 100 
    : 0;
  
  // Update task record status
  const updateStatus = useCallback(async (status: 'completed' | 'needs_review' | 'rejected') => {
    if (!currentTaskRecord || !user) return;
    
    try {
      const { error } = await supabase
        .from('task_records')
        .update({
          status,
          annotated_by: user.id,
          annotated_at: new Date().toISOString(),
        })
        .eq('id', currentTaskRecord.id);
      
      if (error) throw error;
      
      // Update local state
      setTaskRecords(prev => prev.map(r => 
        r.id === currentTaskRecord.id 
          ? { ...r, status, annotated_by: user.id, annotated_at: new Date().toISOString() }
          : r
      ));
      
      // Show toast
      const messages = {
        completed: 'Đã phê duyệt',
        needs_review: 'Đã đánh dấu cần kiểm tra lại',
        rejected: 'Đã từ chối',
      };
      toast.success(messages[status]);
      
      // Move to next pending record
      goToNextPending();
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task record:', error);
      toast.error('Không thể cập nhật');
    }
  }, [currentTaskRecord, user, onTaskUpdate]);
  
  const goToNextPending = useCallback(() => {
    const nextPendingIdx = taskRecords.findIndex((r, idx) => idx > currentIndex && r.status === 'pending');
    if (nextPendingIdx !== -1) {
      setCurrentIndex(nextPendingIdx);
    } else if (currentIndex < taskRecords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [taskRecords, currentIndex]);
  
  const goNext = () => {
    if (currentIndex < taskRecords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, taskRecords.length]);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'needs_review': return <AlertTriangle className="h-4 w-4 text-chart-4" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const getImageSrc = (rec: DatasetRecord | null | undefined) => {
    if (!rec) return null;
    const imagePath = rec.paths?.image;
    if (imagePath?.startsWith('http')) return imagePath;
    if (rec.metadata?.image_spec?.original_url) return rec.metadata.image_spec.original_url;
    return null;
  };

  // Task selection view
  if (!selectedTaskId) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Task Annotation</h2>
            <p className="text-muted-foreground">Chọn task để bắt đầu annotate</p>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map(task => (
            <Card 
              key={task.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedTaskId(task.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{task.name}</span>
                  <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
                    {task.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tiến độ</span>
                    <span className="font-medium">
                      {task.progress?.completed || 0}/{task.progress?.total || 0}
                    </span>
                  </div>
                  <Progress 
                    value={task.progress?.total ? ((task.progress.completed || 0) / task.progress.total) * 100 : 0} 
                  />
                </div>
                <Button className="w-full mt-4" size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Bắt đầu
                </Button>
              </CardContent>
            </Card>
          ))}
          
          {tasks.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="p-12 text-center">
                <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Chưa có task nào</h3>
                <p className="text-muted-foreground">Liên hệ Admin để được giao task</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Annotation view
  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTaskId(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="font-semibold">{selectedTask?.name}</span>
            <span className="text-muted-foreground mx-2">•</span>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {taskRecords.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-primary">{progress.completed} hoàn thành</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-chart-4">{progress.needs_review} cần xem</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-destructive">{progress.rejected} từ chối</span>
          </div>
          <Progress value={progressPercent} className="w-32" />
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <div className="w-64 shrink-0 border-r bg-background flex flex-col">
          <div className="p-3 border-b">
            <Select value={currentTaskRecord?.status || 'all'} onValueChange={() => {}}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {taskRecords.map((tr, idx) => {
                const rec = recordsData.get(tr.record_id);
                return (
                  <button
                    key={tr.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg transition-colors text-sm",
                      idx === currentIndex 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs truncate flex-1">{tr.record_id.slice(0, 20)}...</span>
                      {getStatusIcon(tr.status)}
                    </div>
                    {rec && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {rec.metadata?.landmark_name || 'Loading...'}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Skeleton className="w-full max-w-2xl h-96" />
            </div>
          ) : currentRecord ? (
            <>
              {/* Record info */}
              <div className="p-4 border-b bg-background">
                <h3 className="text-lg font-semibold">{currentRecord.metadata?.landmark_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {currentRecord.metadata?.location?.city} • {currentRecord.id}
                </p>
              </div>
              
              {/* Media */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Image */}
                  {getImageSrc(currentRecord) && (
                    <div className="rounded-xl overflow-hidden bg-muted">
                      <img 
                        src={getImageSrc(currentRecord)!}
                        alt={currentRecord.metadata?.landmark_name}
                        className="w-full max-h-96 object-contain"
                      />
                    </div>
                  )}
                  
                  {/* Transcript */}
                  {currentRecord.metadata?.audio_spec?.transcript && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Audio Transcript</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed">
                          {currentRecord.metadata.audio_spec.transcript}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* QA Pairs */}
                  {currentRecord.qa_pairs && currentRecord.qa_pairs.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">QA Pairs ({currentRecord.qa_pairs.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {currentRecord.qa_pairs.map((qa, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-muted/50 space-y-2">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="shrink-0">{qa.type}</Badge>
                              <p className="text-sm font-medium">{qa.q}</p>
                            </div>
                            <p className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/20">
                              {qa.a}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
              
              {/* Actions */}
              <div className="shrink-0 p-4 border-t bg-background flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Trước
                  </Button>
                  <Button variant="outline" size="sm" onClick={goNext} disabled={currentIndex === taskRecords.length - 1}>
                    Sau
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {currentTaskRecord?.status || 'pending'}
                  </Badge>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => updateStatus('needs_review')}
                    disabled={currentTaskRecord?.status === 'needs_review'}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Cần xem lại
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => updateStatus('rejected')}
                    disabled={currentTaskRecord?.status === 'rejected'}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Từ chối
                  </Button>
                  <Button 
                    onClick={() => updateStatus('completed')}
                    disabled={currentTaskRecord?.status === 'completed'}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Phê duyệt
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Không có dữ liệu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}