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

interface Props {
  manuscript: {
    id: string;
    displayId: string;
    destroyedAt: string | null;
  };
}

export function ManuscriptActionsClient({ manuscript }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (manuscript.destroyedAt) {
    return (
      <span className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">-</span>
    );
  }

  async function handleDestroy() {
    setLoading(true);
    try {
      await fetch(`/api/admin/manuscripts/${manuscript.id}`, {
        method: 'DELETE',
      });
    } finally {
      setLoading(false);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        销毁
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认销毁稿件</DialogTitle>
            <DialogDescription>
              确定要永久销毁稿件 <span className="font-mono">{manuscript.displayId}</span> 吗？
              此操作将同时删除关联的段落和引文数据，且不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>取消</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDestroy} disabled={loading}>
              {loading ? '处理中...' : '确认销毁'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
