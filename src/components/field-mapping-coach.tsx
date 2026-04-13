'use client';

import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { parseWithConfig } from '@/lib/bank-parsers/engine';
import type { BankParserConfig } from '@/lib/bank-parsers/types';
import type { BankStatementParseResult } from '@/types';
import { getCurrentService } from '@/lib/database';
import { sqliteService } from '@/lib/database/sqlite-service';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface FieldMappingCoachProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  onConfigCreated: (config: BankParserConfig) => void;
}

const REQUIRED_FIELDS = [
  { key: 'date', label: '日期' },
  { key: 'debit', label: '借方金额' },
  { key: 'credit', label: '贷方金额' },
];

const OPTIONAL_FIELDS = [
  { key: 'balance', label: '余额' },
  { key: 'counterpartyName', label: '对方户名' },
  { key: 'counterpartyAccount', label: '对方账号' },
  { key: 'summary', label: '摘要' },
  { key: 'notes', label: '备注/附言' },
  { key: 'transactionSerialNo', label: '流水号' },
  { key: 'voucherNo', label: '凭证号' },
  { key: 'time', label: '交易时间' },
];

const DATE_FORMATS = [
  { value: 'iso', label: 'ISO 格式 (2024-01-26)' },
  { value: 'excel_serial', label: 'Excel 序列号 (45292)' },
  { value: 'compact', label: '紧凑格式 (20240102)' },
  { value: 'custom', label: '自定义格式' },
];

type Step = 0 | 1 | 2 | 3 | 4;

export function FieldMappingCoach({ open, onClose, file, onConfigCreated }: FieldMappingCoachProps) {
  const [step, setStep] = useState<Step>(0);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [dateFormat, setDateFormat] = useState('iso');
  const [customPattern, setCustomPattern] = useState('');
  const [previewResult, setPreviewResult] = useState<BankStatementParseResult | null>(null);
  const [configName, setConfigName] = useState('自定义银行格式');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // Load file on open
  React.useEffect(() => {
    if (open && file) {
      loadFile();
    }
  }, [open, file]);

  const loadFile = async () => {
    if (!file) return;
    const XLSX = await import('xlsx');
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    setRawRows(data);

    // Guess header row: first row where > 50% cells are non-empty text
    let guessed = 0;
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      const nonEmpty = row.filter(c => String(c || '').trim()).length;
      if (nonEmpty > row.length * 0.5 && nonEmpty >= 3) {
        guessed = i;
        break;
      }
    }
    setSelectedHeaderRow(guessed);
    setColumnHeaders((data[guessed] || []).map((c: any) => String(c || '').trim()).filter(Boolean));
    setStep(0);
  };

  const buildConfig = useCallback((): BankParserConfig => {
    const mapping: Record<string, string[]> = {};
    for (const [field, colName] of Object.entries(fieldMap)) {
      if (colName) mapping[field] = [colName];
    }
    return {
      id: `custom_${Date.now()}`,
      name: configName,
      headerRows: selectedHeaderRow,
      columnMapping: mapping as any,
      dateFormat: dateFormat as any,
      dateFormatCustom: dateFormat === 'custom' ? customPattern : undefined,
      hasSeparatedTime: !!fieldMap.time,
      identifiers: {},
    };
  }, [selectedHeaderRow, fieldMap, dateFormat, customPattern, configName]);

  const handleTest = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const config = buildConfig();
      const result = await parseWithConfig(file, config);
      setPreviewResult(result);
      setStep(3);
    } catch (e) {
      showToast('error', `测试解析失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const config = buildConfig();
    try {
      const accountSetId = sqliteService.accountSetId;
      await sqliteService.saveCustomBankConfig({
        id: `cbc_${Date.now()}`,
        accountSetId,
        name: configName,
        config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      showToast('success', '自定义格式已保存');
      onConfigCreated(config);
      onClose();
    } catch (e) {
      showToast('error', `保存失败: ${(e as Error).message}`);
    }
  };

  const reset = () => {
    setStep(0);
    setFieldMap({});
    setPreviewResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>自定义银行格式映射 — 步骤 {step + 1}/5</DialogTitle>
        </DialogHeader>

        {/* Step 0: Header Row Selection */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">选择列标题所在行（点击行号选中）：</p>
            <div className="overflow-x-auto max-h-64 border rounded">
              <table className="w-full text-xs">
                <tbody>
                  {rawRows.slice(0, 20).map((row, idx) => (
                    <tr
                      key={idx}
                      className={`cursor-pointer hover:bg-blue-50 ${idx === selectedHeaderRow ? 'bg-blue-100 font-bold' : ''}`}
                      onClick={() => {
                        setSelectedHeaderRow(idx);
                        setColumnHeaders((row || []).map((c: any) => String(c || '').trim()).filter(Boolean));
                      }}
                    >
                      <td className="px-2 py-1 border-r w-10 text-center text-gray-400">{idx}</td>
                      {(row || []).slice(0, 8).map((cell, ci) => (
                        <td key={ci} className="px-2 py-1 truncate max-w-[120px]">{String(cell || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button onClick={() => setStep(1)}>
                下一步 <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Column Mapping */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">将标准字段映射到对应的列：</p>
            <div className="space-y-2">
              {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <Badge variant={REQUIRED_FIELDS.some(f => f.key === key) ? 'default' : 'secondary'} className="w-28 justify-center">
                    {label}{REQUIRED_FIELDS.some(f => f.key === key) && ' *'}
                  </Badge>
                  <Select value={fieldMap[key] || ''} onValueChange={(v) => setFieldMap(prev => ({ ...prev, [key]: v }))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="-- 不映射 --" />
                    </SelectTrigger>
                    <SelectContent>
                      {columnHeaders.map((h, i) => (
                        <SelectItem key={i} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> 上一步
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!fieldMap.date || (!fieldMap.debit && !fieldMap.credit)}
              >
                下一步 <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Date Format */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">选择日期格式：</p>
            {fieldMap.date && (
              <div className="p-3 bg-slate-50 rounded text-sm">
                <p className="font-medium mb-1">日期列样本值：</p>
                {rawRows.slice(selectedHeaderRow + 1, selectedHeaderRow + 4).map((row, i) => {
                  const colIdx = columnHeaders.indexOf(fieldMap.date);
                  return (
                    <p key={i} className="text-gray-600">
                      {colIdx >= 0 ? String(row?.[colIdx] || '') : '(无)'}
                    </p>
                  );
                })}
              </div>
            )}
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dateFormat === 'custom' && (
              <Input
                placeholder="格式模式（如 yyyy-MM-dd-HHmm）"
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
              />
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> 上一步
              </Button>
              <Button onClick={handleTest} disabled={loading}>
                {loading ? '测试中...' : '测试解析'} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Test Preview */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">解析结果预览（前5行）：</p>
            {previewResult && previewResult.transactions.length > 0 ? (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-2 py-1">日期</th>
                      <th className="px-2 py-1">借方</th>
                      <th className="px-2 py-1">贷方</th>
                      <th className="px-2 py-1">对方户名</th>
                      <th className="px-2 py-1">摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.transactions.slice(0, 5).map((tx, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{tx.date}</td>
                        <td className="px-2 py-1">{tx.debit ?? '-'}</td>
                        <td className="px-2 py-1">{tx.credit ?? '-'}</td>
                        <td className="px-2 py-1">{tx.counterpartyName || '-'}</td>
                        <td className="px-2 py-1">{tx.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-red-500">
                解析失败或无数据。
                {previewResult?.errors?.[0]?.message}
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> 返回调整
              </Button>
              <Button onClick={() => setStep(4)}>
                确认并保存 <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Save */}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">保存自定义格式配置：</p>
            <Input
              placeholder="格式名称"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
            />
            <p className="text-xs text-gray-400">保存后，下次导入相同格式的文件时将自动使用此配置。</p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> 上一步
              </Button>
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" /> 保存配置
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
