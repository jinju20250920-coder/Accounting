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
  const [position, setPosition] = React.useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 420,
  });

  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (disabled) return;
      setUncontrolledOpen(newOpen);
      onOpenChange?.(newOpen);
    },
    [disabled, onOpenChange]
  );

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const viewportMargin = 8;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const renderedHeight = contentRef.current?.offsetHeight || 360;
    const renderedWidth = contentRef.current?.offsetWidth || 256;
    const availableBelow = viewportHeight - rect.bottom - sideOffset - viewportMargin;
    const availableAbove = rect.top - sideOffset - viewportMargin;
    const openAbove = side === 'top' || (side === 'bottom' && availableBelow < renderedHeight && availableAbove > availableBelow);
    const availableHeight = Math.max(160, Math.min(420, openAbove ? availableAbove : availableBelow));

    let top = openAbove
      ? rect.top + scrollY - sideOffset - Math.min(renderedHeight, availableHeight)
      : rect.bottom + scrollY + sideOffset;
    let left = rect.left + scrollX + alignOffset;

    if (align === 'center') {
      left = rect.left + scrollX + rect.width / 2 - renderedWidth / 2;
    } else if (align === 'end') {
      left = rect.right + scrollX - renderedWidth + alignOffset;
    }

    top = Math.max(scrollY + viewportMargin, top);
    left = Math.max(
      scrollX + viewportMargin,
      Math.min(left, scrollX + viewportWidth - renderedWidth - viewportMargin)
    );

    setPosition({ top, left, width: rect.width, maxHeight: availableHeight });
  }, [side, sideOffset, align, alignOffset]);

  React.useEffect(() => {
    if (!open) return;

    updatePosition();
    const animationFrame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [open, updatePosition]);

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

  const portalContent = open ? (
    createPortal(
      <div
        ref={contentRef}
        className="fixed z-[9999]"
        style={{
          top: position.top,
          left: position.left,
          minWidth: position.width,
          maxHeight: position.maxHeight,
          '--popover-available-height': `${position.maxHeight}px`,
        } as React.CSSProperties}
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
