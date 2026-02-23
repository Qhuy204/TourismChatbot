import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle, Calendar, Tag, Database } from 'lucide-react';

interface DeleteActionsPanelProps {
  availableVersions: number[];
  onDeleteByVersion: (version: number) => Promise<boolean>;
  onDeleteByStatus: (status: string) => Promise<boolean>;
  onDeleteByDateRange: (startDate: string, endDate: string) => Promise<boolean>;
  onDeleteAll: () => Promise<boolean>;
  totalCount: number;
}

export function DeleteActionsPanel({
  availableVersions,
  onDeleteByVersion,
  onDeleteByStatus,
  onDeleteByDateRange,
  onDeleteAll,
  totalCount,
}: DeleteActionsPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteByVersion = async () => {
    if (!selectedVersion) return;
    setIsDeleting(true);
    await onDeleteByVersion(parseInt(selectedVersion));
    setSelectedVersion('');
    setIsDeleting(false);
  };

  const handleDeleteByStatus = async () => {
    if (!selectedStatus) return;
    setIsDeleting(true);
    await onDeleteByStatus(selectedStatus);
    setSelectedStatus('');
    setIsDeleting(false);
  };

  const handleDeleteByDateRange = async () => {
    if (!startDate || !endDate) return;
    setIsDeleting(true);
    await onDeleteByDateRange(startDate, endDate);
    setStartDate('');
    setEndDate('');
    setIsDeleting(false);
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    await onDeleteAll();
    setIsDeleting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <Trash2 className="h-5 w-5" />
          Xóa Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delete by Version */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Xóa theo Version
          </Label>
          <div className="flex gap-2">
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Chọn version" />
              </SelectTrigger>
              <SelectContent>
                {availableVersions.map((v) => (
                  <SelectItem key={v} value={v.toString()}>
                    Version {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!selectedVersion || isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Xác nhận xóa
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn có chắc muốn xóa tất cả records của Version {selectedVersion}?
                    Records sẽ được chuyển vào thùng rác và có thể khôi phục.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteByVersion}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Xóa
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Delete by Status */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Xóa theo Trạng thái
          </Label>
          <div className="flex gap-2">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!selectedStatus || isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Xác nhận xóa
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn có chắc muốn xóa tất cả records có trạng thái "{selectedStatus}"?
                    Records sẽ được chuyển vào thùng rác và có thể khôi phục.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteByStatus}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Xóa
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Delete by Date Range */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Xóa theo Ngày import
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Từ ngày"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Đến ngày"
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={!startDate || !endDate || isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Xóa theo ngày
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Xác nhận xóa
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc muốn xóa tất cả records được import từ {startDate} đến {endDate}?
                  Records sẽ được chuyển vào thùng rác và có thể khôi phục.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteByDateRange}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Xóa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Delete All */}
        <div className="pt-4 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={totalCount === 0 || isDeleting}
              >
                <Database className="h-4 w-4 mr-2" />
                Xóa toàn bộ Dataset ({totalCount.toLocaleString()} records)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  CẢNH BÁO: Xóa toàn bộ dữ liệu!
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Bạn có chắc chắn muốn xóa <strong>TẤT CẢ {totalCount.toLocaleString()} records</strong>?
                  </p>
                  <p className="text-chart-4 font-medium">
                    Records sẽ được chuyển vào thùng rác và có thể khôi phục.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Xóa toàn bộ
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
