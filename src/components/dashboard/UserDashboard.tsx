import { useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ListTodo, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnnotationTask, DatasetRecord } from '@/types/dataset';
import { useAuth } from '@/hooks/useAuth';
import { UserProgressBar } from './UserProgressBar';
import { TaskProgressList } from '@/components/tasks/TaskProgressList';

interface UserDashboardProps {
  records: DatasetRecord[];
  tasks?: AnnotationTask[];
  onNavigateToAnnotate?: () => void;
  onStartTask?: (taskId: string) => void;
}

export function UserDashboard({ 
  records, 
  tasks = [],
  onNavigateToAnnotate,
  onStartTask
}: UserDashboardProps) {
  const { user } = useAuth();
  
  // Calculate aggregated progress from all tasks
  const myProgress = useMemo(() => {
    const totals = tasks.reduce(
      (acc, task) => ({
        total: acc.total + (task.progress?.total || 0),
        completed: acc.completed + (task.progress?.completed || 0),
        pending: acc.pending + (task.progress?.pending || 0),
        needs_review: acc.needs_review + (task.progress?.needs_review || 0),
        rejected: acc.rejected + (task.progress?.rejected || 0),
      }),
      { total: 0, completed: 0, pending: 0, needs_review: 0, rejected: 0 }
    );

    return totals;
  }, [tasks]);

  const progressPercent = useMemo(() => {
    if (myProgress.total === 0) return 0;
    return Math.round((myProgress.completed / myProgress.total) * 100);
  }, [myProgress]);

  const pendingCount = myProgress.pending + myProgress.needs_review;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Tiến trình công việc của bạn</p>
      </div>

      {/* User Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Tổng Records"
          value={myProgress.total}
          icon={ListTodo}
          variant="primary"
          description="Được giao annotation"
        />
        <StatsCard
          title="Đã hoàn thành"
          value={myProgress.completed}
          icon={CheckCircle2}
          variant="success"
          description={`${progressPercent}% hoàn thành`}
        />
        <StatsCard
          title="Đang chờ"
          value={pendingCount}
          icon={Clock}
          variant="warning"
          description="Cần xử lý"
        />
        <StatsCard
          title="Bị từ chối"
          value={myProgress.rejected}
          icon={AlertCircle}
          variant="destructive"
          description="Cần sửa lại"
        />
      </div>

      {/* My Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tiến trình tổng thể của bạn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserProgressBar
            userName=""
            total={myProgress.total}
            segments={[
              { value: myProgress.completed, color: 'hsl(var(--chart-1))', label: 'Approved' },
              { value: myProgress.needs_review, color: 'hsl(var(--chart-3))', label: 'Needs Review' },
              { value: myProgress.rejected, color: 'hsl(var(--destructive))', label: 'Rejected' },
              { value: myProgress.pending, color: 'hsl(var(--muted))', label: 'Pending' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Tasks List */}
      <TaskProgressList tasks={tasks} title="Tasks của bạn" showAssignee={false} onStartTask={onStartTask} />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hành động nhanh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingCount > 0 ? (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Bạn có {pendingCount} records chưa hoàn thành</p>
                  <p className="text-sm text-muted-foreground">Tiếp tục annotation để hoàn thành tasks</p>
                </div>
              </div>
              <Button onClick={onNavigateToAnnotate}>
                Tiếp tục Annotation
              </Button>
            </div>
          ) : myProgress.total > 0 ? (
            <div className="flex items-center justify-center p-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <p className="font-medium text-lg">Tuyệt vời! Bạn đã hoàn thành tất cả tasks</p>
                <p className="text-sm text-muted-foreground">Chờ admin giao tasks mới</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <ListTodo className="h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-lg">Chưa có tasks nào được giao</p>
                <p className="text-sm text-muted-foreground">Vui lòng liên hệ admin để được giao tasks</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
