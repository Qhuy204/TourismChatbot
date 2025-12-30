import { useMemo, useState } from 'react';
import { 
  Database, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Image,
  Volume2,
  Users,
  ListTodo,
  TrendingUp,
  Plus
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { DatasetStats, DatasetRecord, AnnotationTask, UserWithRole } from '@/types/dataset';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TaskAssignmentDialog } from '@/components/tasks/TaskAssignmentDialog';
import { TaskProgressList } from '@/components/tasks/TaskProgressList';
import { UserProgressBar } from './UserProgressBar';

interface AdminDashboardProps {
  records: DatasetRecord[];
  stats: DatasetStats;
  usersCount?: number;
  tasksCount?: number;
  users?: UserWithRole[];
  tasks?: AnnotationTask[];
  availableRecords?: number;
  totalRecords?: number;
  onCreateTask?: (name: string, userId: string, percentage: number, onProgress?: (stage: string, current: number, total: number) => void) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<boolean>;
}

export function AdminDashboard({ 
  records, 
  stats, 
  usersCount = 0, 
  tasksCount = 0,
  users = [],
  tasks = [],
  availableRecords = 0,
  totalRecords = 0,
  onCreateTask,
  onDeleteTask
}: AdminDashboardProps) {
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  const progressPercent = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round(((stats.approved + stats.rejected) / stats.total) * 100);
  }, [stats]);

  const pieData = [
    { name: 'Pending', value: stats.pending, color: 'hsl(var(--chart-5))' },
    { name: 'Needs Review', value: stats.needs_review, color: 'hsl(var(--chart-3))' },
    { name: 'Approved', value: stats.approved, color: 'hsl(var(--chart-1))' },
    { name: 'Rejected', value: stats.rejected, color: 'hsl(var(--destructive))' },
  ];

  const qaTypeData = [
    { name: 'ask_image', value: stats.qa_types?.ask_image || 0, fill: 'hsl(var(--chart-1))' },
    { name: 'ask_audio', value: stats.qa_types?.ask_audio || 0, fill: 'hsl(var(--chart-2))' },
    { name: 'ask_both', value: stats.qa_types?.ask_both || 0, fill: 'hsl(var(--chart-3))' },
  ];

  // Group tasks by user for progress overview
  const userTaskProgress = useMemo(() => {
    const userMap = new Map<string, { 
      name: string; 
      total: number; 
      approved: number; 
      pending: number; 
      needs_review: number; 
      rejected: number;
    }>();

    tasks.forEach(task => {
      if (!task.assigned_to || !task.progress) return;
      
      const existing = userMap.get(task.assigned_to) || { 
        name: task.assignee_name || 'Unknown', 
        total: 0, approved: 0, pending: 0, needs_review: 0, rejected: 0 
      };
      
      userMap.set(task.assigned_to, {
        name: existing.name,
        total: existing.total + task.progress.total,
        approved: existing.approved + task.progress.approved,
        pending: existing.pending + task.progress.pending,
        needs_review: existing.needs_review + task.progress.needs_review,
        rejected: existing.rejected + task.progress.rejected,
      });
    });

    return Array.from(userMap.entries()).map(([id, data]) => ({ id, ...data }));
  }, [tasks]);

  const handleCreateTask = async (
    name: string, 
    userId: string, 
    percentage: number, 
    _description?: string,
    onProgress?: (stage: string, current: number, total: number) => void
  ) => {
    if (onCreateTask) {
      await onCreateTask(name, userId, percentage, onProgress);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (onDeleteTask) {
      await onDeleteTask(taskId);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground">Tổng quan toàn bộ hệ thống và tiến trình annotation</p>
        </div>
        <Button onClick={() => setShowTaskDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Giao Task
        </Button>
      </div>

      {/* Admin Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Tổng Records"
          value={stats.total.toLocaleString()}
          icon={Database}
          variant="primary"
          description="Tổng số mẫu trong dataset"
        />
        <StatsCard
          title="Đang chờ"
          value={stats.pending.toLocaleString()}
          icon={Clock}
          variant="warning"
          description="Cần được xem xét"
        />
        <StatsCard
          title="Đã duyệt"
          value={stats.approved.toLocaleString()}
          icon={CheckCircle2}
          variant="success"
          description="Đã hoàn thành"
        />
        <StatsCard
          title="Người dùng"
          value={usersCount}
          icon={Users}
          variant="primary"
          description="Tổng số users"
        />
        <StatsCard
          title="Tasks"
          value={tasksCount}
          icon={ListTodo}
          variant="primary"
          description="Annotation tasks"
        />
      </div>

      {/* User Progress Overview */}
      {userTaskProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Tiến độ theo User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {userTaskProgress.map((user) => (
              <UserProgressBar
                key={user.id}
                userName={user.name}
                total={user.total}
                segments={[
                  { value: user.approved, color: 'hsl(var(--chart-1))', label: 'Approved' },
                  { value: user.needs_review, color: 'hsl(var(--chart-3))', label: 'Needs Review' },
                  { value: user.rejected, color: 'hsl(var(--destructive))', label: 'Rejected' },
                  { value: user.pending, color: 'hsl(var(--muted))', label: 'Pending' },
                ]}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tiến trình Annotation tổng thể
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
              {(stats.approved + stats.rejected).toLocaleString()} / {stats.total.toLocaleString()} records đã được xử lý
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <TaskProgressList 
        tasks={tasks} 
        title="Danh sách Tasks" 
        showDeleteButton={true}
        onDeleteTask={handleDeleteTask}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Phân bố trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* QA Type Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Phân bố QA Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qaTypeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Assignment Dialog */}
      <TaskAssignmentDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        users={users}
        availableRecords={availableRecords}
        totalRecords={totalRecords}
        onAssign={handleCreateTask}
      />
    </div>
  );
}
