'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, CheckCircle, XCircle, FileText as FileTextIcon, Trash2, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoucherStore } from '@/stores/useVoucherStore'
import { Voucher } from '@/types'

interface VoucherFeedProps {
  vouchers: Voucher[]
  currentVoucher: Voucher | null
  onSelect: (voucher: Voucher) => void
  onCreate: () => void
  onDelete: (voucherId: string) => void
  onCopy: (voucherId: string) => void
  onContextMenu: (e: React.MouseEvent, voucherId: string) => void
  onToggleSidebar?: () => void
}

export function VoucherFeed({
  vouchers,
  currentVoucher,
  onSelect,
  onCreate,
  onDelete,
  onCopy,
  onContextMenu,
  onToggleSidebar
}: VoucherFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    voucherId: string
  }>({ visible: false, x: 0, y: 0, voucherId: '' })

  // Auto-scroll current voucher into view
  useEffect(() => {
    if (scrollRef.current && currentVoucher) {
      const elements = scrollRef.current.querySelectorAll('.voucher-card')
      const currentElement = Array.from(elements).find(el =>
        el.getAttribute('data-voucher-id') === currentVoucher.id
      )

      if (currentElement) {
        currentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        })
      }
    }
  }, [currentVoucher])

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, voucher: Voucher) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      voucherId: voucher.id
    })
  }

  // Hide context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(prev => ({ ...prev, visible: false }))
    }

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu.visible])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  // Get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'draft':
        return { icon: FileText, color: 'text-slate-500 bg-slate-100' }
      case 'review':
        return { icon: FileText, color: 'text-yellow-600 bg-yellow-100' }
      case 'posted':
        return { icon: CheckCircle, color: 'text-green-600 bg-green-100' }
      case 'reversed':
        return { icon: XCircle, color: 'text-red-600 bg-red-100' }
      default:
        return { icon: FileText, color: 'text-slate-500 bg-slate-100' }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">凭证列表</span>
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button
          onClick={onCreate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建凭证
        </Button>
      </div>

      {/* Voucher List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        {vouchers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileTextIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>暂无凭证</p>
            <p className="text-sm mt-1">点击"新建凭证"开始</p>
          </div>
        ) : (
          <div className="p-2">
            {vouchers.map((voucher) => {
              const statusInfo = getStatusInfo(voucher.status)
              const isSelected = currentVoucher?.id === voucher.id

              return (
                <VoucherCard
                  key={voucher.id}
                  voucher={voucher}
                  isSelected={isSelected}
                  onSelect={() => onSelect(voucher)}
                  onDelete={onDelete}
                  onContextMenu={(e) => onContextMenu(e, voucher.id)}
                  statusInfo={statusInfo}
                  formatDate={formatDate}
                  className={cn(
                    voucher.id === currentVoucher?.id && 'border-l-4 border-l-blue-600'
                  )}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="absolute z-50 w-48 py-1 bg-white border border-slate-200 rounded-md shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onCopy(contextMenu.voucherId)
              setContextMenu({ ...contextMenu, visible: false })
            }}
          >
            <FileTextIcon className="w-4 h-4 mr-2" />
            复制凭证
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600"
            onClick={() => {
              onDelete(contextMenu.voucherId)
              setContextMenu({ ...contextMenu, visible: false })
            }}
          >
            <XCircle className="w-4 h-4 mr-2" />
            删除凭证
          </Button>
        </div>
      )}
    </div>
  )
}

// Sub-component for individual voucher card
interface VoucherCardProps {
  voucher: Voucher
  isSelected: boolean
  onSelect: () => void
  onDelete: (voucherId: string) => void
  onContextMenu: (e: React.MouseEvent) => void
  statusInfo: { icon: React.ComponentType<{ className?: string }>; color: string }
  formatDate: (date: string) => string
  className?: string
}

function VoucherCard({
  voucher,
  isSelected,
  onSelect,
  onDelete,
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除此凭证吗？')) {
      onDelete(voucher.id)
    }
  }

  return (
    <Card
      data-voucher-id={voucher.id}
      className={cn(
        'voucher-card mb-2 cursor-pointer transition-all duration-200',
        isSelected && 'bg-blue-50 hover:bg-blue-100',
        !isSelected && 'hover:bg-slate-50',
        className
      )}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <CardContent className="p-3">
        {/* Voucher Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-600">
            {voucher.voucherNo}
          </span>
          <div className="flex items-center gap-1">
            {voucher.status !== 'posted' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
            <Badge variant="secondary" className={statusInfo.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {voucher.status}
            </Badge>
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
      </CardContent>
    </Card>
  )
}