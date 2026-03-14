'use client';

import * as React from 'react';
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

  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (disabled) return;
      setUncontrolledOpen(newOpen);
      onOpenChange?.(newOpen);
    },
    [disabled, onOpenChange]
  );

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

  return (
    <div className="relative" ref={triggerRef}>
      <div onClick={() => handleOpenChange(!open)} className="w-full h-full">
        {children}
      </div>

      {open && (
        <div
          ref={contentRef}
          className="absolute z-50 w-full mt-1"
          style={{
            top: '100%',
            left: 0,
          }}
        >
          {content}
        </div>
      )}
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
      style={{ maxHeight: '320px', overflowY: 'auto', ...style }}
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
