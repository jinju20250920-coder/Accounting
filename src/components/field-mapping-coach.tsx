'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { parseWithConfig } from '@/lib/bank-parsers/engine';
import type { BankParserConfig } from '@/lib/bank-parsers/types';
import type { BankStatementParseResult } from '@/types';
import { sqliteService } from '@/lib/database/sqlite-service';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';

interface FieldMappingCoachProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  onConfigCreated: (config: BankParserConfig) => void;
  /** Pass an existing config to edit it (pre-populates all fields) */
  initialConfig?: BankParserConfig;
  /** The CustomBankConfig record id to update (for edit mode) */
  editingRecordId?: string;
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

// 日期格式选项：UI 仅暴露三种常见格式；custom 能力在 date-handlers 底层保留，
// 遇到三者都识别不了的文件会给提示，由用户从中选最接近的。
const DATE_FORMATS = [
  { value: 'iso', label: 'ISO 格式 (2024-01-26)' },
  { value: 'excel_serial', label: 'Excel 序列号 (45292)' },
  { value: 'compact', label: '紧凑格式 (20240102)' },
];

/** Comprehensive keywords for fuzzy-matching each standard field */
const FIELD_KEYWORDS: Record<string, string[]> = {
  // 注意：'交易时间'/'记账时间' 是时间字段，只放在 time 关键词里。
  // 若放进 date，自动匹配会把"交易时间"列误当日期列（它常是「20260405 08:56:26」这类
  // 日期+时间连写），导致日期解析失败。日期列应优先匹配纯日期表头（记账日期/交易日期等）。
  date: ['记账日期', '交易日期', '日期', '发生日期', '业务日期', '清算日期'],
  time: ['交易时间', '记账时间', '时间', '发生时间', '业务时间'],
  debit: ['借方发生额', '借方金额', '借方', '支出金额', '支出', '借方发生额（支出）', '付款金额'],
  credit: ['贷方发生额', '贷方金额', '贷方', '收入金额', '收入', '贷方发生额（收入）', '收款金额'],
  balance: ['账户余额', '余额', '当前余额', '本方账户余额', '本方余额', '帐户余额', '可用余额'],
  counterpartyName: ['对方户名', '对方名称', '交易对方', '收款人', '付款人', '收付方', '对方账户名称', '交易对方名称', '对手方'],
  counterpartyAccount: ['对方账号', '对方账户', '收款账号', '付款账号', '对方开户账号'],
  summary: ['交易摘要', '摘要', '业务摘要', '交易类型'],
  notes: ['附言', '备注', '用途', '说明', '交易备注'],
  transactionSerialNo: ['交易流水号', '流水号', '明细号', '交易序号', '交易编号', '凭证流水号'],
  voucherNo: ['凭证号', '凭证号码', '凭证编号', '记帐凭证号', '记账凭证号'],
};

/**
 * Score the similarity between a column header and a field's keywords.
 * Returns 0-1 score: 1.0 = exact match, 0.9 = contains keyword, etc.
 */
function scoreMatch(header: string, keywords: string[]): number {
  const h = header.trim();
  if (!h) return 0;

  // 1. Exact match
  for (const kw of keywords) {
    if (h === kw) return 1.0;
  }

  // 2. Header contains a keyword (header is longer, keyword is a substring)
  for (const kw of keywords) {
    if (h.includes(kw)) return 0.9;
  }

  // 3. A keyword contains the header (header is shorter, part of keyword)
  for (const kw of keywords) {
    if (kw.includes(h)) return 0.7;
  }

  // 4. Character overlap ratio
  const hChars = new Set(h);
  let bestOverlap = 0;
  for (const kw of keywords) {
    const kwChars = new Set(kw);
    let shared = 0;
    for (const c of hChars) {
      if (kwChars.has(c)) shared++;
    }
    const ratio = shared / Math.max(hChars.size, kwChars.size);
    bestOverlap = Math.max(bestOverlap, ratio);
  }

  return bestOverlap > 0.6 ? bestOverlap * 0.6 : 0;
}

/**
 * Auto-match column headers to standard fields.
 * Returns { fieldMap, scores } where scores[field] = confidence 0-1.
 */
function autoMatch(headers: string[]): { fieldMap: Record<string, string>; scores: Record<string, number> } {
  const fieldMap: Record<string, string> = {};
  const scores: Record<string, number> = {};
  const usedHeaders = new Set<string>();

  // Collect all fields
  const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(f => f.key);

  // Sort by priority: required fields first, then by best score
  for (const field of allFields) {
    const keywords = FIELD_KEYWORDS[field];
    if (!keywords) continue;

    let bestScore = 0;
    let bestHeader = '';

    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const s = scoreMatch(header, keywords);
      if (s > bestScore) {
        bestScore = s;
        bestHeader = header;
      }
    }

    if (bestHeader && bestScore >= 0.5) {
      fieldMap[field] = bestHeader;
      scores[field] = bestScore;
      usedHeaders.add(bestHeader);
    }
  }

  return { fieldMap, scores };
}

/**
 * 根据日期列实际样本值推断日期格式（投票取众数）。
 * 8 位纯数字→compact；\d{4}-\d{1,2}-\d{1,2}→iso；5 位序列号(30000-99999)→excel_serial。
 * 无法识别返回 null。
 */
function inferDateFormat(samples: string[]): 'iso' | 'compact' | 'excel_serial' | null {
  const votes: Record<string, number> = {};
  for (const raw of samples) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    let fmt: 'iso' | 'compact' | 'excel_serial' | null = null;
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(v)) fmt = 'iso';
    else if (/^\d{8}$/.test(v)) fmt = 'compact';
    else if (/^\d{5}$/.test(v)) {
      const n = Number(v);
      if (n >= 30000 && n <= 99999) fmt = 'excel_serial';
    }
    if (fmt) votes[fmt] = (votes[fmt] || 0) + 1;
  }
  let best: 'iso' | 'compact' | 'excel_serial' | null = null;
  let bestN = 0;
  for (const f of Object.keys(votes)) {
    if (votes[f] > bestN) { best = f as 'iso' | 'compact' | 'excel_serial'; bestN = votes[f]; }
  }
  return best;
}

type Step = 0 | 1 | 2 | 3 | 4;

export function FieldMappingCoach({ open, onClose, file, onConfigCreated, initialConfig, editingRecordId }: FieldMappingCoachProps) {
  const [step, setStep] = useState<Step>(0);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);
  const [dataStartRow, setDataStartRow] = useState<number>(1);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [matchScores, setMatchScores] = useState<Record<string, number>>({});
  const [dateFormat, setDateFormat] = useState('iso');
  const [customPattern, setCustomPattern] = useState('');
  const [dateRecognized, setDateRecognized] = useState<boolean | null>(null);
  const [previewResult, setPreviewResult] = useState<BankStatementParseResult | null>(null);
  const [configName, setConfigName] = useState('自定义银行格式');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // Pre-populate non-file-dependent state from initialConfig
  React.useEffect(() => {
    if (open && initialConfig) {
      setConfigName(initialConfig.name || '自定义银行格式');
      setSelectedHeaderRow(initialConfig.headerRows || 0);
      setDataStartRow(initialConfig.dataStartRow != null ? initialConfig.dataStartRow : (initialConfig.headerRows || 0) + 1);
      setDateFormat(initialConfig.dateFormat || 'iso');
      setCustomPattern(initialConfig.dateFormatCustom || '');
    }
  }, [open, initialConfig]);

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

    // Use headerRows from initialConfig if editing, otherwise guess
    const headerIdx = initialConfig?.headerRows ?? guessHeaderRow(data);
    setSelectedHeaderRow(headerIdx);
    const dsRow = initialConfig?.dataStartRow != null ? initialConfig.dataStartRow : headerIdx + 1;
    setDataStartRow(dsRow);

    const headers = getMergedHeaders(data, headerIdx);
    setColumnHeaders(headers);

    // If initialConfig provided, resolve fieldMap against actual headers
    if (initialConfig?.columnMapping) {
      const fm: Record<string, string> = {};
      for (const [field, keywords] of Object.entries(initialConfig.columnMapping)) {
        if (!keywords || keywords.length === 0) continue;
        for (let i = 0; i < headers.length; i++) {
          if (keywords.some(kw => headers[i].includes(kw))) {
            fm[field] = headers[i];
            break;
          }
        }
      }
      setFieldMap(fm);
      setMatchScores({});
      setStep(1);
    } else {
      // Auto-match using fuzzy scoring
      const { fieldMap: autoMap, scores } = autoMatch(headers);
      setFieldMap(autoMap);
      setMatchScores(scores);
      // 新建（非编辑已存配置）时，根据日期列样本自动推断日期格式
      inferDateColumn(data, headerIdx, autoMap.date);

      const matchCount = Object.keys(autoMap).length;
      if (matchCount > 0) {
        showToast('info', `已自动匹配 ${matchCount} 个字段，请检查并调整`);
      }
      setStep(0);
    }
  };

  /**
   * Merge the selected header row with adjacent rows.
   * Handles dual-layer headers (e.g. CCB has group headers in row N, sub-headers in row N+1).
   * Same logic as engine.ts mergedHeaders.
   */
  const getMergedHeaders = (data: string[][], idx: number): string[] => {
    const row = data[idx] || [];
    const prevRow = idx > 0 ? data[idx - 1] : null;
    // ⚠️ 只合并上一行（与 engine.ts 的表头合并逻辑保持一致），不合并下一行。
    // 下一行通常是数据行：把它合并进表头会让列名变成「列名+数据值」
    // （如「记账日期20260405」）。autoMatch 靠子串仍能选中，但 buildConfig 会把这个
    // 带数据值的字符串存进 columnMapping；engine 用纯表头反向匹配时失败
    // （「记账日期」.includes(「记账日期20260405」) === false）→ 报「列匹配失败」。
    const maxCols = Math.max(row.length, prevRow?.length || 0);

    const merged: string[] = [];
    for (let i = 0; i < maxCols; i++) {
      const cur = String(row[i] || '').trim();
      const prev = prevRow ? String(prevRow[i] || '').trim() : '';

      let combined = '';
      if (cur && prev && cur !== prev) {
        combined = prev + cur;
      } else {
        combined = cur || prev;
      }
      merged.push(combined);
    }

    // Deduplicate while preserving order, and filter empty
    const seen = new Set<string>();
    return merged.filter(h => {
      if (!h || seen.has(h)) return false;
      seen.add(h);
      return true;
    });
  };

  // 根据日期列实际样本值推断日期格式并预填（仅新建时；编辑已存配置时保留原格式）
  const inferDateColumn = (data: string[][], headerIdx: number, dateColName?: string) => {
    if (!dateColName) { setDateRecognized(false); return; }
    const headers = getMergedHeaders(data, headerIdx);
    const colIdx = headers.indexOf(dateColName);
    if (colIdx < 0) { setDateRecognized(false); return; }
    const samples: string[] = [];
    for (let r = headerIdx + 1; r < data.length && samples.length < 8; r++) {
      const v = String(data[r]?.[colIdx] ?? '').trim();
      if (v) samples.push(v);
    }
    const inferred = inferDateFormat(samples);
    if (inferred) { setDateFormat(inferred); setDateRecognized(true); }
    else { setDateRecognized(false); }
  };

  const guessHeaderRow = (data: string[][]): number => {
    // Prefer the row whose merged headers produce the most unique non-empty values
    let bestIdx = 0;
    let bestCount = 0;
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const merged = getMergedHeaders(data, i);
      if (merged.length > bestCount) {
        bestCount = merged.length;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  // Re-run auto-matching when header row changes
  const handleHeaderRowChange = (idx: number) => {
    setSelectedHeaderRow(idx);
    setDataStartRow(idx + 1);
    const headers = getMergedHeaders(rawRows, idx);
    setColumnHeaders(headers);
    const { fieldMap: autoMap, scores } = autoMatch(headers);
    setFieldMap(autoMap);
    setMatchScores(scores);
    inferDateColumn(rawRows, idx, autoMap.date);
  };

  const buildConfig = useCallback((): BankParserConfig => {
    const mapping: Record<string, string[]> = {};
    for (const [field, colName] of Object.entries(fieldMap)) {
      if (colName) mapping[field] = [colName];
    }
    return {
      id: initialConfig?.id || `custom_${Date.now()}`,
      name: configName,
      headerRows: selectedHeaderRow,
      dataStartRow: dataStartRow,
      columnMapping: mapping as Record<string, string[]>,
      dateFormat: dateFormat as BankParserConfig['dateFormat'],
      dateFormatCustom: dateFormat === 'custom' ? customPattern : undefined,
      hasSeparatedTime: !!fieldMap.time,
      identifiers: initialConfig?.identifiers || {},
    };
  }, [selectedHeaderRow, dataStartRow, fieldMap, dateFormat, customPattern, configName, initialConfig]);

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
      const recordId = editingRecordId || `cbc_${Date.now()}`;
      await sqliteService.saveCustomBankConfig({
        id: recordId,
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
    setMatchScores({});
    setPreviewResult(null);
  };

  const autoMatchedCount = useMemo(() => {
    return Object.keys(fieldMap).filter(k => matchScores[k] != null && matchScores[k] > 0).length;
  }, [fieldMap, matchScores]);

  const confidenceLabel = (score: number | undefined) => {
    if (score == null || score === 0) return null;
    if (score >= 0.9) return { text: `${Math.round(score * 100)}%`, cls: 'bg-green-50 text-green-700' };
    if (score >= 0.7) return { text: `${Math.round(score * 100)}%`, cls: 'bg-yellow-50 text-yellow-700' };
    return { text: `${Math.round(score * 100)}%`, cls: 'bg-orange-50 text-orange-600' };
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialConfig ? '编辑' : '自定义'}银行格式映射 — 步骤 {step + 1}/5</DialogTitle>
        </DialogHeader>

        {/* Step 0: Header Row & Data Start Row Selection */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">选择列标题所在行（点击行号选中）：</p>
            <div className="overflow-x-auto max-h-64 border rounded">
              <table className="w-full text-xs">
                <tbody>
                  {rawRows.slice(0, 20).map((row, idx) => (
                    <tr
                      key={idx}
                      className={`cursor-pointer hover:bg-blue-50 ${
                        idx === selectedHeaderRow ? 'bg-blue-100 font-bold' : ''
                      } ${idx >= dataStartRow && idx > selectedHeaderRow ? 'bg-green-50/40' : ''}`}
                      onClick={() => handleHeaderRowChange(idx)}
                    >
                      <td className="px-2 py-1 border-r w-10 text-center text-gray-400">
                        {idx === selectedHeaderRow ? '📌' : idx}
                      </td>
                      {(row || []).slice(0, 8).map((cell, ci) => (
                        <td key={ci} className="px-2 py-1 truncate max-w-[120px]">{String(cell || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Merged headers preview */}
            {columnHeaders.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border">
                <p className="text-xs text-slate-500 mb-2">
                  识别到 {columnHeaders.length} 个列（已合并相邻行）：
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {columnHeaders.map((h, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{h}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Data start row setting */}
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">表头行:</span>
                <Badge variant="outline" className="font-mono">第 {selectedHeaderRow} 行</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">数据起始行:</span>
                <Input
                  type="number"
                  min={selectedHeaderRow + 1}
                  max={rawRows.length - 1}
                  value={dataStartRow}
                  onChange={(e) => setDataStartRow(Number(e.target.value))}
                  className="w-20 h-7 text-sm text-center"
                />
              </div>
              <p className="text-xs text-slate-400">
                若表头与数据之间有空行或小计行，请调整数据起始行
              </p>
            </div>

            {/* Auto-match preview */}
            {autoMatchedCount > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700">
                    已自动匹配 {autoMatchedCount} 个字段
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(({ key, label }) => {
                    if (!fieldMap[key]) return null;
                    const conf = confidenceLabel(matchScores[key]);
                    return (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {label} → {fieldMap[key]}
                        {conf && <span className={`ml-1 px-1 rounded text-[10px] ${conf.cls}`}>{conf.text}</span>}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

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
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">将标准字段映射到对应的列：</p>
              <Button variant="ghost" size="sm" onClick={() => {
                const { fieldMap: autoMap, scores } = autoMatch(columnHeaders);
                setFieldMap(autoMap);
                setMatchScores(scores);
                showToast('info', `已重新匹配 ${Object.keys(autoMap).length} 个字段`);
              }}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> 重新自动匹配
              </Button>
            </div>
            <div className="space-y-2">
              {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(({ key, label }) => {
                const conf = confidenceLabel(matchScores[key]);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <Badge variant={REQUIRED_FIELDS.some(f => f.key === key) ? 'default' : 'secondary'} className="w-28 justify-center">
                      {label}{REQUIRED_FIELDS.some(f => f.key === key) && ' *'}
                    </Badge>
                    <Select value={fieldMap[key] || ''} onValueChange={(v) => {
                      setFieldMap(prev => ({ ...prev, [key]: v }));
                      // Clear score when user manually changes
                      setMatchScores(prev => { const n = { ...prev }; delete n[key]; return n; });
                    }}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="-- 不映射 --" />
                      </SelectTrigger>
                      <SelectContent>
                        {columnHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {conf && (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${conf.cls}`}>
                        {conf.text}
                      </Badge>
                    )}
                  </div>
                );
              })}
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
                {rawRows.slice(dataStartRow, dataStartRow + 3).map((row, i) => {
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
            {dateRecognized && (
              <p className="text-xs text-green-600">✓ 已根据文件自动识别日期格式，可在上方调整</p>
            )}
            {dateRecognized === false && (
              <p className="text-xs text-amber-600">⚠️ 未能自动识别日期格式，请根据上方样本值手动选择</p>
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
              <div className="space-y-2">
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
                  <p className="text-xs text-slate-400 p-2 text-center">
                    共解析 {previewResult.transactions.length} 条交易
                    {previewResult.errors && previewResult.errors.length > 0 && `，${previewResult.errors.length} 个错误`}
                  </p>
                </div>
                {previewResult.errors && previewResult.errors.length > 0 && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 space-y-0.5 max-h-32 overflow-y-auto">
                    {previewResult.errors.slice(0, 10).map((e, i) => (
                      <div key={i}>· {e.message}</div>
                    ))}
                    {previewResult.errors.length > 10 && (
                      <div className="text-slate-400">…还有 {previewResult.errors.length - 10} 条</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-red-500 space-y-1">
                <p>解析失败或无数据。</p>
                {previewResult?.errors?.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-xs">· {e.message}</p>
                ))}
              </div>
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
