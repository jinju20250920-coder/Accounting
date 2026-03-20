'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useUserPreferenceStore } from '@/stores/useUserPreferenceStore';
import { useDepartmentStore } from '@/stores/useDepartmentStore';
import { useFinancialProjectStore } from '@/stores/useFinancialProjectStore';
import { useToast } from '@/hooks/use-toast';
import { useDatabaseSync } from '@/hooks/useDatabaseSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectOption } from '@/components/ui/select';
import { SubjectSearch } from './subject-search';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColumnSettings } from './ColumnSettings';
import { SmartSubjectSelector, AmountInputWithPreview } from './smart-subject-selector';
import { ClearingManager } from './clearing-manager';
import { SummaryPicker } from './summary-picker';
import { useAccountStore } from '@/stores/useAccountStore';
import { useSummaryStore } from '@/stores';
import { TemplateSelector } from './TemplateSelector';
import { useVoucherTemplateStore } from '@/stores';

interface ColumnItem {
  id: string;
  label: string;
  visible: boolean;
}
import { Plus, Trash2, Calculator, FileText, Save, Send, RotateCcw, CheckCircle, XCircle, Settings, Building, Building2, User, X, ChevronDown, Database, FileSpreadsheet } from 'lucide-react';
import { smartPasteHandler } from '@/lib/paste-handler';
import { validateSubjectExists } from '@/lib/accounting';
import { ColumnSort } from './ColumnSort';
import { DatabaseManager } from '@/components/DatabaseManager';
import { useSubjectStore } from '@/stores';
// TODO: 安装 pinyin-pro 包实现拼音简码支持
// import { pinyin } from 'pinyin-pro';

interface VoucherEntry {
  id: string;
  voucherId: string;
  date: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  deptCode?: string;
  projectCode?: string;
  debit: number;
  credit: number;
  auxiliary?: {
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  };
  docNo?: string;
  recRefNo?: string;
}

// 从@/types导入统一的Partner类型
import { Partner } from '@/types';

// 模拟往来单位数据（与 settings/auxiliary 页面保持一致）
const MOCK_PARTNERS: Partner[] = [
  { id: 'p1', code: 'ABC001', name: '上海科技有限公司', isCustomer: true, isSupplier: false, isEmployee: false, frozen: false, createdAt: '2024-01-01' },
  { id: 'p2', code: 'XYZ001', name: '北京商贸有限公司', isCustomer: true, isSupplier: true, isEmployee: false, frozen: false, createdAt: '2024-02-01' },
  { id: 'p3', code: 'SUP001', name: '广州电子科技有限公司', isCustomer: false, isSupplier: true, isEmployee: false, frozen: false, createdAt: '2024-01-15' },
];

// 显示行数
const DISPLAY_ROWS = 5;
// 行高（2倍原来的28px）
const ROW_HEIGHT = '56px';

export function VoucherEntryGrid() {
  // 初始化数据库同步
  useDatabaseSync();
  const { initializeSubjects, subjects } = useSubjectStore();
  const { addRecentSummary } = useSummaryStore();

  // 初始化科目数据
  useEffect(() => {
    if (subjects.length === 0) {
      initializeSubjects();
    }
  }, []);
  const {
    currentEntries,
    voucherDate,
    voucherNo,
    isBalanced,
    totalDebit,
    totalCredit,
    addEntry,
    updateEntry,
    removeEntry,
    updateVoucherDate,
    saveVoucher,
    clearVoucher,
    pasteEntries,
    addToLedger,
    createVoucher,
    getLedgerEntries,
    ledgerEntries
  } = useVoucherStore();

  // 直接使用 store 中的 currentEntries，避免双重状态管理导致的同步问题
  const entries = currentEntries;

  const { getSmartMatch } = useUserPreferenceStore();
  const { toast } = useToast();
  const { departments, searchDepartments } = useDepartmentStore();
  const { projects, searchProjects } = useFinancialProjectStore();
  const { getBalance } = useAccountStore();

  // 焦点单元格跟踪
  const [focusedCell, setFocusedCell] = useState<{ entryId: string; field: string } | null>(null);

  // 每行选中科目元数据跟踪
  const [selectedSubjectMetadata, setSelectedSubjectMetadata] = useState<Record<string, any>>({});

  // 部门、项目输入框 refs
  const deptInputRefs = useRef<Record<string, any>>({});
  const projectInputRefs = useRef<Record<string, any>>({});

  // 模板选择器状态
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // 处理模板选择
  const handleTemplateSelected = (templateId: string, loadAmounts: boolean) => {
    const template = useVoucherTemplateStore.getState().getTemplate(templateId);
    if (template) {
      useVoucherStore.getState().loadTemplate(template, loadAmounts);
      toast({
        title: "模板加载成功",
        description: loadAmounts ? "已完全加载模板（含金额）" : "已加载模板（不含金额）"
      });
    }
  };


  // 辅助函数：更新 entry 的嵌套 auxiliary 字段
  const updateAuxiliaryField = (entryId: string, field: 'customer' | 'supplier', value: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      updateEntry(entryId, 'auxiliary', {
        ...(entry.auxiliary || {}),
        [field]: value
      });
    }
  };

  // 科目搜索下拉显示状态
  const [showSubjectDropdown, setShowSubjectDropdown] = useState<Record<string, boolean>>({});
  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);

  // 科目输入框 ref，用于定位下拉框
  const subjectInputRefs = useRef<Record<string, HTMLInputElement>>({});

  // 计算差额
  const balanceDifference = Math.abs(totalDebit - totalCredit);

  // 准备部门选项
  const departmentOptions: SelectOption[] = departments.map(d => ({
    value: d.code,
    label: d.name,
    code: d.code
  }));

  // 准备项目选项
  const projectOptions: SelectOption[] = projects.map(p => ({
    value: p.code,
    label: p.name,
    code: p.code
  }));

  // 准备往来单位选项（包含所有往来单位）
  const partnerOptions: SelectOption[] = MOCK_PARTNERS.map(p => ({
    value: p.code,
    label: `${p.name} (${p.isCustomer && p.isSupplier ? '客户/供应商' : p.isCustomer ? '客户' : '供应商'})`,
    code: p.code
  }));

  // 准备客户选项（保持兼容性）
  const customerOptions: SelectOption[] = MOCK_PARTNERS.filter(p => p.isCustomer).map(p => ({
    value: p.code,
    label: p.name,
    code: p.code
  }));

  // 准备供应商选项（保持兼容性）
  const supplierOptions: SelectOption[] = MOCK_PARTNERS.filter(p => p.isSupplier).map(p => ({
    value: p.code,
    label: p.name,
    code: p.code
  }));

  // 列可见性状态
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    // 在客户端初始化时尝试从 localStorage 读取
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voucher-column-settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // 确保序列号列可见
          parsed.serial = true;
          // 检查是否所有关键列都被隐藏了
          const hasVisibleColumns = Object.values(parsed).some(visible => visible);
          if (hasVisibleColumns) {
            // 迁移旧的设置，添加新的会计科目列
            if (parsed.subjectCode || parsed.subjectName) {
              parsed.subject = true;
            }
            // 添加新列默认可见性
            if (parsed.recRefNo === undefined) {
              parsed.recRefNo = true;
            }
            return parsed;
          }
        } catch (error) {
          console.error('Failed to parse column settings:', error);
        }
      }
    }
    // 默认显示所有列
    return {
      serial: true,
      summary: true,
      subject: true,
      docNo: true,
      recRefNo: true,
      debit: true,
      credit: true,
      deptCode: true,
      projectCode: true,
      customerSupplier: true,
      operation: true
    };
  });

  // 列顺序状态
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voucher-column-order');
      if (saved) {
        try {
          const order = JSON.parse(saved);
          // 迁移旧的列顺序
          if (order.includes('subjectCode') || order.includes('subjectName')) {
            const newOrder: string[] = [];
            for (const col of order) {
              if (col === 'subjectCode') {
                newOrder.push('subject');
              } else if (col === 'subjectName') {
                // 跳过，已经添加过了
              } else {
                newOrder.push(col);
              }
            }
            // 添加新列到合适的位置
            if (!newOrder.includes('recRefNo')) {
              const docNoIndex = newOrder.indexOf('docNo');
              if (docNoIndex !== -1) {
                newOrder.splice(docNoIndex + 1, 0, 'recRefNo');
              }
            }
            return newOrder;
          }
          // 添加新列到已有设置
          if (!order.includes('recRefNo')) {
            const newOrder = [...order];
            const docNoIndex = newOrder.indexOf('docNo');
            if (docNoIndex !== -1) {
              newOrder.splice(docNoIndex + 1, 0, 'recRefNo');
            } else {
              newOrder.push('recRefNo');
            }
            return newOrder;
          }
          return order;
        } catch (error) {
          console.error('Failed to parse column order:', error);
        }
      }
      return [
        'serial', 'summary', 'subject', 'docNo', 'recRefNo',
        'debit', 'credit', 'deptCode', 'projectCode',
        'customerSupplier', 'operation'
      ];
    }
    return [
      'serial', 'summary', 'subject', 'docNo', 'recRefNo',
      'debit', 'credit', 'deptCode', 'projectCode',
      'customerSupplier', 'operation'
    ];
  });

  // 列信息
  const columnInfo = [
    { id: 'serial', label: '序列号' },
    { id: 'summary', label: '摘要' },
    { id: 'subject', label: '会计科目' },
    { id: 'docNo', label: '业务单据号' },
    { id: 'recRefNo', label: '核销单号' },
    { id: 'debit', label: '借方' },
    { id: 'credit', label: '贷方' },
    { id: 'deptCode', label: '部门' },
    { id: 'projectCode', label: '项目' },
    { id: 'customerSupplier', label: '往来' },
    { id: 'operation', label: '操作' }
  ];

  // 切换列可见性
  const toggleColumnVisibility = (columnId: string) => {
    const newVisibility = { ...columnVisibility, [columnId]: !columnVisibility[columnId] };
    setColumnVisibility(newVisibility);
    // Only save to localStorage on client side
    if (typeof window !== 'undefined') {
      localStorage.setItem('voucher-column-settings', JSON.stringify(newVisibility));
    }
  };

  // 重新排序列
  const reorderColumns = (newOrder: ColumnItem[]) => {
    const orderIds = newOrder.map(item => item.id);
    setColumnOrder(orderIds);
    if (typeof window !== 'undefined') {
      localStorage.setItem('voucher-column-order', JSON.stringify(orderIds));
    }
  };

  // 计算可见列的数量和位置，用于合计行的 colSpan
  const calculateTotalRowStructure = () => {
    const visibleColumns = [];
    let summarySpan = 0;
    let totalFieldsSpan = 0;
    let balanceColsBefore = 0;

    // 计算摘要列的连续可见情况
    if (columnVisibility.summary) summarySpan++;
    if (columnVisibility.subject) summarySpan++;
    if (columnVisibility.docNo) summarySpan++;

    // 计算借贷列之间有多少个可见字段
    if (columnVisibility.debit) totalFieldsSpan++;
    if (columnVisibility.credit) totalFieldsSpan++;

    // 计算借贷列之前的部门、项目列
    if (columnVisibility.deptCode) balanceColsBefore++;
    if (columnVisibility.projectCode) balanceColsBefore++;

    return {
      summarySpan,
      totalFieldsSpan,
      balanceColsBefore,
      hasCustomerSupplier: columnVisibility.customerSupplier,
      hasOperation: columnVisibility.operation
    };
  };

  // 处理日期变更
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateVoucherDate(e.target.value);
  };

  // 处理摘要变更 - 触发AI匹配 + 摘要继承
  const handleSummaryChange = (entryId: string, summary: string, index: number) => {
    updateEntry(entryId, 'summary', summary);

    // 如果摘要不为空，尝试智能匹配
    if (summary.trim()) {
      const match = getSmartMatch(summary, subjects);
      if (match && !entries.find(e => e.id === entryId)?.subjectCode) {
        updateEntry(entryId, 'subjectCode', match.subject);
        updateEntry(entryId, 'subjectName', match.subjectName);
      }
    }
  };

  const handleSummarySelect = (entryId: string, text: string, index: number) => {
    handleSummaryChange(entryId, text, index);
    addRecentSummary(text.trim());
  };

  const handleSummaryTextChange = (entryId: string, text: string, index: number) => {
    handleSummaryChange(entryId, text, index);
    // 移除实时保存逻辑，只在回车或失焦时保存
  };

  // 处理摘要输入框的失焦事件，保存到最近使用
  const handleSummaryBlur = (entryId: string, text: string) => {
    if (text.trim()) {
      addRecentSummary(text.trim());
    }
  };

  // 处理科目编码输入 - 支持手动输入和自动匹配
  const handleSubjectCodeChange = (entryId: string, code: string) => {
    updateEntry(entryId, 'subjectCode', code);

    // 查找当前分录的索引
    const entryIndex = entries.findIndex(e => e.id === entryId);

    // 如果是新行（或当前行摘要为空），且上一行有摘要，自动复制上一行的摘要
    if (entryIndex > 0 && code.trim()) {
      const currentEntry = entries[entryIndex];
      const prevEntry = entries[entryIndex - 1];

      if (currentEntry && !currentEntry.summary && prevEntry && prevEntry.summary) {
        updateEntry(entryId, 'summary', prevEntry.summary);
      }
    }

    // 尝试从科目数据中匹配科目名称
    if (code.trim()) {
      const matchedSubject = subjects.find(s => s.code === code.trim());
      if (matchedSubject) {
        updateEntry(entryId, 'subjectName', matchedSubject.name);
      }
    }
  };

  // 处理科目编码输入框的键盘事件
  const handleSubjectCodeKeyDown = (
    entryId: string,
    code: string,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // 按下回车键时进行科目验证
    if (e.key === 'Enter') {
      // 验证科目是否存在
      const validation = validateSubjectExists(code, subjects);
      if (!validation.valid && validation.message) {
        toast({
          title: "科目验证失败",
          description: validation.message,
          type: "error"
        });
      }
    }
  };

  // 处理科目选择
  const handleSubjectSelect = (entryId: string, subject: { code: string; name: string }) => {
    updateEntry(entryId, 'subjectCode', subject.code);
    updateEntry(entryId, 'subjectName', subject.name);
    setShowSubjectDropdown(prev => ({ ...prev, [entryId]: false }));
  };

  // 处理金额输入 - 借方输入后贷方再输入，则借方清空，反之亦然
  const handleAmountChange = (
    entryId: string,
    field: 'debit' | 'credit',
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;

    // 如果输入了金额，则清空另一方的金额
    if (numValue > 0) {
      const otherField = field === 'debit' ? 'credit' : 'debit';
      updateEntry(entryId, otherField, 0);
    }

    updateEntry(entryId, field, numValue);
  };

  // 处理键盘事件 - 支持 = 键自动平衡
  const handleAmountKeyDown = (
    entryId: string,
    field: 'debit' | 'credit',
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    const inputValue = (e.target as HTMLInputElement).value;
    const numValue = parseFloat(inputValue) || 0;

    // 按 = 键自动平衡 - 优化版本
    if (e.key === '=') {
      e.preventDefault();
      // 计算当前输入框的金额变化后的差额
      const currentAmount = entries.find(ent => ent.id === entryId)?.[field] || 0;
      const newAmount = parseFloat(inputValue) || 0;
      const difference = totalDebit - totalCredit + (field === 'debit' ? (newAmount - currentAmount) : (currentAmount - newAmount));

      // 将差额填入当前字段
      if (Math.abs(difference) > 0.001) {
        updateEntry(entryId, field, Math.abs(difference));
      }
    }
  };

  // 处理键盘事件 - 支持方向键导航、Tab 和 Enter 自动新增行
  const handleKeyDown = (
    entryId: string,
    field: string,
    index: number,
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const isLastRow = index === entries.length - 1;
    const fields = ['summary', 'subject', 'docNo', 'recRefNo', 'debit', 'credit', 'deptCode', 'projectCode', 'customerSupplier'];
    const currentIndex = fields.indexOf(field);
    const isLastField = currentIndex === fields.length - 1;
    const isSummaryField = field === 'summary';
    const entryIndex = entries.findIndex(e => e.id === entryId);

    // 方向键导航
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (currentIndex < fields.length - 1) {
        const nextField = fields[currentIndex + 1];
        const nextInput = document.querySelector(`[data-entry-id="${entryId}"][data-field="${nextField}"]`) as HTMLElement;
        if (nextInput) {
          nextInput.focus();
          if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
            (nextInput as any).select();
          }
        }
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentIndex > 0) {
        const prevField = fields[currentIndex - 1];
        const prevInput = document.querySelector(`[data-entry-id="${entryId}"][data-field="${prevField}"]`) as HTMLElement;
        if (prevInput) {
          prevInput.focus();
          if ('select' in prevInput && typeof (prevInput as any).select === 'function') {
            (prevInput as any).select();
          }
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (entryIndex < entries.length - 1) {
        const nextEntry = entries[entryIndex + 1];
        const nextInput = document.querySelector(`[data-entry-id="${nextEntry.id}"][data-field="${field}"]`) as HTMLElement;
        if (nextInput) {
          nextInput.focus();
          if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
            (nextInput as any).select();
          }
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (entryIndex > 0) {
        const prevEntry = entries[entryIndex - 1];
        const prevInput = document.querySelector(`[data-entry-id="${prevEntry.id}"][data-field="${field}"]`) as HTMLElement;
        if (prevInput) {
          prevInput.focus();
          if ('select' in prevInput && typeof (prevInput as any).select === 'function') {
            (prevInput as any).select();
          }
        }
      }
      return;
    }

    // Tab 键导航
    if (e.key === 'Tab') {
      e.preventDefault();

      if (isLastRow && isLastField) {
        // 最后一行最后一个字段按 Tab，新增一行
        addVoucherRow();
      } else if (currentIndex < fields.length - 1) {
        // 跳到下一个字段
        const nextField = fields[currentIndex + 1];
        const nextInput = document.querySelector(`[data-entry-id="${entryId}"][data-field="${nextField}"]`) as HTMLElement;
        if (nextInput) {
          nextInput.focus();
          if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
            (nextInput as any).select();
          }
        }
      }
    } else if (e.key === 'Enter' && !e.shiftKey && !isSummaryField) {
      e.preventDefault();

      if (isLastRow) {
        // 最后一行按 Enter，新增一行
        addVoucherRow();
      }
    }
  };

  // 新增行并继承上一行的摘要
  const addEntryWithInheritance = (currentIndex: number) => {
    const lastEntry = entries[currentIndex];
    const lastSummary = lastEntry?.summary || '';

    // 使用 useState 来跟踪是否需要聚焦到新行
    const currentEntriesLength = entries.length;

    addEntry();

    // 等待 DOM 更新后聚焦到新行的摘要输入框
    setTimeout(() => {
      // 重新获取 entries，确保使用最新的状态
      // 注意：这里我们需要直接从 store 获取最新的 entries
      const newEntries = useVoucherStore.getState().currentEntries;
      const newEntryId = newEntries[currentEntriesLength]?.id;
      if (newEntryId) {
        // 如果上一行有摘要，新行继承摘要
        if (lastSummary) {
          updateEntry(newEntryId, 'summary', lastSummary);
        }

        const newInput = document.querySelector(`[data-entry-id="${newEntryId}"][data-field="summary"]`) as HTMLInputElement | HTMLTextAreaElement;
        newInput?.focus();
        newInput?.select?.();
      }
    }, 50);
  };

  // 新增行（不继承，用于点击按钮）
  const addVoucherRow = () => {
    const currentIndex = entries.length - 1;
    addEntryWithInheritance(currentIndex);
  };

  // 处理粘贴事件
  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();

    try {
      const clipboardData = e.clipboardData;
      const text = clipboardData.getData('text/plain').trim();

      // 检测是否是单个单元格粘贴（没有换行且没有分隔符）
      if (!text.includes('\n') && !text.includes('\t') && !text.includes(',') && !text.includes('，')) {
        // 找到当前聚焦的输入框
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          // 如果是输入框，直接粘贴文本
          activeElement.value = text;
          // 触发 onChange 事件
          const event = new Event('input', { bubbles: true });
          activeElement.dispatchEvent(event);
          return;
        }
      }

      // 对于多行数据，使用智能粘贴处理器
      const result = await smartPasteHandler.handlePaste(clipboardData);

      if (result.errors.length > 0) {
        toast({
          title: "粘贴失败",
          description: result.errors.join('\n')
        });
        return;
      }

      if (result.entries.length > 0) {
        pasteEntries(result.entries);
        toast({
          title: "粘贴成功",
          description: `已添加 ${result.entries.length} 条分录`
        });
      }
    } catch (error) {
      toast({
        title: "粘贴失败",
        description: error instanceof Error ? error.message : "未知错误"
      });
    }
  };

  // 保存凭证
  const handleSave = () => {
    try {
      saveVoucher('draft', subjects);
      toast({
        title: "操作成功",
        description: "凭证保存成功"
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "未知错误"
      });
    }
  };

  // 清空凭证
  const handleClear = () => {
    clearVoucher();
    toast({
      title: "操作成功",
      description: "凭证已清空"
    });
  };

  // 入账操作
  const handlePostToLedger = async () => {
    try {
      // 传入 useSubjectStore 的科目数据，确保验证时使用统一数据源
      await saveVoucher('posted', subjects);
      toast({
        title: "操作成功",
        description: "凭证已成功入账，正在创建新凭证..."
      });

      // 延迟一下让用户看到成功提示，然后自动创建新凭证
      setTimeout(() => {
        clearVoucher();
        createVoucher();
        toast({
          title: "新凭证已创建",
          description: "可以继续录入下一张凭证"
        });
      }, 800);
    } catch (error) {
      toast({
        title: "入账失败",
        description: error instanceof Error ? error.message : "未知错误",
        type: "error"
      });
    }
  };

  // 处理焦点变化
  const handleFocus = (entryId: string, field: string) => {
    setFocusedCell({ entryId, field });

    // 当聚焦到新行的摘要栏时，如果为空且上一行有摘要，自动复制
    if (field === 'summary') {
      const entryIndex = entries.findIndex(e => e.id === entryId);
      if (entryIndex > 0) {
        const currentEntry = entries[entryIndex];
        const prevEntry = entries[entryIndex - 1];

        if (!currentEntry.summary && prevEntry.summary) {
          updateEntry(entryId, 'summary', prevEntry.summary);
        }
      }
    }
  };

  const handleBlur = () => {
    setFocusedCell(null);
  };

  // 确保至少有一列是可见的
  useEffect(() => {
    const hasVisibleColumns = Object.values(columnVisibility).some(visible => visible);
    if (!hasVisibleColumns) {
      const defaultVisibility = {
        serial: true,
        summary: true,
        subject: true,
        docNo: true,
        recRefNo: true,
        debit: true,
        credit: true,
        deptCode: true,
        projectCode: true,
        customerSupplier: true,
        operation: true
      };
      setColumnVisibility(defaultVisibility);
      if (typeof window !== 'undefined') {
        localStorage.setItem('voucher-column-settings', JSON.stringify(defaultVisibility));
      }
    }
  }, [columnVisibility]);

  // 确保有足够的显示行
  const displayEntries = [...entries];
  while (displayEntries.length < DISPLAY_ROWS) {
    displayEntries.push({
      id: `empty-${displayEntries.length}`,
      voucherId: '',
      date: '',
      summary: '',
      subjectCode: '',
      subjectName: '',
      debit: 0,
      credit: 0
    } as VoucherEntry);
  }

  return (
    <div className="space-y-4">
      {/* 分录表格 */}
      <Card className="border-0 shadow-none">
        <CardHeader className="bg-white border-b border-slate-200 rounded-none">
          <div className="flex justify-between items-center">
            <CardTitle>分录明细</CardTitle>
            <div className="flex gap-2 items-center">
              {/* 平衡状态显示 */}
              <Badge variant={isBalanced ? "default" : "destructive"} className="text-sm">
                {isBalanced ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    平衡
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 mr-1" />
                    不平衡 (差 ¥{balanceDifference.toFixed(2)}) ⚠️
                  </>
                )}
              </Badge>

              {/* 列设置按钮 */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const popover = document.getElementById('column-settings-popover');
                    if (popover) {
                      popover.classList.toggle('hidden');
                    }
                  }}
                >
                  <Settings className="w-4 h-4" />
                  列设置
                </Button>

                {/* 列设置弹出面板 */}
                <div
                  id="column-settings-popover"
                  className="absolute right-0 z-50 w-96 bg-white border border-slate-200 rounded-md shadow-lg mt-1 hidden max-h-[600px] overflow-hidden"
                >
                  <div className="p-4 border-b">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-base">列显示设置</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const popover = document.getElementById('column-settings-popover');
                          if (popover) {
                            popover.classList.add('hidden');
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* 快捷操作 */}
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // 显示所有列
                          const showAll = columnInfo.reduce((acc, col) => {
                            acc[col.id] = true;
                            return acc;
                          }, {} as Record<string, boolean>);
                          setColumnVisibility(showAll);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('voucher-column-settings', JSON.stringify(showAll));
                          }
                        }}
                      >
                        显示全部
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // 隐藏所有列
                          const hideAll = columnInfo.reduce((acc, col) => {
                            acc[col.id] = col.id === 'serial'; // 序列号列保持可见
                            return acc;
                          }, {} as Record<string, boolean>);
                          setColumnVisibility(hideAll);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('voucher-column-settings', JSON.stringify(hideAll));
                          }
                        }}
                      >
                        隐藏全部
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 overflow-y-auto max-h-[400px]">
                    {/* Tab 切换 */}
                    <div className="flex mb-4 border-b">
                      <button
                        className={`px-4 py-2 text-sm font-medium ${
                          true ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                        }`}
                        onClick={() => {/* 显示顺序 tab */}}
                      >
                        列顺序
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium ${
                          false ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                        }`}
                        onClick={() => {/* 显示设置 tab */}}
                      >
                        列设置
                      </button>
                    </div>

                    {/* 列顺序设置 */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <ChevronDown className="w-4 h-4" />
                        拖拽调整列顺序
                      </h4>
                      <ColumnSort
                        columns={columnInfo.map(col => ({
                          id: col.id,
                          label: col.label,
                          visible: columnVisibility[col.id]
                        }))}
                        onReorder={reorderColumns}
                        onToggleVisibility={toggleColumnVisibility}
                      />
                    </div>

                    {/* 列设置 - 显示/隐藏 */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">列显示设置</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {columnInfo.map((column) => (
                          <label
                            key={column.id}
                            className={`flex items-center gap-2 p-2 ${column.id === 'serial' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 rounded cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={columnVisibility[column.id]}
                              onChange={() => column.id !== 'serial' && toggleColumnVisibility(column.id)}
                              disabled={column.id === 'serial'}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{column.label}</span>
                            {column.id === 'serial' && <span className="text-xs text-slate-400">(固定显示)</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 底部操作 */}
                  <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // 重置所有设置
                        const resetVisibility = {
                          serial: true,
                          summary: true,
                          subject: true,
                          docNo: true,
                          recRefNo: true,
                          debit: true,
                          credit: true,
                          deptCode: true,
                          projectCode: true,
                          customerSupplier: true,
                          operation: true
                        };
                        setColumnVisibility(resetVisibility);
                        setColumnOrder([
                          'serial', 'summary', 'subject', 'docNo', 'recRefNo',
                          'debit', 'credit', 'deptCode', 'projectCode',
                          'customerSupplier', 'operation'
                        ]);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('voucher-column-settings', JSON.stringify(resetVisibility));
                          localStorage.setItem('voucher-column-order', JSON.stringify([
                            'serial', 'summary', 'subject', 'docNo', 'recRefNo',
                            'debit', 'credit', 'deptCode', 'projectCode',
                            'customerSupplier', 'operation'
                          ]));
                        }
                      }}
                    >
                      重置全部
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const popover = document.getElementById('column-settings-popover');
                        if (popover) {
                          popover.classList.add('hidden');
                        }
                      }}
                    >
                      确认
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => addVoucherRow()}
              >
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse voucher-table" onPaste={handlePaste} style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  {columnOrder.map(colId => {
                    const col = columnInfo.find(c => c.id === colId);
                    if (!col || !columnVisibility[colId]) return null;
                    return (
                      <th
                        key={colId}
                        className={`text-${colId === 'serial' ? 'center' : colId === 'debit' || colId === 'credit' ? 'right' : colId === 'operation' ? 'center' : 'left'} p-1 text-sm font-medium border-r border-slate-300 last:border-r-0 whitespace-nowrap`}
                        style={{ width: colId === 'serial' ? '60px' : colId === 'summary' ? '200px' : colId === 'subject' ? '250px' : colId === 'debit' || colId === 'credit' ? '120px' : colId === 'operation' ? '80px' : '120px' }}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayEntries.slice(0, DISPLAY_ROWS).map((entry, index) => {
                  const isRealEntry = !entry.id.startsWith('empty-');
                  const isFocused = isRealEntry && focusedCell?.entryId === entry.id;
                  const isLastRow = index === displayEntries.length - 1;

                  // 渲染单个单元格的函数
                  const renderCell = (colId: string) => {
                    if (!columnVisibility[colId]) return null;

                    const isCellFocused = isFocused && focusedCell?.field === colId;

                    // 如果是空行且不是操作列，只显示空单元格
                    if (!isRealEntry && colId !== 'serial' && colId !== 'operation') {
                      return (
                        <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0, height: ROW_HEIGHT }}>
                        </td>
                      );
                    }

                    switch (colId) {
                      case 'serial':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0 text-center text-sm font-medium bg-slate-50" style={{ padding: 0, height: ROW_HEIGHT, width: '60px' }}>
                            {isRealEntry ? index + 1 : ''}
                          </td>
                        );
                      case 'summary':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <SummaryPicker
                              value={entry.summary}
                              onSelect={(text) => handleSummarySelect(entry.id, text, index)}
                            >
                              <Textarea
                                variant="excel"
                                data-entry-id={entry.id}
                                data-field="summary"
                                value={entry.summary}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  handleSummaryTextChange(entry.id, text, index);
                                }}
                                onFocus={() => {
                                  handleFocus(entry.id, 'summary');
                                }}
                                onBlur={(e) => {
                                  handleSummaryBlur(entry.id, entry.summary);
                                  handleBlur();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    // 按下回车键时保存摘要
                                    if (entry.summary.trim()) {
                                      addRecentSummary(entry.summary.trim());
                                    }
                                  }
                                  handleKeyDown(entry.id, 'summary', index, e);
                                }}
                                placeholder=""
                                className={`w-full ${
                                  isCellFocused
                                    ? 'border-2 border-blue-500 z-10 relative'
                                    : ''
                                }`}
                                style={{ minHeight: ROW_HEIGHT, borderRadius: 0, lineHeight: '1.4', paddingTop: '14px', paddingBottom: '14px' }}
                                rows={2}
                                autoComplete="off"
                              />
                            </SummaryPicker>
                          </td>
                        );
                      case 'subject':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <div className="relative" style={{ height: ROW_HEIGHT }}>
                              <SmartSubjectSelector
                                value={entry.subjectCode}
                                subjectName={entry.subjectName}
                                onSelect={(code, name, subject) => {
                                  updateEntry(entry.id, 'subjectCode', code);
                                  updateEntry(entry.id, 'subjectName', name);
                                  if (subject) {
                                    // 保存科目元数据
                                    setSelectedSubjectMetadata(prev => ({
                                      ...prev,
                                      [entry.id]: {
                                        enableDept: subject.enableDept,
                                        enableProject: subject.enableProject,
                                        enableForeign: subject.enableForeign
                                      }
                                    }));

                                    // 如果科目启用了部门核算，自动聚焦到部门输入框
                                    if (subject.enableDept) {
                                      setTimeout(() => {
                                        const deptInput = document.querySelector(`[data-entry-id="${entry.id}"][data-field="deptCode"]`) as HTMLElement;
                                        if (deptInput) {
                                          deptInput.focus();
                                          // 只有 input 元素有 select() 方法，select 组件没有
                                          if ('tagName' in deptInput && (deptInput as HTMLElement).tagName === 'INPUT') {
                                            (deptInput as HTMLInputElement).select();
                                          }
                                        }
                                      }, 100);
                                    }
                                  }
                                }}
                                placeholder=""
                                balance={getBalance(entry.subjectCode)}
                                variant="excel"
                                data-field="subject"
                                data-entry-id={entry.id}
                                onKeyDown={(e) => handleKeyDown(entry.id, 'subject', index, e)}
                              />
                            </div>
                          </td>
                        );
                      case 'docNo':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <Input
                              variant="excel"
                              data-field="docNo"
                              data-entry-id={entry.id}
                              value={entry.docNo || ''}
                              onChange={(e) => updateEntry(entry.id, 'docNo', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(entry.id, 'docNo', index, e)}
                              onFocus={() => handleFocus(entry.id, 'docNo')}
                              onBlur={handleBlur}
                              placeholder="银行流水/发票号"
                              autoComplete="off"
                              className={isCellFocused ? 'border-2 border-blue-500 z-10 relative' : ''}
                              style={{ height: ROW_HEIGHT, borderRadius: 0 }}
                            />
                          </td>
                        );
                      case 'recRefNo':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <ClearingManager
                              entryId={entry.id}
                              recRefNo={entry.recRefNo || ''}
                              partnerName={entry.customerName || entry.supplierName || ''}
                              amount={entry.debit > 0 ? entry.debit : entry.credit}
                            />
                          </td>
                        );
                      case 'debit':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <AmountInputWithPreview
                              value={entry.debit || ''}
                              data-field="debit"
                              data-entry-id={entry.id}
                              onChange={(value) => handleAmountChange(entry.id, 'debit', value)}
                              onKeyDown={(e) => {
                                // 先处理金额键，再处理导航键
                                if (e.key === '=') {
                                  handleAmountKeyDown(entry.id, 'debit', e);
                                } else {
                                  handleKeyDown(entry.id, 'debit', index, e);
                                }
                              }}
                              onFocus={() => handleFocus(entry.id, 'debit')}
                              onBlur={handleBlur}
                              variant="excel"
                              className={isCellFocused ? 'border-2 border-blue-500 z-10 relative' : ''}
                            />
                          </td>
                        );
                      case 'credit':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <AmountInputWithPreview
                              value={entry.credit || ''}
                              data-field="credit"
                              data-entry-id={entry.id}
                              onChange={(value) => handleAmountChange(entry.id, 'credit', value)}
                              onKeyDown={(e) => {
                                // 先处理金额键，再处理导航键
                                if (e.key === '=') {
                                  handleAmountKeyDown(entry.id, 'credit', e);
                                } else {
                                  handleKeyDown(entry.id, 'credit', index, e);
                                }
                              }}
                              onFocus={() => handleFocus(entry.id, 'credit')}
                              onBlur={handleBlur}
                              variant="excel"
                              className={isCellFocused ? 'border-2 border-blue-500 z-10 relative' : ''}
                            />
                          </td>
                        );
                      case 'deptCode':
                        const subjectMetadataDept = selectedSubjectMetadata[entry.id];
                        const isDeptDisabled = !subjectMetadataDept?.enableDept;
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <Select
                              variant="excel"
                              data-entry-id={entry.id}
                              data-field="deptCode"
                              options={departmentOptions}
                              placeholder={isDeptDisabled ? '部门' : '选择部门'}
                              value={entry.deptCode || null}
                              onChange={(value) => updateEntry(entry.id, 'deptCode', value)}
                              onKeyDown={(e) => handleKeyDown(entry.id, 'deptCode', index, e)}
                              disabled={isDeptDisabled}
                              className={`w-full ${
                                isCellFocused
                                  ? 'border-2 border-blue-500 z-10 relative'
                                  : ''
                              }`}
                              style={{ height: ROW_HEIGHT }}
                              showCode={false}
                            />
                          </td>
                        );
                      case 'projectCode':
                        const subjectMetadataProject = selectedSubjectMetadata[entry.id];
                        const isProjectDisabled = !subjectMetadataProject?.enableProject;
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <Select
                              variant="excel"
                              data-entry-id={entry.id}
                              data-field="projectCode"
                              options={projectOptions}
                              placeholder={isProjectDisabled ? '项目' : '选择项目'}
                              value={entry.projectCode || null}
                              onChange={(value) => updateEntry(entry.id, 'projectCode', value)}
                              onKeyDown={(e) => handleKeyDown(entry.id, 'projectCode', index, e)}
                              disabled={isProjectDisabled}
                              className={`w-full ${
                                isCellFocused
                                  ? 'border-2 border-blue-500 z-10 relative'
                                  : ''
                              }`}
                              style={{ height: ROW_HEIGHT }}
                              showCode={false}
                            />
                          </td>
                        );
                      case 'customerSupplier':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
                            <Select
                              variant="excel"
                              data-entry-id={entry.id}
                              data-field="partnerCode"
                              options={partnerOptions}
                              placeholder="选择往来"
                              value={entry.auxiliary?.customer || entry.auxiliary?.supplier || null}
                              onChange={(value) => {
                                // 同时更新客户和供应商字段（保持兼容性）
                                updateAuxiliaryField(entry.id, 'customer', value);
                                updateAuxiliaryField(entry.id, 'supplier', value);
                              }}
                              onKeyDown={(e) => handleKeyDown(entry.id, 'customerSupplier', index, e)}
                              className="w-full"
                              style={{ height: ROW_HEIGHT }}
                              showCode={false}
                            />
                          </td>
                        );
                      case 'operation':
                        return (
                          <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0 text-center" style={{ padding: 0, height: ROW_HEIGHT }}>
                            {isRealEntry ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEntry(entry.id)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0 rounded-none"
                                style={{ height: 'calc(100% - 4px)' }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </td>
                        );
                      default:
                        return null;
                    }
                  };

                  return (
                    <tr
                      key={entry.id}
                      data-row-index={index}
                      className={`border-b border-slate-300 transition-colors ${
                        isFocused ? 'bg-blue-50' : 'hover:bg-slate-50'
                      } ${isLastRow ? '' : ''}`}
                      style={{ height: ROW_HEIGHT }}
                    >
                      {columnOrder.map(renderCell)}
                    </tr>
                  );
                })}

                {/* 合计行 - 浅色背景区分 */}
                <tr className="bg-slate-100 font-medium border-t-2 border-slate-300">
                  {columnOrder.map(colId => {
                    if (!columnVisibility[colId]) return null;

                    switch (colId) {
                      case 'serial':
                        return (
                          <td key={colId} className="p-1 border-r border-slate-300 last:border-r-0 bg-slate-100" style={{ height: ROW_HEIGHT }}>
                          </td>
                        );
                      case 'summary':
                      case 'subject':
                        // 摘要等文字列 - 只在第一列显示 "合计"
                        if (colId === 'summary') {
                          const visibleTextColumns = [
                            columnVisibility.summary,
                            columnVisibility.subject
                          ].filter(Boolean).length;
                          return (
                            <td key={colId} colSpan={visibleTextColumns} className="p-1 text-left border-r border-slate-300 last:border-r-0" style={{ height: ROW_HEIGHT }}>
                              合计
                            </td>
                          );
                        }
                        // 其他文字列不显示内容（已被合并）
                        return null;
                      case 'debit':
                        return (
                          <td key={colId} className="p-1 text-right font-mono border-r border-slate-300 last:border-r-0" style={{ height: ROW_HEIGHT }}>
                            {totalDebit.toFixed(2)}
                          </td>
                        );
                      case 'credit':
                        return (
                          <td key={colId} className="p-1 text-right font-mono border-r border-slate-300 last:border-r-0" style={{ height: ROW_HEIGHT }}>
                            {totalCredit.toFixed(2)}
                          </td>
                        );
                      case 'deptCode':
                      case 'projectCode':
                      case 'customerSupplier':
                        return <td key={colId} className="p-1 border-r border-slate-300 last:border-r-0" style={{ height: ROW_HEIGHT }}></td>;
                      case 'operation':
                        // 状态信息显示在操作列
                        const hasCustomerSupplier = columnVisibility.customerSupplier;
                        return (
                          <td
                            key={colId}
                            colSpan={hasCustomerSupplier ? 1 : 1}
                            className="p-1 text-center text-slate-500 border-r border-slate-300 last:border-r-0 text-xs"
                            style={{ height: ROW_HEIGHT }}
                          >
                            {isBalanced ? '✓ 平衡' : `✗ 差额: ¥${balanceDifference.toFixed(2)}`}
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClear}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                清空
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowTemplateDialog(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                导入模板
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!isBalanced}
              >
                <Send className="w-4 h-4 mr-2" />
                提交审核
              </Button>
              <Button
                onClick={handlePostToLedger}
                disabled={!isBalanced}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                入账
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 模板选择器对话框 */}
      <TemplateSelector
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSelectTemplate={handleTemplateSelected}
      />

    </div>
  );
}
