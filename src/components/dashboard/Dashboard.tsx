import { useMemo } from 'react';
import { 
  Database, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye,
  Image,
  Volume2,
  MessageSquare
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DatasetStats, DatasetRecord } from '@/types/dataset';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface DashboardProps {
  records: DatasetRecord[];
  stats: DatasetStats;
}

export function Dashboard({ records, stats }: DashboardProps) {
  const progressPercent = useMemo(() => {
    return Math.round(((stats.approved + stats.rejected) / stats.total) * 100);
  }, [stats]);

  const pieData = [
    { name: 'Pending', value: stats.pending, color: 'hsl(var(--chart-5))' },
    { name: 'Reviewed', value: stats.reviewed, color: 'hsl(var(--chart-3))' },
    { name: 'Approved', value: stats.approved, color: 'hsl(var(--chart-1))' },
    { name: 'Rejected', value: stats.rejected, color: 'hsl(var(--destructive))' },
  ];

  const scenarioData = [
    { name: 'Text→Image', value: stats.scenarios.text_ask_image, fill: 'hsl(var(--chart-1))' },
    { name: 'Audio→Image', value: stats.scenarios.audio_ask_image, fill: 'hsl(var(--chart-2))' },
    { name: 'Text→Audio', value: stats.scenarios.text_ask_audio, fill: 'hsl(var(--chart-3))' },
    { name: 'Audio→Audio', value: stats.scenarios.audio_ask_audio, fill: 'hsl(var(--chart-4))' },
  ];

  const recentRecords = useMemo(() => {
    return [...records]
      .filter(r => r.reviewedAt)
      .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
      .slice(0, 5);
  }, [records]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Tổng quan về dataset và tiến trình annotation</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Tổng Records"
          value={stats.total.toLocaleString()}
          icon={Database}
          variant="primary"
          description="Tổng số mẫu trong dataset"
        />
        <StatsCard
          title="Đang chờ"
          value={stats.pending}
          icon={Clock}
          variant="warning"
          description="Cần được xem xét"
        />
        <StatsCard
          title="Đã duyệt"
          value={stats.approved}
          icon={CheckCircle2}
          variant="success"
          description="Đã hoàn thành"
        />
        <StatsCard
          title="Từ chối"
          value={stats.rejected}
          icon={XCircle}
          variant="destructive"
          description="Cần chỉnh sửa"
        />
      </div>

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Tiến trình Annotation
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
              {stats.approved + stats.rejected} / {stats.total} records đã được xử lý
            </p>
          </div>
        </CardContent>
      </Card>

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

        {/* Scenario Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Phân bố Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scenarioData}>
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

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Chưa có hoạt động nào</p>
            ) : (
              recentRecords.map((record) => (
                <div key={record.record_id} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      {record.assets.image_path ? (
                        <Image className="h-4 w-4 text-primary" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{record.metadata.entity_name}</p>
                      <p className="text-xs text-muted-foreground">{record.record_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      record.status === 'approved' ? 'bg-accent text-accent-foreground' :
                      record.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      record.status === 'reviewed' ? 'bg-chart-3/10 text-chart-3' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {record.status}
                    </span>
                    {record.reviewedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(record.reviewedAt).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
