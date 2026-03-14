'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useVoucherStore } from '@/stores/useVoucherStore'
import { VoucherFeed } from '../voucher/VoucherFeed'
import { VoucherHeader } from '../voucher/VoucherHeader'
import { VoucherEntryGrid } from '../voucher/voucher-entry-grid'
import { Button } from '../ui/button'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'

export function VoucherLayout() {
  const {
    currentVoucher,
    vouchers,
    setActiveVoucher,
    createVoucher,
    deleteVoucher,
    copyVoucher
  } = useVoucherStore()

  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showVoucherFeed, setShowVoucherFeed] = useState(true)

  // 页面加载时自动初始化
  useEffect(() => {
    if (vouchers.length === 0) {
      createVoucher()
    } else if (!currentVoucher && vouchers.length > 0) {
      setActiveVoucher(vouchers[0].id)
    }
  }, [vouchers.length, currentVoucher, createVoucher, setActiveVoucher])

  // Handle paste events globally
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!currentVoucher) return

      const pasteArea = document.getElementById('voucher-main-content')
      if (!pasteArea || !pasteArea.contains(e.target as Node)) {
        return
      }

      // Find the grid component and trigger paste
      const gridElement = document.querySelector('.voucher-grid')
      if (gridElement) {
        gridElement.dispatchEvent(new Event('paste', { bubbles: true }))
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [currentVoucher])

  // Handle right-click on voucher cards
  const handleVoucherContextMenu = (e: React.MouseEvent, voucherId: string) => {
    e.preventDefault()
    // Context menu will be implemented in Phase 3
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Navigation Column */}
      <div className="w-12 flex-shrink-0 border-r border-slate-200 bg-white">
        {/* Navigation content will be added in Phase 4 */}
      </div>

      {/* Voucher Feed */}
      {showVoucherFeed && (
        <div className={cn(
          "w-64 flex-shrink-0 border-r border-slate-200 bg-white transition-all duration-300",
          showMobileMenu && "absolute inset-y-0 left-12 z-20 shadow-lg"
        )}>
          {/* Mobile close button */}
          {showMobileMenu && (
            <div className="p-3 border-b border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileMenu(false)}
                className="w-full justify-start"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                关闭
              </Button>
            </div>
          )}

          <VoucherFeed
            vouchers={vouchers}
            currentVoucher={currentVoucher}
            onSelect={(voucher) => setActiveVoucher(voucher.id)}
            onCreate={createVoucher}
            onDelete={deleteVoucher}
            onCopy={copyVoucher}
            onContextMenu={handleVoucherContextMenu}
            onToggleSidebar={() => setShowVoucherFeed(false)}
          />
        </div>
      )}

      {/* Mobile menu overlay */}
      {showMobileMenu && !showVoucherFeed && (
        <div className="absolute inset-y-0 left-0 w-full z-20">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileMenu(false)}></div>
        </div>
      )}

      {/* Collapsed state - show toggle button */}
      {!showVoucherFeed && !showMobileMenu && (
        <div className="w-12 flex-shrink-0 border-r border-slate-200 bg-white flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVoucherFeed(true)}
            className="w-10 h-10 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden",
        !showVoucherFeed && "ml-0"
      )}>
        <VoucherHeader onToggleSidebar={() => setShowVoucherFeed(!showVoucherFeed)} />
        <main
          id="voucher-main-content"
          className="flex-1 overflow-auto p-6 bg-white"
          onPaste={(e) => {
            // Find the grid and trigger paste
            const gridElement = document.querySelector('.voucher-grid')
            if (gridElement) {
              gridElement.dispatchEvent(new Event('paste', { bubbles: true }))
            }
          }}
        >
          <VoucherEntryGrid />
        </main>
      </div>
    </div>
  )
}