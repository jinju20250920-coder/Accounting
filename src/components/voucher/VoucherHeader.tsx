'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Trash2,
  Upload,
  Download,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useVoucherStore } from '@/stores/useVoucherStore'
import { useVoucherTemplateStore } from '@/stores/useVoucherTemplateStore'
import { useToast } from '@/hooks/use-toast'
import { calculateVoucherStatus } from '@/lib/accounting'
import { getCurrentService } from '@/lib/database'

export function VoucherHeader() {
  const router = useRouter()
  const {
    currentVoucher,
    saveVoucher,
    createVoucher,
    deleteVoucher,
    vouchers,
    setActiveVoucher,
    updateVoucherDate,
    currentEntries,
    initialize
  } = useVoucherStore()

  const { addTemplate } = useVoucherTemplateStore()

  const { showToast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSaveAsTemplateDialog, setShowSaveAsTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showImportResultDialog, setShowImportResultDialog] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // 导入结果状态
  interface ImportResult {
    voucherNo: string
    status: 'success' | 'failed' | 'warning'
    message: string
    voucher?: any
    entries?: any[]
  }
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

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
        showToast('error', "没有有效的分录数据，无法保存为模版")
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

      showToast('success', "凭证已保存为模版")

      setShowSaveAsTemplateDialog(false)
      setTemplateName('')
      setTemplateDescription('')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : "保存模版失败")
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

      showToast('success', "凭证已保存并新建下一个")
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : "未知错误")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Delete
  const handleDelete = async () => {
    if (!currentVoucher) return

    try {
      deleteVoucher(currentVoucher.id)

      showToast('success', "凭证已删除")

      // 如果还有其他凭证，激活第一个
      if (vouchers.length > 1) {
        const otherVouchers = vouchers.filter(v => v.id !== currentVoucher.id)
        setActiveVoucher(otherVouchers[0].id)
      } else {
        // 如果没有其他凭证，创建一个新的
        createVoucher()
      }
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : "未知错误")
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

  // Handle Import Excel
  const handleImportExcel = async (file: File) => {
    setImportFile(file)
    setIsImporting(true)

    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

      console.log('Excel 原始数据:', jsonData)

      // 解析Excel数据为凭证格式
      const vouchers = parseExcelToVouchers(jsonData)
      console.log('解析后的凭证数据:', vouchers)
      setImportPreview(vouchers)

      showToast('success', `共解析到 ${vouchers.length} 张凭证`)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : "请检查文件格式")
      setImportPreview([])
    } finally {
      setIsImporting(false)
    }
  }

  // 解析Excel数据为凭证 - 始终按凭证号分组
  const parseExcelToVouchers = (data: any[]): any[] => {
    // 辅助函数：解析Excel日期（支持字符串和序列号）
    const parseExcelDate = (dateValue: any): string => {
      if (!dateValue) return new Date().toISOString().split('T')[0]

      // 如果是数字（Excel日期序列号）
      if (typeof dateValue === 'number') {
        // Excel日期序列号从1900-01-01开始计算
        const excelEpoch = new Date(1900, 0, 1).getTime()
        const daysOffset = dateValue - 1 // Excel从1开始计数
        const date = new Date(excelEpoch + daysOffset * 24 * 60 * 60 * 1000)
        return date.toISOString().split('T')[0]
      }

      // 如果是字符串，直接使用
      const dateStr = String(dateValue)
      // 处理可能的 YYYYMMDD 格式（如 20260322）
      if (/^\d{8}$/.test(dateStr)) {
        const year = dateStr.substring(0, 4)
        const month = dateStr.substring(4, 6)
        const day = dateStr.substring(6, 8)
        return `${year}-${month}-${day}`
      }
      // 处理可能的 YYYY-M-D 或 YYYY-MM-DD 格式
      return dateStr
    }

    // 按凭证号分组所有分录
    const groupedVouchers = new Map<string, any>()

    data.forEach((row: any) => {
      const voucherNo = row['凭证号'] || row['凭证字号'] || '记-001'
      const date = parseExcelDate(row['日期'])
      const summary = row['摘要'] || ''
      const debit = Number(row['借方金额'] || row['借方'] || 0) || 0
      const credit = Number(row['贷方金额'] || row['贷方'] || 0) || 0

      // 如果凭证号不存在，创建新凭证
      if (!groupedVouchers.has(voucherNo)) {
        groupedVouchers.set(voucherNo, {
          voucherNo,
          date,
          summary,
          status: 'draft' as const,
          voucherType: 'general' as const,
          entries: []
        })
      }

      const voucher = groupedVouchers.get(voucherNo)!

      // 如果这一行有科目代码或借贷金额，添加为分录
      if (row['科目代码'] || row['科目'] || debit > 0 || credit > 0) {
        voucher.entries.push({
          id: `entry_${Date.now()}_${voucher.entries.length}`,
          summary: String(row['分录摘要'] || summary),
          subjectCode: String(row['科目代码'] || row['科目'] || ''),
          subjectName: String(row['科目名称'] || ''),
          debit,
          credit,
          deptCode: String(row['部门代码'] || row['部门'] || ''),
          projectCode: String(row['项目代码'] || row['项目'] || ''),
          docNo: String(row['单据号'] || ''),
          currencyCode: String(row['币别代码'] || row['币别'] || ''),
          currencyName: String(row['币别名称'] || ''),
          cashFlowItem: String(row['现金流量项目'] || row['现金流量'] || ''),
          customerName: String(row['客户'] || row['往来单位'] || row['客户名称'] || ''),
          supplierName: String(row['供应商'] || row['往来单位'] || row['供应商名称'] || '')
        })
      }
    })

    const vouchers = Array.from(groupedVouchers.values()).filter(v => v.entries.length > 0)

    console.log('解析结果:', vouchers.map(v => ({
      voucherNo: v.voucherNo,
      entriesCount: v.entries.length,
      debitTotal: v.entries.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0),
      creditTotal: v.entries.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0),
      isBalanced: Math.abs(
        v.entries.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0) -
        v.entries.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0)
      ) < 0.01
    })))

    return vouchers
  }

  // 确认导入
  const handleConfirmImport = async () => {
    if (importPreview.length === 0) {
      showToast('error', "请先上传Excel文件")
      return
    }

    setIsImporting(true)
    const results: ImportResult[] = []

    try {
      // 确保使用正确的账套ID - 在导入前设置
      const { useAccountSetStore } = await import('@/stores/useAccountSetStore')
      const { sqliteService } = await import('@/lib/database/sqlite-service')
      const accountSetStore = useAccountSetStore.getState()
      const currentAccountSet = accountSetStore.getCurrentAccountSet()

      if (currentAccountSet) {
        sqliteService.setAccountSetId(currentAccountSet.id)
      }

      for (const voucherData of importPreview) {
        const result: ImportResult = {
          voucherNo: voucherData.voucherNo,
          status: 'success',
          message: '导入成功',
          voucher: voucherData,
          entries: voucherData.entries
        }

        try {
          // 检查借贷平衡 - 确保数值类型正确
          const debitTotal = voucherData.entries.reduce((sum: number, e: any) => {
            const val = Number(e.debit) || 0
            return sum + val
          }, 0)
          const creditTotal = voucherData.entries.reduce((sum: number, e: any) => {
            const val = Number(e.credit) || 0
            return sum + val
          }, 0)

          console.log(`凭证 ${voucherData.voucherNo} 借贷检查:`, {
            debitTotal,
            creditTotal,
            diff: Math.abs(debitTotal - creditTotal),
            entries: voucherData.entries.map(e => ({ debit: e.debit, credit: e.credit, typeDebit: typeof e.debit, typeCredit: typeof e.credit }))
          })

          if (Math.abs(debitTotal - creditTotal) > 0.01) {
            result.status = 'failed'
            result.message = `借贷不平衡：借方 ${debitTotal.toFixed(2)} ≠ 贷方 ${creditTotal.toFixed(2)}，差额 ${(debitTotal - creditTotal).toFixed(2)}`
            results.push(result)
            continue
          }

          // 检查科目代码是否有效
          const invalidEntries = voucherData.entries.filter((entry: any) => {
            const code = String(entry.subjectCode || '').trim()
            if (code === '') {
              return true
            }
            // 检查科目代码格式（4位或6位数字）
            return !/^\d{4}(\d{2})?$/.test(code)
          })

          if (invalidEntries.length > 0) {
            result.status = 'failed'
            const invalidCodes = invalidEntries.map((e: any) => e.subjectCode || '(空)').join(', ')
            result.message = `科目代码格式错误：${invalidCodes}（应为4位或6位数字）`
            results.push(result)
            continue
          }

          // 检查是否有分录
          if (voucherData.entries.length === 0) {
            result.status = 'failed'
            result.message = '凭证没有分录数据'
            results.push(result)
            continue
          }

          // 检查金额是否全部为0
          const totalAmount = voucherData.entries.reduce((sum: number, e: any) => {
            return sum + (Number(e.debit) || 0) + (Number(e.credit) || 0)
          }, 0)
          if (totalAmount === 0) {
            result.status = 'warning'
            result.message = '凭证金额为0，已创建但不建议入账'
          }

          // 创建新凭证
          const now = new Date().toISOString()
          const newVoucher = {
            ...voucherData,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            entries: voucherData.entries.map((entry: any, idx: number) => ({
              ...entry,
              id: `entry_${Date.now()}_${idx}`,
              date: voucherData.date,
              auxiliary: {
                department: entry.deptCode || '',
                project: entry.projectCode || '',
                customer: entry.customerName || '',
                supplier: entry.supplierName || ''
              }
            })),
            createdBy: 'import',
            createTime: now,
            updateTime: now
          }

          // 直接保存到数据库
          await getCurrentService().saveVoucher(newVoucher)
          results.push(result)
        } catch (error) {
          console.error('导入凭证失败:', voucherData.voucherNo, error)
          result.status = 'failed'
          result.message = error instanceof Error ? error.message : `保存失败：${String(error)}`
          results.push(result)
        }
      }

      // 重新加载凭证列表
      await initialize()

      // 显示结果对话框
      setImportResults(results)
      setShowImportResultDialog(true)
      setShowImportDialog(false)

      // 如果有失败的凭证，提示用户
      const failedCount = results.filter(r => r.status === 'failed').length
      const successCount = results.filter(r => r.status === 'success').length

      if (failedCount > 0) {
        showToast('warning', `成功 ${successCount} 张，失败 ${failedCount} 张`)
      } else {
        showToast('success', `成功导入 ${successCount} 张凭证`)
      }

      // 清空预览数据
      setImportPreview([])
      setImportFile(null)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : "未知错误")
    } finally {
      setIsImporting(false)
    }
  }

  // 下载导入模板
  const handleDownloadTemplate = async () => {
    const template = [
      {
        '凭证号': '记-202503-001',
        '日期': '2025-03-22',
        '摘要': '收到货款',
        '分录摘要': '银行收款',
        '科目代码': '1002',
        '科目名称': '银行存款',
        '借方': 10000,
        '贷方': 0,
        '部门代码': '',
        '项目代码': '',
        '单据号': '',
        '币别代码': '',
        '币别名称': '',
        '现金流量项目': '',
        '现金流量': '经营活动_现金流入',
        '客户': '',
        '供应商': '',
        '往来单位': ''
      },
      {
        '凭证号': '记-202503-001',
        '日期': '2025-03-22',
        '摘要': '收到货款',
        '分录摘要': '确认收入',
        '科目代码': '1122',
        '科目名称': '应收账款',
        '借方': 0,
        '贷方': 10000,
        '部门代码': '',
        '项目代码': '',
        '单据号': '',
        '币别代码': '',
        '币别名称': '',
        '现金流量项目': '',
        '现金流量': '',
        '客户': '某某公司',
        '供应商': '',
        '往来单位': ''
      }
    ]

    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(template)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '凭证导入模板')
    XLSX.writeFile(workbook, '凭证导入模板.xlsx')
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
              onClick={() => setShowImportDialog(true)}
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              导入凭证
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

      {/* 导入凭证对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>批量导入凭证</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto py-4">
            {!importFile ? (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-lg font-medium text-slate-900 mb-2">上传Excel文件</p>
                <p className="text-sm text-slate-500 mb-4">支持 .xlsx, .xls 格式的凭证文件</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImportExcel(file)
                    }
                  }}
                  className="hidden"
                  id="import-file-input"
                />
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={() => document.getElementById('import-file-input')?.click()}
                    disabled={isImporting}
                  >
                    选择文件
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载模板
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">已选择文件:</span>
                    <span className="text-sm text-slate-600">{importFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImportFile(null)
                      setImportPreview([])
                    }}
                  >
                    重新选择
                  </Button>
                </div>

                {importPreview.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm font-medium">
                      共解析到 {importPreview.length} 张凭证
                    </div>

                    <div className="border rounded-lg max-h-60 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">凭证号</th>
                            <th className="px-3 py-2 text-left font-medium">日期</th>
                            <th className="px-3 py-2 text-left font-medium">摘要</th>
                            <th className="px-3 py-2 text-left font-medium">分录数</th>
                            <th className="px-3 py-2 text-right font-medium">借方合计</th>
                            <th className="px-3 py-2 text-right font-medium">贷方合计</th>
                            <th className="px-3 py-2 text-center font-medium">平衡状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((voucher, idx) => {
                            const debitTotal = voucher.entries.reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0)
                            const creditTotal = voucher.entries.reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0)
                            const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01
                            const diff = Math.abs(debitTotal - creditTotal)
                            return (
                              <tr key={idx} className={`border-t ${!isBalanced ? 'bg-red-50' : ''}`}>
                                <td className="px-3 py-2 font-mono">{voucher.voucherNo}</td>
                                <td className="px-3 py-2">{voucher.date}</td>
                                <td className="px-3 py-2">{voucher.summary}</td>
                                <td className="px-3 py-2 text-center">{voucher.entries.length}</td>
                                <td className="px-3 py-2 text-right font-mono">{debitTotal.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-mono">{creditTotal.toFixed(2)}</td>
                                <td className="px-3 py-2 text-center">
                                  {isBalanced ? (
                                    <span className="inline-flex items-center text-green-700">
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      平衡
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-red-700">
                                      <XCircle className="w-4 h-4 mr-1" />
                                      差额 {diff.toFixed(2)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false)
                setImportFile(null)
                setImportPreview([])
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importPreview.length === 0 || isImporting}
            >
              {isImporting ? '导入中...' : '确认导入'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 导入结果对话框 */}
      <Dialog open={showImportResultDialog} onOpenChange={(open) => {
        if (!open) {
          // 关闭对话框并清理状态
          setShowImportResultDialog(false)
          setImportResults([])
          setImportFile(null)
          setImportPreview([])
          setExpandedResults(new Set())
          // 导航到凭证列表页面并指定草稿状态，用户可以看到刚导入的草稿凭证
          router.push('/voucher-list?status=draft')
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Header with gradient background */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-white text-lg font-semibold p-0">
                  导入结果报告
                </DialogTitle>
                <p className="text-slate-400 text-sm mt-1">
                  查看每张凭证的导入状态和详细信息
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-white/10"
                onClick={() => setShowImportResultDialog(false)}
              >
                ✕
              </Button>
            </div>
          </div>

          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-3 gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">总凭证数</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{importResults.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">成功导入</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {importResults.filter(r => r.status === 'success').length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">导入失败</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {importResults.filter(r => r.status === 'failed').length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="space-y-3">
              {importResults.map((result, index) => {
                const isExpanded = expandedResults.has(result.voucherNo)
                const isSuccess = result.status === 'success'
                const isFailed = result.status === 'failed'
                const isWarning = result.status === 'warning'

                const StatusIcon = isSuccess ? CheckCircle : isFailed ? XCircle : AlertCircle
                const statusColor = isSuccess ? 'text-emerald-600' : isFailed ? 'text-red-600' : 'text-amber-600'
                const statusBg = isSuccess ? 'bg-emerald-100' : isFailed ? 'bg-red-100' : 'bg-amber-100'

                return (
                  <div
                    key={index}
                    className={`rounded-xl border-2 transition-all duration-200 ${
                      isSuccess ? 'bg-emerald-50 border-emerald-200' :
                      isFailed ? 'bg-red-50 border-red-200' :
                      'bg-amber-50 border-amber-200'
                    } ${isExpanded ? 'shadow-md' : 'shadow-sm hover:shadow-md'}`}
                  >
                    {/* Main Card - Always Visible */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Icon + Voucher Info */}
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSuccess ? 'bg-emerald-100' : isFailed ? 'bg-red-100' : 'bg-amber-100'
                          }`}>
                            <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-slate-900">
                                {result.voucherNo}
                              </span>
                              <Badge variant="secondary" className={
                                isSuccess ? 'bg-emerald-100 text-emerald-700' :
                                isFailed ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }>
                                {isSuccess ? '成功' : isFailed ? '失败' : '警告'}
                              </Badge>
                            </div>

                            <p className={`text-sm ${
                              isSuccess ? 'text-emerald-800' :
                              isFailed ? 'text-red-800' :
                              'text-amber-800'
                            } font-medium`}>
                              {result.message}
                            </p>

                            {result.voucher && (
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                                <span>{result.voucher.date}</span>
                                <span>•</span>
                                <span>{result.voucher.entries.length} 条分录</span>
                                {result.entries && (
                                  <>
                                    <span>•</span>
                                    <span>借方: {result.entries.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0).toFixed(2)}</span>
                                    <span>贷方: {result.entries.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0).toFixed(2)}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Expand Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={() => {
                            setExpandedResults(prev => {
                              const next = new Set(prev)
                              if (next.has(result.voucherNo)) {
                                next.delete(result.voucherNo)
                              } else {
                                next.add(result.voucherNo)
                              }
                              return next
                            })
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                          )}
                        </Button>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && result.entries && (
                        <div className="mt-4 pt-4 border-t border-slate-200/50">
                          <div className="text-xs font-semibold text-slate-700 mb-2">分录明细</div>
                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">摘要</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">科目代码</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">科目名称</th>
                                  <th className="px-3 py-2 text-right font-medium text-slate-600">借方</th>
                                  <th className="px-3 py-2 text-right font-medium text-slate-600">贷方</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">辅助核算</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.entries.map((entry: any, entryIdx: number) => (
                                  <tr key={entryIdx} className="border-t border-slate-100">
                                    <td className="px-3 py-2">{entry.summary || '-'}</td>
                                    <td className="px-3 py-2 font-mono">{entry.subjectCode || '-'}</td>
                                    <td className="px-3 py-2">{entry.subjectName || '-'}</td>
                                    <td className="px-3 py-2 text-right font-mono">
                                      {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">
                                      {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500">
                                      {[
                                        entry.deptCode && `部门:${entry.deptCode}`,
                                        entry.projectCode && `项目:${entry.projectCode}`,
                                        entry.customerName && `客户:${entry.customerName}`,
                                        entry.supplierName && `供应商:${entry.supplierName}`,
                                        entry.currencyCode && `币别:${entry.currencyCode}`,
                                        entry.cashFlowItem && `现金流:${entry.cashFlowItem}`
                                      ].filter(Boolean).join(' ') || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Validation Errors for Entries */}
                          {isFailed && result.voucher && result.voucher.entries.some((e: any) => {
                            return !e.subjectCode || e.subjectCode.trim() === '' || !/^\d{4}(\d{2})?$/.test(e.subjectCode)
                          }) && (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-800">
                                  <p className="font-semibold mb-1">数据验证警告</p>
                                  <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                                    {result.voucher.entries.filter((e: any) =>
                                      !e.subjectCode || e.subjectCode.trim() === '' || !/^\d{4}(\d{2})?$/.test(e.subjectCode)
                                    ).map((e: any, i: number) => (
                                      <li key={i}>
                                        分录 {i + 1}: 科目代码 "{e.subjectCode || '(空)'}" 格式错误
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {importResults.filter(r => r.status === 'failed').length > 0 && (
                <span className="flex items-center gap-1 text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  部分凭证导入失败，请检查数据后重试
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowImportResultDialog(false)}
              >
                关闭
              </Button>

              {importResults.filter(r => r.status === 'failed').length > 0 && (
                <Button
                  onClick={() => {
                    // 重试：只导入失败的凭证
                    const failedResults = importResults.filter(r => r.status === 'failed')
                    // 这里可以实现重试逻辑
                    showToast('info', "请修复Excel中的错误后重新上传文件")
                  }}
                >
                  重试失败项
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}