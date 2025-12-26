import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserProgressBar } from '@/components/dashboard/UserProgressBar';
import { AnnotationTask } from '@/types/dataset';
import { ListTodo, Users, Play, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TaskProgressListProps {
  tasks: AnnotationTask[];
  title?: string;
  showAssignee?: boolean;
  showDeleteButton?: boolean;
  onStartTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

export function TaskProgressList({ 
  tasks, 
  title = "Tiến độ Tasks", 
  showAssignee = true, 
  showDeleteButton = false,
  onStartTask,
  onDeleteTask 
}: TaskProgressListProps) {
  const getStatusBadge = (task: AnnotationTask) => {
    const progress = task.progress;
    if (!progress || progress.total === 0) {
      return <Badge variant="outline">Chưa có data</Badge>;
    }
    
    const approvedPercent = (progress.approved / progress.total) * 100;
    
    if (task.status === 'done' || approvedPercent >= 100) {
      return <Badge className="bg-primary">Hoàn thành</Badge>;
    } else if (task.status === 'in_progress' || approvedPercent > 0) {
      return <Badge variant="secondary">Đang tiến hành</Badge>;
    } else if (task.status === 'archived') {
      return <Badge variant="outline">Đã lưu trữ</Badge>;
    }
    return <Badge variant="outline">Chưa bắt đầu</Badge>;
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Chưa có task nào</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {tasks.map((task) => {
          const progress = task.progress || { total: 0, approved: 0, pending: 0, needs_review: 0, rejected: 0 };
          
          const segments = [
            { value: progress.approved, color: 'hsl(var(--chart-1))', label: 'Approved' },
            { value: progress.needs_review, color: 'hsl(var(--chart-3))', label: 'Needs Review' },
            { value: progress.rejected, color: 'hsl(var(--destructive))', label: 'Rejected' },
            { value: progress.pending, color: 'hsl(var(--muted))', label: 'Pending' },
          ];

          return (
            <div key={task.task_id} className="space-y-3 p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{task.task_name}</h4>
                    {getStatusBadge(task)}
                  </div>
                  {showAssignee && task.assignee_name && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {task.assignee_name}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {onStartTask && (
                    <Button size="sm" onClick={() => onStartTask(task.task_id)}>
                      <Play className="h-4 w-4 mr-1" />
                      Bắt đầu
                    </Button>
                  )}
                  {showDeleteButton && onDeleteTask && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa Task</AlertDialogTitle>
                          <AlertDialogDescription>
                            Bạn có chắc chắn muốn xóa task "{task.task_name}"? 
                            Tất cả dữ liệu liên quan sẽ bị xóa và không thể khôi phục.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteTask(task.task_id)}>
                            Xóa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              <UserProgressBar
                userName=""
                segments={segments}
                total={progress.total}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
