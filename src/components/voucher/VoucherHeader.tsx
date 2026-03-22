'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Save,
  Copy,
  PlusCircle,
  ArrowRight,
  Monitor,
  CheckCircle,
  XCircle,
  FileText,
  Trash2
} from 'lucide-react'
import { useVoucherStore } from '@/stores/useVoucherStore'
import { useVoucherTemplateStore } from '@/stores/useVoucherTemplateStore'
import { useToast } from '@/hooks/use-toast'
import { calculateVoucherStatus } from '@/lib/accounting'

export function VoucherHeader() {
  const {
    currentVoucher,
    saveVoucher,
    createVoucher,
    deleteVoucher,
    vouchers,
    setActiveVoucher,
    updateVoucherDate,
    currentEntries
  } = useVoucherStore()

  const { addTemplate } = useVoucherTemplateStore()

  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSaveAsTemplateDialog, setShowSaveAsTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')

  // 保存为凭证模版
  const handleSaveAsTemplate = async () => {
    if (!currentVoucher) return

    try {
      // 只保存有实际数据的分录（科目代码不为空或金额不为0的分录）
      const validEntries = currentEntries.filter(entry =>
        entry.subjectCode ||
        entry.subjectName ||
        entry.debit !== 0 ||
        entry.credit !== 0
      )

      if (validEntries.length === 0) {
        toast({
          title: "保存失败",
          description: "没有有效的分录数据，无法保存为模版"
        })
        return
      }

      addTemplate({
        name: templateName.trim() || `模版_${currentVoucher.voucherNo}`,
        description: templateDescription.trim(),
        voucherType: currentVoucher.voucherType,
        entries: validEntries.map(entry => ({
          id: entry.id,
          summary: entry.summary,
          subjectCode: entry.subjectCode,
          subjectName: entry.subjectName,
          deptCode: entry.deptCode,
          projectCode: entry.projectCode,
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          currencyCode: (entry as any).currencyCode || '',
          currencyName: (entry as any).currencyName || '',
          cashFlowItem: (entry as any).cashFlowItem || '',
          customerName: (entry as any).customerName || '',
          supplierName: (entry as any).supplierName || ''
        }))
      })

      toast({
        title: "保存成功",
        description: "凭证已保存为模版"
      })

      setShowSaveAsTemplateDialog(false)
      setTemplateName('')
      setTemplateDescription('')
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "保存模版失败"
      })
    }
  }

  // Check if voucher is balanced
  const isBalanced = currentVoucher && currentVoucher.entries.reduce((balance, entry) => {
    return balance + (entry.debit || 0) - (entry.credit || 0)
  }, 0) === 0

  // Handle Save & Next
  const handleSaveAndNext = async () => {
    if (!currentVoucher) return

    setIsSaving(true)
    try {
      await saveVoucher()

      // Create new voucher
      createVoucher()

      toast({
        title: "操作成功",
        description: "凭证已保存并新建下一个",
      })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Smart Paste
  const handleSmartPaste = () => {
    const pasteArea = document.getElementById('voucher-main-content')
    if (pasteArea) {
      // Trigger paste event that will be handled by layout
      const pasteEvent = new Event('paste', { bubbles: true })
      pasteArea.dispatchEvent(pasteEvent)

      toast({
        title: "智能粘贴",
        description: "请在表格中粘贴Excel数据",
      })
    }
  }

  // Handle Delete
  const handleDelete = async () => {
    if (!currentVoucher) return

    try {
      deleteVoucher(currentVoucher.id)

      toast({
        title: "操作成功",
        description: "凭证已删除",
      })

      // 如果还有其他凭证，激活第一个
      if (vouchers.length > 1) {
        const otherVouchers = vouchers.filter(v => v.id !== currentVoucher.id)
        setActiveVoucher(otherVouchers[0].id)
      } else {
        // 如果没有其他凭证，创建一个新的
        createVoucher()
      }
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  // Handle Fullscreen
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  // Status display
  if (!currentVoucher) {
    return (
      <div className="border-b border-slate-200 bg-white">
        {/* Breadcrumb */}
        <div className="px-6 py-3 text-sm text-slate-500">
          记账凭证 / 新建凭证
        </div>

        {/* Main Header Content */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Voucher Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    新凭证
                  </h1>
                  <div className="text-sm text-slate-600 mt-1">
                    <input
                      type="date"
                      value={new Date().toISOString().split('T')[0]}
                      onChange={(e) => updateVoucherDate(e.target.value)}
                      className="bg-transparent border-b border-slate-300 hover:border-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  <FileText className="w-4 h-4 mr-1" />
                  草稿
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* New Voucher */}
              <Button
                onClick={() => createVoucher()}
                size="sm"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                新建凭证
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const StatusIcon = currentVoucher.status === 'draft' ? FileText :
                     currentVoucher.status === 'review' ? CheckCircle :
                     currentVoucher.status === 'posted' ? CheckCircle :
                     XCircle

  const statusColor = currentVoucher.status === 'draft' ? 'bg-slate-100 text-slate-700' :
                      currentVoucher.status === 'review' ? 'bg-yellow-100 text-yellow-700' :
                      currentVoucher.status === 'posted' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'

  return (
    <div className="border-b border-slate-200 bg-white">
      {/* Breadcrumb */}
      <div className="px-6 py-3 text-sm text-slate-500">
        记账凭证 / {currentVoucher.voucherNo}
      </div>

      {/* Main Header Content */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Voucher Info */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {currentVoucher.voucherNo}
                </h1>
                <div className="text-sm text-slate-600 mt-1">
                  <input
                    type="date"
                    value={currentVoucher.date}
                    onChange={(e) => updateVoucherDate(e.target.value)}
                    className="bg-transparent border-b border-slate-300 hover:border-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    disabled={currentVoucher.status !== 'draft'}
                  />
                </div>
              </div>

              {/* Status Badge */}
              <Badge variant="secondary" className={statusColor}>
                <StatusIcon className="w-4 h-4 mr-1" />
                {currentVoucher.status === 'draft' ? '草稿' :
                 currentVoucher.status === 'review' ? '审核中' :
                 currentVoucher.status === 'posted' ? '已记账' :
                 '已冲销'}
              </Badge>

              {/* Balance Status */}
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    已平衡
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <XCircle className="w-4 h-4 mr-1" />
                    未平衡
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">

            {/* Save as Template */}
            <Button
              variant="outline"
              onClick={() => setShowSaveAsTemplateDialog(true)}
              disabled={currentVoucher.status !== 'draft' || currentVoucher.entries.length === 0}
              size="sm"
            >
              <FileText className="w-4 h-4 mr-2" />
              保存为模版
            </Button>

            {/* Smart Paste */}
            <Button
              variant="outline"
              onClick={handleSmartPaste}
              disabled={currentVoucher.status !== 'draft'}
              size="sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              智能粘贴
            </Button>

            {/* Save & Next */}
            <Button
              onClick={handleSaveAndNext}
              disabled={!isBalanced || currentVoucher.status !== 'draft' || isSaving}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '保存中...' : '保存并新建'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>


            {/* Delete Voucher */}
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('确定要删除此凭证吗？')) {
                  handleDelete()
                }
              }}
              disabled={currentVoucher.status === 'posted'}
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </Button>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              onClick={handleFullscreen}
              size="sm"
            >
              <Monitor className="w-4 h-4" />
            </Button>

            {/* New Voucher */}
            <Button
              onClick={() => createVoucher()}
              variant="outline"
              size="sm"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              新建
            </Button>
          </div>
        </div>
      </div>

      {/* 保存为模版对话框 */}
      <Dialog open={showSaveAsTemplateDialog} onOpenChange={setShowSaveAsTemplateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>保存为凭证模版</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="templateName">模版名称</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="请输入模版名称"
                className="col-span-3"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="templateDescription">模版描述（可选）</Label>
              <Input
                id="templateDescription"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="请输入模版描述"
                className="col-span-3"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowSaveAsTemplateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveAsTemplate}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}