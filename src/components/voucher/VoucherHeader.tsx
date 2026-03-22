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
  Trash2,
  Upload,
  Download
} from 'lucide-react'
import { useVoucherStore } from '@/stores/useVoucherStore'
import { useVoucherTemplateStore } from '@/stores/useVoucherTemplateStore'
import { useToast } from '@/hooks/use-toast'
import { calculateVoucherStatus } from '@/lib/accounting'
import { getCurrentService } from '@/lib/database'

export function VoucherHeader() {
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

  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSaveAsTemplateDialog, setShowSaveAsTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

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

      // 解析Excel数据为凭证格式
      const vouchers = parseExcelToVouchers(jsonData)
      setImportPreview(vouchers)

      toast({
        title: "文件解析成功",
        description: `共解析到 ${vouchers.length} 张凭证`,
      })
    } catch (error) {
      toast({
        title: "文件解析失败",
        description: error instanceof Error ? error.message : "请检查文件格式",
        variant: "destructive"
      })
      setImportPreview([])
    } finally {
      setIsImporting(false)
    }
  }

  // 解析Excel数据为凭证
  const parseExcelToVouchers = (data: any[]): any[] => {
    const vouchers: any[] = []
    let currentVoucher: any = null
    let currentEntries: any[] = []
    let currentVoucherNo = ''
    let currentDate = ''
    let currentSummary = ''

    data.forEach((row: any, index: number) => {
      // 检查是否是凭证头部行（包含凭证号、日期、摘要）
      if (row['凭证号'] || row['凭证字号']) {
        // 保存上一个凭证
        if (currentVoucher && currentEntries.length > 0) {
          vouchers.push({
            ...currentVoucher,
            entries: currentEntries
          })
        }

        // 创建新凭证
        currentVoucherNo = row['凭证号'] || row['凭证字号'] || ''
        currentDate = row['日期'] || new Date().toISOString().split('T')[0]
        currentSummary = row['摘要'] || ''

        currentVoucher = {
          voucherNo: currentVoucherNo,
          date: currentDate,
          summary: currentSummary,
          status: 'draft',
          voucherType: 'general'
        }
        currentEntries = []
      }

      // 检查是否是分录行（包含科目代码或借贷金额）
      if (row['科目代码'] || row['科目'] || row['借方金额'] || row['贷方金额'] || row['借方'] || row['贷方']) {
        const debit = Number(row['借方金额'] || row['借方'] || 0) || 0
        const credit = Number(row['贷方金额'] || row['贷方'] || 0) || 0

        // 只有科目代码或金额不为0时才添加分录
        if (row['科目代码'] || row['科目'] || debit > 0 || credit > 0) {
          currentEntries.push({
            id: `entry_${Date.now()}_${currentEntries.length}`,
            summary: row['分录摘要'] || currentSummary || '',
            subjectCode: row['科目代码'] || row['科目'] || '',
            subjectName: row['科目名称'] || '',
            debit: debit,
            credit: credit,
            deptCode: row['部门代码'] || row['部门'] || '',
            projectCode: row['项目代码'] || row['项目'] || '',
            docNo: row['单据号'] || ''
          })
        }
      }
    })

    // 保存最后一个凭证
    if (currentVoucher && currentEntries.length > 0) {
      vouchers.push({
        ...currentVoucher,
        entries: currentEntries
      })
    }

    // 如果Excel格式是每行一张凭证的分录
    if (vouchers.length === 0 && data.length > 0) {
      // 尝试按行解析：每行是一个分录，相同凭证号的分录归为同一凭证
      const groupedVouchers = new Map<string, any>()

      data.forEach((row: any) => {
        const voucherNo = row['凭证号'] || row['凭证字号'] || '记-001'
        const date = row['日期'] || new Date().toISOString().split('T')[0]
        const summary = row['摘要'] || ''
        const debit = Number(row['借方金额'] || row['借方'] || 0) || 0
        const credit = Number(row['贷方金额'] || row['贷方'] || 0) || 0

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
        if (row['科目代码'] || row['科目'] || debit > 0 || credit > 0) {
          voucher.entries.push({
            id: `entry_${Date.now()}_${voucher.entries.length}`,
            summary: row['分录摘要'] || summary,
            subjectCode: row['科目代码'] || row['科目'] || '',
            subjectName: row['科目名称'] || '',
            debit,
            credit,
            deptCode: row['部门代码'] || row['部门'] || '',
            projectCode: row['项目代码'] || row['项目'] || '',
            docNo: row['单据号'] || ''
          })
        }
      })

      return Array.from(groupedVouchers.values()).filter(v => v.entries.length > 0)
    }

    return vouchers.filter(v => v.entries.length > 0)
  }

  // 确认导入
  const handleConfirmImport = async () => {
    if (importPreview.length === 0) {
      toast({
        title: "没有可导入的凭证",
        description: "请先上传Excel文件",
        variant: "destructive"
      })
      return
    }

    setIsImporting(true)
    let successCount = 0
    let errorCount = 0
    const savedVouchers: any[] = []

    try {
      for (const voucherData of importPreview) {
        try {
          // 检查借贷平衡
          const debitTotal = voucherData.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
          const creditTotal = voucherData.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)

          if (Math.abs(debitTotal - creditTotal) > 0.01) {
            console.warn(`凭证 ${voucherData.voucherNo} 借贷不平衡，跳过`)
            errorCount++
            continue
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
                project: entry.projectCode || ''
              }
            })),
            createdBy: 'import',
            createTime: now,
            updateTime: now
          }

          // 直接保存到数据库
          await getCurrentService().saveVoucher(newVoucher)
          savedVouchers.push(newVoucher)
          successCount++
        } catch (error) {
          console.error('导入凭证失败:', voucherData.voucherNo, error)
          errorCount++
        }
      }

      // 重新加载凭证列表
      await initialize()

      toast({
        title: "导入完成",
        description: `成功导入 ${successCount} 张凭证${errorCount > 0 ? `，失败 ${errorCount} 张` : ''}`,
      })

      setShowImportDialog(false)
      setImportPreview([])
      setImportFile(null)

      // 创建新凭证准备继续录入
      createVoucher()
    } catch (error) {
      toast({
        title: "导入失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
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
        '科目代码': '1002',
        '科目名称': '银行存款',
        '借方': 10000,
        '贷方': 0,
        '部门代码': '',
        '项目代码': '',
        '单据号': ''
      },
      {
        '凭证号': '记-202503-001',
        '日期': '2025-03-22',
        '摘要': '收到货款',
        '科目代码': '1122',
        '科目名称': '应收账款',
        '借方': 0,
        '贷方': 10000,
        '部门代码': '',
        '项目代码': '',
        '单据号': ''
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
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((voucher, idx) => {
                            const debitTotal = voucher.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
                            const creditTotal = voucher.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
                            return (
                              <tr key={idx} className="border-t">
                                <td className="px-3 py-2 font-mono">{voucher.voucherNo}</td>
                                <td className="px-3 py-2">{voucher.date}</td>
                                <td className="px-3 py-2">{voucher.summary}</td>
                                <td className="px-3 py-2 text-center">{voucher.entries.length}</td>
                                <td className="px-3 py-2 text-right font-mono">{debitTotal.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-mono">{creditTotal.toFixed(2)}</td>
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
    </div>
  )
}