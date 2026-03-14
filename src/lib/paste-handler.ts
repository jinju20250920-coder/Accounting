/**
 * Smart Paste Handler for Excel Data
 * Handles clipboard data from Excel/CSV and maps to voucher entries
 */

export interface PastedData {
  headers: string[]
  rows: string[][]
  isValid: boolean
  errors?: string[]
}

export interface ParsedEntry {
  row: number
  subject?: string
  subjectName?: string
  summary?: string
  debit?: number
  credit?: number
  auxiliary?: {
    department?: string
    project?: string
  }
}

// Common Excel headers mapping
const HEADER_MAPPINGS: Record<string, string[]> = {
  '科目': ['subject', '科目代码', '科目'],
  '科目名称': ['subjectName', '科目名称', '客户名称'],
  '摘要': ['summary', '摘要', '备注', '说明'],
  '借方': ['debit', '借方', '借', 'Dr', 'DR'],
  '贷方': ['credit', '贷方', '贷', 'Cr', 'CR'],
  '部门': ['department', '部门', '部门代码'],
  '项目': ['project', '项目', '项目代码']
}

/**
 * Detect if clipboard data is Excel/CSV format
 */
export function isExcelData(clipboardData: DataTransfer | string): boolean {
  if (typeof clipboardData === 'string') {
    // Check if it looks like tab-separated data
    const lines = clipboardData.split('\n')
    if (lines.length < 2) return false

    // Check for tab or comma separation
    const firstLine = lines[0]
    return firstLine.includes('\t') || firstLine.includes(',') || firstLine.includes(',')
  }

  // Check for HTML format (Excel often copies as HTML)
  if (clipboardData.types.includes('text/html')) {
    return true
  }

  return false
}

/**
 * Parse clipboard data into structured format
 */
export function parseClipboardData(clipboardData: DataTransfer | string): PastedData {
  let text = ''

  if (typeof clipboardData === 'string') {
    text = clipboardData
  } else {
    text = clipboardData.getData('text/plain') || clipboardData.getData('text/html') || ''
  }

  // Clean up text
  text = text.trim()
  if (!text) {
    return {
      headers: [],
      rows: [],
      isValid: false,
      errors: ['没有检测到数据']
    }
  }

  // Split into lines
  const lines = text.split('\n').filter(line => line.trim())

  // 支持单单元格复制（只有一个单元格的数据）
  if (lines.length === 1) {
    // 检测是否是单单元格数据（没有分隔符）
    const firstLine = lines[0]
    if (!firstLine.includes('\t') && !firstLine.includes(',') && !firstLine.includes('，')) {
      return {
        headers: ['数据'], // 假设有一个通用的标题
        rows: [lines], // 将单一单元格数据包装成数组
        isValid: true,
        errors: []
      }
    }
  }

  if (lines.length < 2) {
    return {
      headers: [],
      rows: [],
      isValid: false,
      errors: ['数据不足：至少需要标题行和一行数据']
    }
  }

  // Detect delimiter
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : ','

  // Parse headers
  const headers = firstLine.split(delimiter).map(h => h.trim())

  // Find mapped column indices
  const columnMapping: Record<string, number> = {}

  headers.forEach((header, index) => {
    // Try to match header
    for (const [key, variants] of Object.entries(HEADER_MAPPINGS)) {
      if (variants.some(variant => header.includes(variant) || variant.includes(header))) {
        columnMapping[key] = index
        break
      }
    }
  })

  // Parse rows
  const rows: string[][] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(cell => cell.trim())

    if (row.length !== headers.length) {
      errors.push(`第 ${i + 1} 行：列数不匹配`)
      continue
    }

    rows.push(row)
  }

  return {
    headers,
    rows,
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Map parsed data to voucher entries
 */
export function mapToVoucherEntries(pastedData: PastedData): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  const { headers, rows } = pastedData

  // Find column indices
  const subjectIndex = headers.findIndex(h =>
    ['subject', '科目代码', '科目'].some(k => h.includes(k))
  )
  const subjectNameIndex = headers.findIndex(h =>
    ['subjectName', '科目名称', '客户名称'].some(k => h.includes(k))
  )
  const summaryIndex = headers.findIndex(h =>
    ['summary', '摘要', '备注', '说明'].some(k => h.includes(k))
  )
  const debitIndex = headers.findIndex(h =>
    ['debit', '借方', '借', 'Dr', 'DR'].some(k => h.includes(k))
  )
  const creditIndex = headers.findIndex(h =>
    ['credit', '贷方', '贷', 'Cr', 'CR'].some(k => h.includes(k))
  )
  const departmentIndex = headers.findIndex(h =>
    ['department', '部门', '部门代码'].some(k => h.includes(k))
  )
  const projectIndex = headers.findIndex(h =>
    ['project', '项目', '项目代码'].some(k => h.includes(k))
  )

  // Process each row
  rows.forEach((row, rowIndex) => {
    const entry: ParsedEntry = { row: rowIndex + 2 } // +2 for header and 1-based

    // Extract subject
    if (subjectIndex !== -1 && row[subjectIndex]) {
      entry.subject = row[subjectIndex]
    }
    if (subjectNameIndex !== -1 && row[subjectNameIndex]) {
      entry.subjectName = row[subjectNameIndex]
    }

    // Extract summary
    if (summaryIndex !== -1 && row[summaryIndex]) {
      entry.summary = row[summaryIndex]
    }

    // Extract amounts
    if (debitIndex !== -1 && row[debitIndex]) {
      const debitValue = parseFloat(row[debitIndex].replace(/[¥,\s]/g, ''))
      if (!isNaN(debitValue)) {
        entry.debit = debitValue
      }
    }

    if (creditIndex !== -1 && row[creditIndex]) {
      const creditValue = parseFloat(row[creditIndex].replace(/[¥,\s]/g, ''))
      if (!isNaN(creditValue)) {
        entry.credit = creditValue
      }
    }

    // Extract auxiliary data
    if (departmentIndex !== -1 && row[departmentIndex]) {
      entry.auxiliary = {
        department: row[departmentIndex],
        ...(projectIndex !== -1 && { project: row[projectIndex] })
      }
    }

    entries.push(entry)
  })

  return entries
}

/**
 * Validate parsed entries
 */
export function validatePastedEntries(entries: ParsedEntry[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  entries.forEach((entry, index) => {
    // Check if both debit and credit are empty
    if (!entry.debit && !entry.credit) {
      errors.push(`第 ${entry.row} 行：缺少金额（借方或贷方）`)
    }

    // Check for negative amounts
    if (entry.debit && entry.debit < 0) {
      errors.push(`第 ${entry.row} 行：借方金额不能为负数`)
    }
    if (entry.credit && entry.credit < 0) {
      errors.push(`第 ${entry.row} 行：贷方金额不能为负数`)
    }

    // Check both debit and credit (should not happen in Excel)
    if (entry.debit && entry.credit) {
      errors.push(`第 ${entry.row} 行：不能同时填写借方和贷方`)
    }

    // Check for empty subject
    if (!entry.subject && !entry.subjectName) {
      errors.push(`第 ${entry.row} 行：缺少科目信息`)
    }
  })

  // Check balance
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    errors.push(`借贷不平衡：借方合计 ¥${totalDebit.toFixed(2)}，贷方合计 ¥${totalCredit.toFixed(2)}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Enhanced paste handler with smart detection and suggestions
 */
export class SmartPasteHandler {
  /**
   * Handle paste event and return voucher entries
   */
  async handlePaste(clipboardData: DataTransfer | string): Promise<{
    entries: ParsedEntry[]
    errors: string[]
    suggestions: string[]
  }> {
    const entries: ParsedEntry[] = []
    const errors: string[] = []
    const suggestions: string[] = []

    // Parse clipboard data
    const pastedData = parseClipboardData(clipboardData)
    if (!pastedData.isValid) {
      return {
        entries,
        errors: pastedData.errors || [],
        suggestions
      }
    }

    // Map to voucher entries
    entries.push(...mapToVoucherEntries(pastedData))

    // Validate
    const validation = validatePastedEntries(entries)
    if (!validation.valid) {
      errors.push(...validation.errors)
    }

    // Generate suggestions
    if (errors.length > 0) {
      suggestions.push('请检查数据格式：')
      suggestions.push('- 确保金额格式正确（不含货币符号）')
      suggestions.push('- 每行只能填写借方或贷方，不能同时填写')
      suggestions.push('- 确保科目信息完整')
    }

    return {
      entries,
      errors,
      suggestions
    }
  }

  /**
   * Get paste format example
   */
  getFormatExample(): string {
    return `
      科目代码,科目名称,摘要,借方,贷方
      1001,库存现金,现金销售,1000.00,
      6001,主营业务收入,现金销售,,1000.00
    `.trim()
  }

  /**
   * Check if data matches expected format
   */
  isWellFormated(pastedData: PastedData): boolean {
    // Basic format check
    const hasAmount = pastedData.headers.some(h =>
      ['借方', '贷方', 'Dr', 'Cr'].some(k => h.includes(k))
    )
    const hasSubject = pastedData.headers.some(h =>
      ['科目', '科目代码'].some(k => h.includes(k))
    )

    return hasAmount && hasSubject && pastedData.rows.length > 0
  }
}

// Export singleton instance
export const smartPasteHandler = new SmartPasteHandler()