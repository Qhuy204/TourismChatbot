import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { UserWithRole } from '@/types/dataset';
import { Loader2 } from 'lucide-react';

interface TaskAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserWithRole[];
  availableRecords: number;
  totalRecords: number;
  onAssign: (name: string, userId: string, percentage: number, description?: string) => Promise<void>;
}

export function TaskAssignmentDialog({
  open,
  onOpenChange,
  users,
  availableRecords,
  totalRecords,
  onAssign,
}: TaskAssignmentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [percentage, setPercentage] = useState(10);
  const [loading, setLoading] = useState(false);

  const recordCount = Math.ceil((percentage / 100) * availableRecords);
  // Allow all users (including admins) to be assigned tasks
  const assignableUsers = users;

  const handleSubmit = async () => {
    if (!name.trim() || !selectedUser) return;

    setLoading(true);
    try {
      await onAssign(name, selectedUser, percentage, description || undefined);
      onOpenChange(false);
      // Reset form
      setName('');
      setDescription('');
      setSelectedUser('');
      setPercentage(10);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Giao Task Annotation</DialogTitle>
          <DialogDescription>
            Giao một phần dữ liệu cho user để annotation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Tên Task *</Label>
            <Input
              id="task-name"
              placeholder="VD: Annotation Phú Quốc - Batch 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Mô tả</Label>
            <Textarea
              id="task-desc"
              placeholder="Mô tả công việc cần làm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Giao cho User *</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn user..." />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Chưa có user nào
                  </div>
                ) : (
                  assignableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name || user.email} {user.role === 'admin' ? '(Admin)' : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Số lượng data ({percentage}%)</Label>
              <span className="text-sm font-medium text-primary">
                ~{recordCount.toLocaleString()} records
              </span>
            </div>
            <Slider
              value={[percentage]}
              onValueChange={([v]) => setPercentage(v)}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Records khả dụng: {availableRecords.toLocaleString()} / Tổng: {totalRecords.toLocaleString()}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !selectedUser}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Giao Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}