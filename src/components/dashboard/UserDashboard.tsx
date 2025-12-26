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
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { DatasetRecord } from '@/types/dataset';
import { useAuth } from '@/hooks/useAuth';

interface UserDashboardProps {
  records: DatasetRecord[];
  assignedTasksCount?: number;
  completedTasksCount?: number;
  onNavigateToAnnotate?: () => void;
}

export function UserDashboard({ 
  records, 
  assignedTasksCount = 0, 
  completedTasksCount = 0,
  onNavigateToAnnotate 
}: UserDashboardProps) {
  const { user } = useAuth();
  
  // Calculate user-specific stats from assigned records only
  const userStats = useMemo(() => {
    const userRecords = records.filter(r => r.reviewedBy === user?.id);
    return {
      totalReviewed: userRecords.length,
      approved: userRecords.filter(r => r.status === 'approved').length,
      rejected: userRecords.filter(r => r.status === 'rejected').length,
      needsReview: userRecords.filter(r => r.status === 'needs_review').length,
    };
  }, [records, user?.id]);

  const progressPercent = useMemo(() => {
    if (assignedTasksCount === 0) return 0;
    return Math.round((completedTasksCount / assignedTasksCount) * 100);
  }, [assignedTasksCount, completedTasksCount]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Tiến trình công việc của bạn</p>
      </div>

      {/* User Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Tasks được giao"
          value={assignedTasksCount}
          icon={ListTodo}
          variant="primary"
          description="Số tasks cần hoàn thành"
        />
        <StatsCard
          title="Đã hoàn thành"
          value={completedTasksCount}
          icon={CheckCircle2}
          variant="success"
          description="Tasks đã xong"
        />
        <StatsCard
          title="Đã review"
          value={userStats.totalReviewed}
          icon={TrendingUp}
          variant="primary"
          description="Số records bạn đã xử lý"
        />
        <StatsCard
          title="Cần xem lại"
          value={userStats.needsReview}
          icon={AlertCircle}
          variant="warning"
          description="Records cần chỉnh sửa"
        />
      </div>

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tiến trình hoàn thành
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hoàn thành</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedTasksCount} / {assignedTasksCount} tasks đã hoàn thành
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hành động nhanh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignedTasksCount > completedTasksCount ? (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Bạn có {assignedTasksCount - completedTasksCount} tasks chưa hoàn thành</p>
                  <p className="text-sm text-muted-foreground">Tiếp tục annotation để hoàn thành tasks</p>
                </div>
              </div>
              <Button onClick={onNavigateToAnnotate}>
                Tiếp tục Annotation
              </Button>
            </div>
          ) : assignedTasksCount > 0 ? (
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
