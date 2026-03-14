'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'default'
}: ConfirmDialogProps) {
  const { showToast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    setIsConfirming(true);
    onConfirm();
    onOpenChange(false);
    setIsConfirming(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            variant={variant === 'danger' ? 'destructive' : 'default'}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 便捷 hook：创建一个简单的确认操作
interface UseConfirmReturn {
  confirm: (title: string, description: string, onConfirm: () => void) => void;
  ConfirmDialog: typeof ConfirmDialog;
}

export function useConfirm(): UseConfirmReturn {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm?: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: undefined,
  });

  const confirm = (title: string, description: string, onConfirm: () => void) => {
    setState({
      open: true,
      title,
      description,
      onConfirm,
    });
  };

  const handleOpenChange = (open: boolean) => {
    setState(prev => ({ ...prev, open }));
  };

  const handleConfirm = () => {
    if (state.onConfirm) {
      state.onConfirm();
    }
    setState({ open: false, title: '', description: '', onConfirm: undefined });
  };

  return {
    confirm,
    ConfirmDialog: () => (
      <Dialog open={state.open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.description && (
              <DialogDescription>{state.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleConfirm} variant="destructive">
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
  };
}
