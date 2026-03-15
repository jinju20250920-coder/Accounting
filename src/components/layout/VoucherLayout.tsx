'use client'

import { useEffect } from 'react'
import { useVoucherStore } from '@/stores/useVoucherStore'
import { VoucherHeader } from '../voucher/VoucherHeader'
import { VoucherEntryGrid } from '../voucher/voucher-entry-grid'

export function VoucherLayout() {
  const {
    currentVoucher,
    vouchers,
    setActiveVoucher,
    createVoucher
  } = useVoucherStore()

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

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <VoucherHeader />
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