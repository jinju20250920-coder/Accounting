'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  content: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  alignOffset?: number;
  disabled?: boolean;
}

export function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
  content,
  align = 'start',
  side = 'bottom',
  sideOffset = 4,
  alignOffset = 0,
  disabled = false,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (disabled) return;
      setUncontrolledOpen(newOpen);
      onOpenChange?.(newOpen);
    },
    [disabled, onOpenChange]
  );

  // 计算浮层位置（相对于视口）
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = rect.bottom + scrollY + sideOffset;
    let left = rect.left + scrollX + alignOffset;

    if (side === 'top') {
      top = rect.top + scrollY - sideOffset;
    }

    if (align === 'center') {
      left = rect.left + scrollX + rect.width / 2 - 128; // 128 = half of typical 256px width
    } else if (align === 'end') {
      left = rect.right + scrollX - 256 + alignOffset;
    }

    setPosition({ top, left, width: rect.width });
  }, [side, sideOffset, align, alignOffset]);

  React.useEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, updatePosition]);

  // 点击外部关闭
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        handleOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleOpenChange]);

  // ESC 键关闭
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, handleOpenChange]);

  // Portal 内容
  const portalContent = open ? (
    createPortal(
      <div
        ref={contentRef}
        className="fixed z-[9999]"
        style={{
          top: position.top,
          left: position.left,
          minWidth: position.width,
        }}
      >
        {content}
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className="relative" ref={triggerRef}>
      <div
        onClick={() => {
          if (controlledOpen === undefined) {
            handleOpenChange(!open);
          }
        }}
        className="w-full h-full"
      >
        {children}
      </div>
      {portalContent}
    </div>
  );
}

export const PopoverTrigger = ({ children, asChild = false }: { children: React.ReactNode; asChild?: boolean }) => {
  return <>{children}</>;
};

export const PopoverContent = ({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-lg border border-slate-200 p-1',
        className
      )}
      style={{ ...style }}
    >
      {children}
    </div>
  );
};

export const PopoverItem = ({
  children,
  onClick,
  disabled = false,
  className = '',
  active = false,
  onMouseEnter,
  onMouseLeave,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  active?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) => {
  return (
    <div
      className={cn(
        'px-3 py-2 text-sm cursor-pointer border-b border-slate-50 last:border-b-0',
        active ? 'bg-blue-50' : 'hover:bg-slate-50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};