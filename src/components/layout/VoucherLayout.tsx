'use client'

import { useEffect, useState, useRef } from 'react'
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

  // 跟踪 store 是否已从持久化存储中恢复
  const [storeInitialized, setStoreInitialized] = useState(false)
  // 跟踪是否已经创建过凭证，防止重复创建
  const hasInitialized = useRef(false)

  // 检查 store 是否已经初始化（数据已从持久化存储加载）
  useEffect(() => {
    // 稍微延迟一下，确保 persist 中间件有时间加载数据
    const timer = setTimeout(() => {
      setStoreInitialized(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // 页面加载时自动初始化
  useEffect(() => {
    // 只有在 store 初始化完成后才执行，且只执行一次
    if (!storeInitialized || hasInitialized.current) return

    // 确保我们有凭证数据再执行
    if (vouchers.length > 0) {
      if (!currentVoucher) {
        // 查找第一个已记账凭证
        const firstPostedVoucher = vouchers.find(v => v.status === 'posted')
        if (firstPostedVoucher) {
          setActiveVoucher(firstPostedVoucher.id)
        } else {
          setActiveVoucher(vouchers[0].id)
        }
        hasInitialized.current = true
      }
    } else {
      // 当凭证列表为空时，创建新凭证
      createVoucher()
      hasInitialized.current = true
    }
  }, [vouchers.length, currentVoucher, setActiveVoucher, createVoucher, storeInitialized])

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