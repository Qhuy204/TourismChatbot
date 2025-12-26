import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserProgressBar } from '@/components/dashboard/UserProgressBar';
import { AnnotationTask } from '@/types/dataset';
import { ListTodo, Users, Play } from 'lucide-react';

interface TaskProgressListProps {
  tasks: AnnotationTask[];
  title?: string;
  showAssignee?: boolean;
  onStartTask?: (taskId: string) => void;
}

export function TaskProgressList({ tasks, title = "Tiến độ Tasks", showAssignee = true, onStartTask }: TaskProgressListProps) {
  const getStatusBadge = (task: AnnotationTask) => {
    const progress = task.progress;
    if (!progress || progress.total === 0) {
      return <Badge variant="outline">Chưa có data</Badge>;
    }
    
    const completedPercent = (progress.completed / progress.total) * 100;
    
    if (completedPercent >= 100) {
      return <Badge className="bg-primary">Hoàn thành</Badge>;
    } else if (completedPercent > 0) {
      return <Badge variant="secondary">Đang tiến hành</Badge>;
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
          const progress = task.progress || { total: 0, completed: 0, pending: 0, needs_review: 0, rejected: 0 };
          
          const segments = [
            { value: progress.completed, color: 'hsl(var(--chart-1))', label: 'Approved' },
            { value: progress.needs_review, color: 'hsl(var(--chart-3))', label: 'Needs Review' },
            { value: progress.rejected, color: 'hsl(var(--destructive))', label: 'Rejected' },
            { value: progress.pending, color: 'hsl(var(--muted))', label: 'Pending' },
          ];

          return (
            <div key={task.id} className="space-y-3 p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{task.name}</h4>
                    {getStatusBadge(task)}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                  )}
                  {showAssignee && task.assignee_name && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {task.assignee_name}
                    </div>
                  )}
                </div>
                {onStartTask && (
                  <Button size="sm" onClick={() => onStartTask(task.id)}>
                    <Play className="h-4 w-4 mr-1" />
                    Bắt đầu
                  </Button>
                )}
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