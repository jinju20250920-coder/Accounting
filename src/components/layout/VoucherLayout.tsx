'use client'

import { useEffect, useState, useRef } from 'react'
import { useVoucherStore } from '@/stores/useVoucherStore'
import { VoucherHeader } from '../voucher/VoucherHeader'
import { VoucherEntryGrid } from '../voucher/voucher-entry-grid'

export function VoucherLayout() {
  const {
    currentVoucher,
    createVoucher,
    initialize
  } = useVoucherStore()

  // 跟踪 store 是否已从持久化存储中恢复
  const [storeInitialized, setStoreInitialized] = useState(false)
  // 跟踪是否已经创建过凭证，防止重复创建
  const hasInitialized = useRef(false)

  // 检查 store 是否已经初始化（数据已从持久化存储加载）
  useEffect(() => {
    // 初始化 store
    const initStore = async () => {
      await initialize()
      // 确保 persist 中间件有时间加载数据
      setTimeout(() => {
        setStoreInitialized(true)
      }, 100)
    }

    initStore()
  }, [initialize])

  // 页面加载时检查是否需要创建新凭证
  useEffect(() => {
    // 只有在 store 初始化完成后才执行，且只执行一次
    if (!storeInitialized || hasInitialized.current) return

    // 检查是否需要创建新凭证：
    // 1. 没有当前凭证
    // 2. 当前凭证不是草稿状态（已记账/已冲销的凭证不能编辑）
    const shouldCreateNew = !currentVoucher || currentVoucher.status !== 'draft'

    if (shouldCreateNew) {
      console.log('VoucherLayout: 创建新空白草稿凭证')
      createVoucher()
    } else {
      console.log('VoucherLayout: 使用现有草稿凭证:', currentVoucher.voucherNo)
    }
    hasInitialized.current = true
  }, [storeInitialized, currentVoucher, createVoucher])

  // Handle paste events globally
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
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
  }, [])

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