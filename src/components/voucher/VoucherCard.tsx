'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Voucher } from '@/types'

interface VoucherCardProps {
  voucher: Voucher
  isSelected: boolean
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
  statusInfo: { icon: React.ComponentType<{ className?: string }>; color: string }
  formatDate: (date: string) => string
  className?: string
}

export function VoucherCard({
  voucher,
  isSelected,
  onSelect,
  onContextMenu,
  statusInfo,
  formatDate,
  className
}: VoucherCardProps) {
  const StatusIcon = statusInfo.icon
  const totalAmount = voucher.entries.reduce((sum, entry) =>
    sum + Math.abs(entry.debit || entry.credit || 0), 0
  )

  // Check if voucher is balanced
  const isBalanced = voucher.entries.reduce((balance, entry) => {
    return balance + (entry.debit || 0) - (entry.credit || 0)
  }, 0) === 0

  return (
    <Card
      data-voucher-id={voucher.id}
      className={cn(
        'voucher-card mb-2 cursor-pointer transition-all duration-200',
        isSelected && 'bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-600',
        !isSelected && 'hover:bg-slate-50',
        className
      )}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <div className="p-3">
        {/* Voucher Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-600">
            {voucher.voucherNo}
          </span>
          <div className={`${statusInfo.color} px-2 py-1 rounded-md text-xs flex items-center`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {voucher.status}
          </div>
        </div>

        {/* Summary Preview */}
        <div className="text-xs text-slate-600 mb-2 line-clamp-1">
          {voucher.summary || '无摘要'}
        </div>

        {/* Bottom Info */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{formatDate(voucher.date)}</span>
          <span className={isBalanced ? 'text-green-600' : 'text-red-600'}>
            ¥{totalAmount.toFixed(2)}
          </span>
        </div>

        {/* Balance Indicator */}
        <div className="mt-1">
          {isBalanced ? (
            <div className="w-2 h-2 bg-green-500 rounded-full float-right" />
          ) : (
            <div className="w-2 h-2 bg-red-500 rounded-full float-right" />
          )}
        </div>
      </div>
    </Card>
  )
}