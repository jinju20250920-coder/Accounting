'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useBankAccountStore } from '@/stores';
import { useSubjectStore } from '@/stores';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import { getBankList, getAllConfigs, BANK_BRANDS } from '@/lib/bank-parsers/bank-registry';
import { sqliteService } from '@/lib/database/sqlite-service';
import { waitForDbInit } from '@/hooks/useDatabaseSync';
import { FieldMappingCoach } from '@/components/field-mapping-coach';
import { BankFormatTestDialog } from '@/components/bank-format-test-dialog';
import type { BankAccountBinding, BankParserConfig, CustomBankConfig } from '@/lib/bank-parsers/types';
import { detectBank, getBestDetection } from '@/lib/bank-parsers/detector';
import {
  Plus, Trash2, Edit2, Building2, Search, X, Landmark, CheckCircle2,
  Upload, Download, FileSpreadsheet, FlaskConical, ChevronDown, ChevronRight,
  ArrowRight, Check,
} from 'lucide-react';

const FIELD_LABELS: Record<string, string> = {
  date: '日期', time: '时间', debit: '借方', credit: '贷方',
  balance: '余额', counterpartyName: '对方户名', counterpartyAccount: '对方账号',
  summary: '摘要', notes: '备注', transactionSerialNo: '流水号',
  voucherNo: '凭证号', voucherType: '凭证类型',
};

interface FormData {
  bankId: string;
  bankName: string;
  accountNumber: string;
  aliasName: string;
}

const emptyForm: FormData = { bankId: '', bankName: '', accountNumber: '', aliasName: '' };

type WizardStep = 'info' | 'format' | null;

export default function BankAccountsPage() {
  const { showToast } = useToast();
  const { bindings, loading, loadBindings, addBinding, updateBinding, deleteBinding } = useBankAccountStore();
  const { subjects, addSubject, deleteSubject } = useSubjectStore();
  const bankList = getBankList();
  const builtInConfigs = getAllConfigs();

  // Form & wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null);
  const [customBankName, setCustomBankName] = useState('');

  // Format config state
  const [customConfigs, setCustomConfigs] = useState<CustomBankConfig[]>([]);
  const [showCoach, setShowCoach] = useState(false);
  const [coachFile, setCoachFile] = useState<File | null>(null);
  const [editingConfig, setEditingConfig] = useState<BankParserConfig | undefined>(undefined);
  const [editingRecordId, setEditingRecordId] = useState<string | undefined>(undefined);
  const formatFileRef = useRef<HTMLInputElement>(null);

  // Test dialog
  const [testConfig, setTestConfig] = useState<BankParserConfig | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  } | null>(null);

  // Import state
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ bankId: string; bankName: string; accountNumber: string; aliasName: string; _status: 'ok' | 'dup' | 'error' }>>([]);

  useEffect(() => { loadBindings(); loadCustomConfigs(); }, [loadBindings]);

  const loadCustomConfigs = async () => {
    try {
      await waitForDbInit();
      const configs = await sqliteService.getCustomBankConfigs();
      setCustomConfigs(configs);
    } catch { /* ignore */ }
  };

  // Filter bindings
  const filteredBindings = bindings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.bankName.toLowerCase().includes(q) || b.accountNumber.includes(q)
      || b.subSubjectCode.includes(q) || (b.aliasName && b.aliasName.toLowerCase().includes(q));
  });

  const matchBankName = (raw: string) => {
    const s = raw.trim();
    if (!s) return null;
    const exact = bankList.find(b => b.name === s || b.id === s);
    if (exact) return exact;
    const fuzzy = bankList.find(b => s.includes(b.name) || b.name.includes(s) || s.includes(BANK_BRANDS[b.id]?.short || ''));
    return fuzzy || null;
  };

  const generateNextSubjectCode = (): string => {
    const bankSubjects = subjects.filter(s => s.code.startsWith('1002') && s.code.length > 4);
    if (bankSubjects.length === 0) return '100201';
    let maxSuffix = 0;
    for (const s of bankSubjects) { const suffix = parseInt(s.code.slice(4), 10); if (suffix > maxSuffix) maxSuffix = suffix; }
    return '1002' + String(maxSuffix + 1).padStart(2, '0');
  };

  // Get config for a bankId (built-in or custom)
  const getConfigForBank = (bankId: string): BankParserConfig | undefined => {
    return builtInConfigs.find(c => c.id === bankId) || customConfigs.find(c => c.config.id === bankId)?.config;
  };

  // === Wizard flow ===

  const startAddFromCard = (bankId: string) => {
    const bank = bankList.find(b => b.id === bankId);
    setEditingId(null);
    setFormData({ ...emptyForm, bankId, bankName: bank?.name || '' });
    setWizardStep('info');
  };

  const startAddManual = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setWizardStep('info');
  };

  const startEdit = (binding: BankAccountBinding) => {
    setEditingId(binding.id);
    setFormData({ bankId: binding.bankId, bankName: binding.bankName, accountNumber: binding.accountNumber, aliasName: binding.aliasName || '' });
    setCustomBankName(binding.bankName || '');
    setWizardStep('info');
  };

  const cancelWizard = () => {
    setWizardStep(null);
    setEditingId(null);
    setFormData(emptyForm);
    setCustomBankName('');
  };

  // Step 'info' → Step 'format' (or direct save for built-in banks)
  const handleInfoNext = () => {
    if (formData.bankId === '__new__') {
      // New bank: require custom name
      if (!customBankName.trim()) { showToast('error', '请输入银行名称'); return; }
    } else if (!formData.bankId) {
      showToast('error', '请选择银行'); return;
    }

    if (!formData.accountNumber.trim()) { showToast('error', '请输入银行账号'); return; }

    if (editingId) {
      handleSaveAccount();
      return;
    }

    // Check duplicate
    if (bindings.some(b => b.accountNumber === formData.accountNumber.trim())) {
      showToast('error', '该银行账号已存在');
      return;
    }

    const isNewBank = formData.bankId === '__new__';
    const isBuiltIn = !isNewBank && builtInConfigs.some(c => c.id === formData.bankId);

    if (isBuiltIn) {
      handleSaveAccount();
    } else {
      // New bank or non-built-in: go to format config step
      setWizardStep('format');
    }
  };

  const handleSaveAccount = async () => {
    const isNewBank = formData.bankId === '__new__';
    const bankId = isNewBank ? `custom_bank_${Date.now()}` : formData.bankId;
    const bankName = isNewBank ? customBankName.trim() : formData.bankName;
    if (!bankName) { showToast('error', '银行名称缺失'); return; }

    const last4 = formData.accountNumber.slice(-4);
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    if (editingId) {
      const existing = bindings.find(b => b.id === editingId);
      if (!existing) return;
      const subjectName = `银行存款 - ${bankName} (${last4})`;
      await updateBinding(editingId, {
        bankId, bankName,
        accountNumber: formData.accountNumber.trim(),
        aliasName: formData.aliasName.trim() || undefined,
        subSubjectName: subjectName,
      });
      if (existing.subSubjectCode) {
        const subject = subjects.find(s => s.code === existing.subSubjectCode);
        if (subject) {
          const { useSubjectStore: getSubjectStore } = await import('@/stores');
          getSubjectStore.getState().updateSubject(subject.id, { name: subjectName });
        }
      }
      showToast('success', '银行账户更新成功');
    } else {
      const subjectCode = generateNextSubjectCode();
      const subjectName = `银行存款 - ${bankName} (${last4})`;
      const parent1002 = subjects.find(s => s.code === '1002');

      try {
        await addSubject({
          code: subjectCode, name: subjectName, parentId: parent1002?.id || null,
          direction: 'debit', enableDept: false, enableProject: false, enableForeign: false,
          isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false,
          subjectType: 'Asset', accountSetId: currentAccountSet?.id,
          bankAccountNumber: formData.accountNumber.trim(),
        } as any);
      } catch { showToast('error', '创建科目失败'); return; }

      await addBinding({
        accountSetId: currentAccountSet?.id || '',
        accountNumber: formData.accountNumber.trim(),
        bankId, bankName,
        aliasName: formData.aliasName.trim() || undefined,
        subSubjectCode: subjectCode, subSubjectName: subjectName,
        currency: 'CNY', isDefault: bindings.length === 0,
      });
      showToast('success', '银行账户添加成功');
    }
    cancelWizard();
  };

  // Format step: upload file → auto-detect → FieldMappingCoach
  const handleFormatFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoachFile(f);

    // Try to auto-detect the bank format from file content
    let detectedConfig: BankParserConfig | undefined;
    try {
      const allConfigs = [...builtInConfigs, ...customConfigs.map(c => c.config)];
      const results = await detectBank(f, allConfigs);
      const best = getBestDetection(results);
      if (best) {
        detectedConfig = best.config;
        showToast('info', `已自动识别: ${best.config.name}，可在向导中调整映射`);
      }
    } catch {
      // Detection failed, user will configure manually
    }

    setEditingConfig(detectedConfig);
    setEditingRecordId(undefined);
    setShowCoach(true);
    e.target.value = '';
  };

  const handleCoachDone = () => {
    setShowCoach(false);
    setCoachFile(null);
    loadCustomConfigs();
    if (editingId) {
      // Editing existing account: just close, format was saved independently
      showToast('success', '格式配置已保存');
      cancelWizard();
    } else {
      // New account: save the account binding after format is configured
      handleSaveAccount();
    }
  };

  const handleDelete = (binding: BankAccountBinding) => {
    setConfirmDialog({
      open: true, title: '确认删除',
      description: `确定要删除 ${binding.bankName} (${binding.accountNumber}) 吗？关联的科目 ${binding.subSubjectCode} 也将被删除。`,
      onConfirm: async () => {
        const subject = subjects.find(s => s.code === binding.subSubjectCode);
        if (subject) await deleteSubject(subject.id);
        await deleteBinding(binding.id);
        showToast('success', '已删除');
        setConfirmDialog(null);
      },
    });
  };

  // === Import ===
  const handleDownloadTemplate = () => {
    const rows = [['银行名称', '银行账号', '别名（可选）'], ['建设银行', '6227001234567890123', '基本户'], ['工商银行', '6222021234567890456', '']];
    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '银行账户导入模板.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('success', '模板已下载');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const data: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      if (data.length < 2) { showToast('error', '文件为空'); setImporting(false); return; }
      const parsed = data.slice(1).filter(row => row.some((c: any) => String(c || '').trim())).map((row) => {
        const bank = matchBankName(String(row[0] || '').trim());
        const accountNumber = String(row[1] || '').trim();
        if (!bank) return { bankId: '', bankName: String(row[0] || '').trim(), accountNumber, aliasName: String(row[2] || '').trim(), _status: 'error' as const };
        if (!accountNumber) return { bankId: bank.id, bankName: bank.name, accountNumber: '', aliasName: String(row[2] || '').trim(), _status: 'error' as const };
        return { bankId: bank.id, bankName: bank.name, accountNumber, aliasName: String(row[2] || '').trim(), _status: bindings.some(b => b.accountNumber === accountNumber) ? 'dup' as const : 'ok' as const };
      });
      if (parsed.length === 0) { showToast('error', '无有效数据'); setImporting(false); return; }
      setImportRows(parsed);
      setShowImportPreview(true);
    } catch (e) { showToast('error', `读取失败: ${(e as Error).message}`); }
    finally { setImporting(false); if (importFileRef.current) importFileRef.current.value = ''; }
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => r._status === 'ok');
    if (validRows.length === 0) return;
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();
    const parent1002 = subjects.find(s => s.code === '1002');
    let successCount = 0, errorCount = 0;
    for (const row of validRows) {
      try {
        const code = generateNextSubjectCode();
        const name = `银行存款 - ${row.bankName} (${row.accountNumber.slice(-4)})`;
        await addSubject({ code, name, parentId: parent1002?.id || null, direction: 'debit', enableDept: false, enableProject: false, enableForeign: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false, subjectType: 'Asset', accountSetId: currentAccountSet?.id, bankAccountNumber: row.accountNumber } as any);
        await addBinding({ accountSetId: currentAccountSet?.id || '', accountNumber: row.accountNumber, bankId: row.bankId, bankName: row.bankName, aliasName: row.aliasName || undefined, subSubjectCode: code, subSubjectName: name, currency: 'CNY', isDefault: bindings.length + successCount === 0 });
        successCount++;
      } catch { errorCount++; }
    }
    setShowImportPreview(false); setImportRows([]);
    showToast('success', `导入完成：成功 ${successCount} 条${errorCount > 0 ? `，失败 ${errorCount} 条` : ''}`);
  };

  // === Render ===
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">银行账户管理</h1>
        <p className="text-slate-500 mt-1 text-sm">管理银行账户与会计科目绑定，配置流水解析格式</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-5 pb-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">已绑定账户</p><p className="text-2xl font-bold text-slate-900">{bindings.length}</p></div><Building2 className="h-7 w-7 text-slate-300" /></div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">支持银行</p><p className="text-2xl font-bold text-blue-600">{bankList.length}</p></div><Building2 className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">自定义格式</p><p className="text-2xl font-bold text-purple-600">{customConfigs.length}</p></div><FileSpreadsheet className="h-7 w-7 text-purple-400" /></div></CardContent></Card>
      </div>

      {/* Supported Banks Grid — with expand + test */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-blue-500" />
              支持的银行（{bankList.length} 家）
            </CardTitle>
            <p className="text-xs text-slate-400">点击添加账户，展开查看格式详情</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {bankList.map((bank) => {
              const brand = BANK_BRANDS[bank.id];
              const bound = bindings.some(b => b.bankId === bank.id);
              const isExpanded = expandedBankId === bank.id;
              const config = builtInConfigs.find(c => c.id === bank.id);
              return (
                <div key={bank.id}>
                  <button
                    onClick={() => startAddFromCard(bank.id)}
                    className={`relative w-full flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${
                      bound ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                  >
                    {bound && <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-green-500" />}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: brand?.color || '#64748b' }}>
                      {brand?.short || bank.name.slice(0, 2)}
                    </div>
                    <span className="text-xs text-slate-700 font-medium leading-tight text-center">{bank.name}</span>
                    {/* Expand toggle */}
                    <span
                      className="text-[10px] text-blue-400 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); setExpandedBankId(isExpanded ? null : bank.id); }}
                    >
                      {isExpanded ? '收起' : '格式详情'}
                    </span>
                  </button>
                  {isExpanded && config && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg border text-xs space-y-2">
                      <div className="flex items-center gap-3 text-slate-600">
                        <span>表头行: {config.headerRows}</span>
                        <span>日期: {config.dateFormat}</span>
                        <span>字段: {Object.keys(config.columnMapping || {}).length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(config.columnMapping || {}).map(([field, kws]) =>
                          kws && kws.length > 0 && <Badge key={field} variant="secondary" className="text-[10px] py-0">{FIELD_LABELS[field] || field}: {kws[0]}</Badge>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-1 h-6 text-xs" onClick={() => setTestConfig(config)}>
                        <FlaskConical className="h-3 w-3 mr-1" /> 测试解析
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <Card className="mb-6">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="搜索银行名称、账号或别名..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>
            <Button onClick={startAddManual}><Plus className="h-4 w-4 mr-2" />新增账户</Button>
            <Button variant="outline" onClick={() => importFileRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" />{importing ? '读取中...' : 'Excel导入'}
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}><Download className="h-4 w-4 mr-2" />下载模板</Button>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </div>
        </CardContent>
      </Card>

      {/* === Wizard: Step 1 — Account Info === */}
      {wizardStep === 'info' && (
        <Card className="mb-6 border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editingId ? '编辑银行账户' : '新增银行账户'}</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelWizard}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bank brand header when selected */}
            {formData.bankId && formData.bankId !== '__new__' && !editingId && (() => {
              const brand = BANK_BRANDS[formData.bankId];
              const isBuiltIn = builtInConfigs.some(c => c.id === formData.bankId);
              return (
                <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-lg border">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: brand?.color || '#64748b' }}>
                    {brand?.short || formData.bankName?.slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{formData.bankName}</p>
                    <p className="text-xs text-slate-400">
                      {isBuiltIn ? '内置格式，无需配置解析规则' : '需上传样例文件配置解析格式'}
                    </p>
                  </div>
                  {isBuiltIn && <Badge className="bg-green-50 text-green-700 text-xs">已内置</Badge>}
                </div>
              );
            })()}
            {/* New bank header */}
            {formData.bankId === '__new__' && !editingId && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500 text-white font-bold text-xs shrink-0">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">新增银行</p>
                  <p className="text-xs text-purple-400">将需要上传样例文件配置解析格式</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">银行名称 <span className="text-red-500">*</span></Label>
                {editingId ? (
                  <Input value={formData.bankName || customBankName || formData.bankId} disabled />
                ) : (
                  <>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={formData.bankId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const bank = bankList.find(b => b.id === id);
                        setFormData(prev => ({ ...prev, bankId: id, bankName: bank?.name || '' }));
                        setCustomBankName('');
                      }}
                    >
                      <option value="">选择银行</option>
                      <option value="__new__">+ 新增银行...</option>
                      {bankList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {formData.bankId === '__new__' && (
                      <Input
                        placeholder="输入银行名称，如：北京银行"
                        value={customBankName}
                        onChange={(e) => setCustomBankName(e.target.value)}
                        className="mt-1.5"
                        autoFocus
                      />
                    )}
                  </>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">银行账号 <span className="text-red-500">*</span></Label>
                <Input placeholder="输入银行账号" value={formData.accountNumber} onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">别名</Label>
                <Input placeholder="可选，如：基本户" value={formData.aliasName} onChange={(e) => setFormData(prev => ({ ...prev, aliasName: e.target.value }))} />
              </div>
            </div>

            {/* Format config status (edit mode) */}
            {editingId && (() => {
              const cfg = getConfigForBank(formData.bankId);
              const isBuiltIn = builtInConfigs.some(c => c.id === formData.bankId);
              return (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">解析格式：</span>
                      {cfg ? (
                        <Badge className={`${isBuiltIn ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'} text-xs`}>
                          {isBuiltIn ? '内置' : '自定义'} · {cfg.dateFormat} · {Object.keys(cfg.columnMapping || {}).length} 个字段
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-600 text-xs">未配置</Badge>
                      )}
                    </div>
                    {!isBuiltIn && (
                      <Button variant="outline" size="sm" onClick={() => setWizardStep('format')}>
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {cfg ? '重新配置' : '配置格式'}
                      </Button>
                    )}
                  </div>
                  {!cfg && !isBuiltIn && (
                    <p className="text-xs text-slate-400 mt-2">此银行尚未配置解析格式，导入流水时将无法自动解析。建议上传样例文件进行配置。</p>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-blue-100">
              <Button variant="outline" size="sm" onClick={cancelWizard}>取消</Button>
              <Button size="sm" onClick={handleInfoNext}>
                {editingId ? '保存修改' : (
                  <>
                    {builtInConfigs.some(c => c.id === formData.bankId) ? '确认添加' : '下一步：配置格式'}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Wizard: Step 2 — Format Config === */}
      {wizardStep === 'format' && (
        <Card className="mb-6 border-purple-200 bg-purple-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-purple-500" />
                配置解析格式
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelWizard}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              上传一份该银行的流水样例文件，系统将引导您配置解析格式。
              {!editingId && '配置完成后将自动保存账户。'}
            </p>
            <div className="flex items-center gap-3">
              <input ref={formatFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFormatFileSelected} />
              <Button onClick={() => formatFileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />上传样例文件
              </Button>
              <span className="text-xs text-slate-400">支持 .xlsx / .xls / .csv</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-purple-100">
              <Button variant="outline" size="sm" onClick={() => setWizardStep('info')}>
                返回上一步
              </Button>
              {editingId ? (
                <Button variant="outline" size="sm" onClick={cancelWizard}>
                  跳过，返回列表
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleSaveAccount}>
                  跳过，直接添加账户
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bindings Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">银行账户列表</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-400"><Building2 className="h-10 w-10 mx-auto mb-3 animate-pulse" /><p className="text-sm">加载中...</p></div>
          ) : filteredBindings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">{searchQuery ? '没有找到匹配的银行账户' : '暂无银行账户，点击上方银行卡片快速添加'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">银行名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">账号</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">科目代码</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">解析格式</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBindings.map((binding) => {
                    const cfg = getConfigForBank(binding.bankId);
                    return (
                      <tr key={binding.id} className="hover:bg-slate-50 border-b">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: BANK_BRANDS[binding.bankId]?.color || '#64748b' }}>
                              {BANK_BRANDS[binding.bankId]?.short?.slice(0, 1) || '?'}
                            </div>
                            <span className="font-medium text-sm">{binding.bankName}</span>
                            {binding.isDefault && <Badge className="bg-green-50 text-green-700 text-xs">默认</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="font-mono text-sm text-slate-700">{binding.accountNumber}</span></td>
                        <td className="px-4 py-3">
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-mono">
                            {binding.subSubjectCode}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {cfg ? (
                            <Badge className="bg-green-50 text-green-700 text-xs">{builtInConfigs.some(c => c.id === binding.bankId) ? '内置' : '自定义'} · {cfg.dateFormat}</Badge>
                          ) : (
                            <Badge className="bg-slate-50 text-slate-500 text-xs">未配置</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-center">
                            {cfg && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTestConfig(cfg)} title="测试解析">
                                <FlaskConical className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(binding)} title="编辑"><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(binding)} title="删除"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Format Configs section — show if any exist */}
      {customConfigs.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">自定义格式配置</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {customConfigs.map(cfg => (
              <div key={cfg.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{cfg.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(cfg.config.columnMapping || {}).map(([f, kws]) =>
                      kws && kws.length > 0 && <Badge key={f} variant="secondary" className="text-[10px] py-0">{FIELD_LABELS[f] || f}: {kws[0]}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTestConfig(cfg.config)} title="测试">
                    <FlaskConical className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => {
                    setConfirmDialog({
                      open: true, title: '删除格式配置',
                      description: `确定要删除「${cfg.name}」的解析格式配置吗？`,
                      onConfirm: async () => {
                        await sqliteService.deleteCustomBankConfig(cfg.id);
                        loadCustomConfigs();
                        showToast('success', '格式已删除');
                        setConfirmDialog(null);
                      },
                    });
                  }} title="删除格式"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* FieldMappingCoach */}
      <FieldMappingCoach
        open={showCoach}
        onClose={handleCoachDone}
        file={coachFile}
        initialConfig={editingConfig}
        editingRecordId={editingRecordId}
        onConfigCreated={() => {}}
      />

      {/* Test Dialog */}
      {testConfig && (
        <BankFormatTestDialog open={!!testConfig} onOpenChange={(v) => { if (!v) setTestConfig(null); }} config={testConfig} />
      )}

      {/* Import Preview Dialog */}
      {showImportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-green-500" />导入预览</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowImportPreview(false); setImportRows([]); }}><X className="h-4 w-4" /></Button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                共 {importRows.length} 条，
                <span className="text-green-600">有效 {importRows.filter(r => r._status === 'ok').length}</span>
                {importRows.some(r => r._status === 'dup') && <span className="text-yellow-600 ml-2">重复 {importRows.filter(r => r._status === 'dup').length}</span>}
                {importRows.some(r => r._status === 'error') && <span className="text-red-600 ml-2">异常 {importRows.filter(r => r._status === 'error').length}</span>}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">银行名称</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">账号</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-700">状态</th>
                </tr></thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">
                        {row.bankId ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: BANK_BRANDS[row.bankId]?.color || '#64748b' }}>{BANK_BRANDS[row.bankId]?.short?.slice(0, 1)}</div>
                            <span>{row.bankName}</span>
                          </div>
                        ) : <span className="text-slate-400">{row.bankName}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.accountNumber || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {row._status === 'ok' && <Badge className="bg-green-50 text-green-700 text-xs">待导入</Badge>}
                        {row._status === 'dup' && <Badge className="bg-yellow-50 text-yellow-700 text-xs">已存在</Badge>}
                        {row._status === 'error' && <Badge className="bg-red-50 text-red-700 text-xs">{!row.bankId ? '银行未识别' : '账号为空'}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => { setShowImportPreview(false); setImportRows([]); }}>取消</Button>
              <Button size="sm" onClick={handleConfirmImport} disabled={importRows.filter(r => r._status === 'ok').length === 0}>
                <Upload className="h-4 w-4 mr-1" />确认导入（{importRows.filter(r => r._status === 'ok').length} 条）
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6"><h3 className="text-lg font-semibold text-slate-900 mb-2">{confirmDialog.title}</h3><p className="text-sm text-slate-600">{confirmDialog.description}</p></div>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <Button variant="outline" size="sm" onClick={() => setConfirmDialog(null)}>取消</Button>
              <Button variant="destructive" size="sm" onClick={confirmDialog.onConfirm}>确定删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
