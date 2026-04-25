'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_OPTIONS = [
  { value: 'admin', label: '管理员' },
  { value: 'B', label: 'B 端' },
  { value: 'C', label: 'C 端' },
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  B: 'B 端',
  C: 'C 端',
};

interface Props {
  user: {
    id: string;
    role: string;
    suspendedAt: string | null;
  };
}

export function UserActionsClient({ user }: Props) {
  const router = useRouter();
  const [dialogType, setDialogType] = useState<'role' | 'suspend' | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSuspended = user.suspendedAt !== null;

  async function handleConfirm() {
    setLoading(true);
    try {
      if (dialogType === 'role' && pendingRole) {
        await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: pendingRole }),
        });
      } else if (dialogType === 'suspend') {
        await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suspended: !isSuspended }),
        });
      }
    } finally {
      setLoading(false);
      setDialogType(null);
      setPendingRole(null);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {ROLE_LABELS[user.role] ?? user.role}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ROLE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              disabled={opt.value === user.role}
              onClick={() => {
                if (opt.value !== user.role) {
                  setPendingRole(opt.value);
                  setDialogType('role');
                }
              }}
            >
              {opt.label}
              {opt.value === user.role && ' (当前)'}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant={isSuspended ? 'secondary' : 'destructive'}
        size="sm"
        onClick={() => setDialogType('suspend')}
      >
        {isSuspended ? '启用' : '停用'}
      </Button>

      <Dialog
        open={dialogType !== null}
        onOpenChange={(open) => { if (!open) { setDialogType(null); setPendingRole(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'role' ? '确认更改角色' : isSuspended ? '确认启用用户' : '确认停用用户'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'role' && pendingRole
                ? `确定要将该用户的角色从「${ROLE_LABELS[user.role]}」更改为「${ROLE_LABELS[pendingRole]}」吗？`
                : isSuspended
                  ? '确定要重新启用此用户吗？'
                  : '停用后用户将无法登录系统。确定要停用此用户吗？'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>取消</Button>
            </DialogClose>
            <Button
              variant={dialogType === 'suspend' && !isSuspended ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
