'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Download,
  FileDown,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { useToast } from '@/components/ui/toast';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { usePayrollStore } from '@/stores/usePayrollStore';
import {
  createBlankPayrollCalculationConfig,
  type PayrollCalculationConfig,
  type PayrollInput,
  type SocialInsuranceConfig,
} from '@/lib/payroll';
import {
  exportPayrollResults,
  generatePayrollImportTemplate,
  parsePayrollFile,
  type PayrollImportError,
} from '@/lib/payroll-import';

type InsuranceKey = keyof Pick<SocialInsuranceConfig, 'pension' | 'medical' | 'unemployment' | 'injury' | 'maternity' | 'supplementaryMedical'>;

const INSURANCE_ROWS: { key: InsuranceKey; label: string }[] = [
  { key: 'pension', label: '养老保险' },
  { key: 'medical', label: '医疗保险' },
  { key: 'unemployment', label: '失业保险' },
  { key: 'injury', label: '工伤保险' },
  { key: 'maternity', label: '生育保险' },
  { key: 'supplementaryMedical', label: '补充医疗' },
];

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status?: string) {
  if (status === 'confirmed') return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">已确认</Badge>;
  if (status === 'calculated') return <Badge className="border-blue-200 bg-blue-50 text-blue-700">已计算</Badge>;
  return <Badge className="border-slate-200 bg-slate-50 text-slate-600">草稿</Badge>;
}

export default function PayrollPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAccountSet = useAccountSetStore((state) =>
    state.accountSets.find((item) => item.id === state.currentAccountSetId) || null,
  );
  const defaultPeriod = currentAccountSet?.currentPeriod || new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(defaultPeriod);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<PayrollCalculationConfig>(createBlankPayrollCalculationConfig());
  const [previewRows, setPreviewRows] = useState<PayrollInput[]>([]);
  const [previewErrors, setPreviewErrors] = useState<PayrollImportError[]>([]);
  const [previewFileName, setPreviewFileName] = useState('');
  const {
    batches,
    selectedBatch,
    items,
    config,
    loading,
    error,
    loadPeriod,
    loadBatch,
    saveConfig,
    importDraft,
    recalculateBatch,
    confirmBatch,
    revertBatchToDraft,
    deleteDraftBatch,
  } = usePayrollStore();

  useEffect(() => {
    setPeriod(defaultPeriod);
  }, [defaultPeriod]);

  useEffect(() => {
    void loadPeriod(period);
  }, [loadPeriod, period]);

  useEffect(() => {
    setSettingsDraft(config?.config || createBlankPayrollCalculationConfig());
  }, [config]);

  const calculatedItems = useMemo(() => items.map((item) => item.calculationResult), [items]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await parsePayrollFile(file);
      setPreviewRows(result.validRows);
      setPreviewErrors(result.errors);
      setPreviewFileName(file.name);
      showToast(
        result.errors.length ? 'warning' : 'success',
        `解析完成：有效 ${result.validRows.length} 行，错误 ${result.errors.length} 行`,
      );
    } catch {
      showToast('error', '工资表解析失败，请使用模板重新导入');
    } finally {
      event.target.value = '';
    }
  }

  async function saveSettings() {
    try {
      await saveConfig(period, settingsDraft);
      setSettingsOpen(false);
      showToast('success', '计算设置已保存');
    } catch (saveError) {
      showToast('error', saveError instanceof Error ? saveError.message : '保存设置失败');
    }
  }

  async function confirmImport() {
    try {
      await importDraft(period, previewFileName, previewRows);
      setPreviewRows([]);
      setPreviewErrors([]);
      setPreviewFileName('');
      showToast('success', '工资批次已导入并完成计算');
    } catch (importError) {
      showToast('error', importError instanceof Error ? importError.message : '工资导入失败');
    }
  }

  async function runAction(action: () => Promise<void>, message: string) {
    try {
      await action();
      showToast('success', message);
    } catch (actionError) {
      showToast('error', actionError instanceof Error ? actionError.message : '操作失败');
    }
  }

  function updateSocialRate(key: InsuranceKey, field: 'employeeRate' | 'employerRate', value: string) {
    setSettingsDraft((draft) => ({
      ...draft,
      socialInsurance: {
        ...draft.socialInsurance,
        [key]: {
          ...draft.socialInsurance[key],
          [field]: (Number(value) || 0) / 100,
        },
      },
    }));
  }

  function updateSocialBase(field: 'minimumBase' | 'maximumBase', value: string) {
    setSettingsDraft((draft) => ({
      ...draft,
      socialInsurance: { ...draft.socialInsurance, [field]: Number(value) || 0 },
    }));
  }

  function updateHousing(field: 'employeeRate' | 'employerRate' | 'minimumBase' | 'maximumBase', value: string) {
    setSettingsDraft((draft) => ({
      ...draft,
      housingFund: {
        ...draft.housingFund,
        [field]: field.includes('Rate') ? (Number(value) || 0) / 100 : Number(value) || 0,
      },
    }));
  }

  if (!currentAccountSet) {
    return <div className="p-8 text-sm text-slate-500">请先选择账套后使用薪酬管理。</div>;
  }

  return (
    <div className="min-h-full bg-slate-50/70">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">薪酬管理</h1>
              <p className="mt-1 text-xs text-slate-500">{currentAccountSet.name} / 工资计算与月结依据</p>
            </div>
            <ChineseMonthPicker value={period} onChange={setPeriod} className="w-36" />
            {selectedBatch ? statusBadge(selectedBatch.status) : <Badge variant="outline">尚无批次</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={generatePayrollImportTemplate}>
              <Download />下载模板
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload />导入工资表
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 />计算设置
            </Button>
            <Button
              size="sm"
              disabled={calculatedItems.length === 0}
              onClick={() => exportPayrollResults(calculatedItems, period)}
            >
              <FileDown />导出结果
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </header>

      <main className="space-y-5 p-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['员工人数', selectedBatch?.employeeCount || 0],
            ['应发合计', formatMoney(selectedBatch?.grossTotal || 0)],
            ['企业成本', formatMoney(selectedBatch?.employerCostTotal || 0)],
            ['个税合计', formatMoney(selectedBatch?.taxTotal || 0)],
            ['实发合计', formatMoney(selectedBatch?.netTotal || 0)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        {previewRows.length > 0 || previewErrors.length > 0 ? (
          <section className="rounded-md border border-blue-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-medium text-slate-900">导入预览</h2>
                <p className="text-xs text-slate-500">{previewFileName} / 有效 {previewRows.length} 行 / 错误 {previewErrors.length} 行</p>
              </div>
              <Button size="sm" disabled={previewRows.length === 0 || previewErrors.length > 0} onClick={confirmImport}>
                <Calculator />计算并保存批次
              </Button>
            </div>
            {previewErrors.length > 0 && (
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                {previewErrors.map((item) => <p key={item.rowNumber}>第 {item.rowNumber} 行：{item.message}</p>)}
              </div>
            )}
            <div className="max-h-48 overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {['工号', '姓名', '部门', '基本工资', '奖金', '专项附加扣除'].map((title) => (
                      <th key={title} className="px-4 py-2 text-left font-medium">{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.employeeCode} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono text-xs">{row.employeeCode}</td>
                      <td className="px-4 py-2">{row.employeeName}</td>
                      <td className="px-4 py-2">{row.departmentName || '-'}</td>
                      <td className="px-4 py-2 tabular-nums">{formatMoney(row.basicSalary)}</td>
                      <td className="px-4 py-2 tabular-nums">{formatMoney(row.bonus)}</td>
                      <td className="px-4 py-2 tabular-nums">{formatMoney(row.specialAdditionalDeduction)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium text-slate-900">工资计算明细</h2>
              <p className="text-xs text-slate-500">计算完成不等同于工资已发放或社保、个税已缴纳。</p>
            </div>
            {selectedBatch && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => runAction(() => recalculateBatch(selectedBatch.id), '工资数据已重新计算')}>
                  <RotateCcw />重新计算
                </Button>
                {selectedBatch.status === 'confirmed' ? (
                  <Button variant="outline" size="sm" onClick={() => runAction(() => revertBatchToDraft(selectedBatch.id), '批次已退回草稿')}>
                    <RotateCcw />退回草稿
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={() => runAction(() => confirmBatch(selectedBatch.id), '本月工资批次已确认')}>
                      <CheckCircle2 />确认本月工资
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => runAction(() => deleteDraftBatch(selectedBatch.id), '草稿批次已删除')} title="删除草稿">
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          {batches.length > 1 && (
            <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
              {batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`rounded px-3 py-1.5 text-xs ${selectedBatch?.id === batch.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => void loadBatch(batch.id)}
                >
                  {batch.batchName}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {['工号', '姓名', '部门', '应发工资', '个人社保', '个人公积金', '个税', '实发工资', '企业成本', '状态'].map((title) => (
                    <th key={title} className="whitespace-nowrap px-4 py-2.5 text-left font-medium">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-slate-400">加载中...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-slate-400">暂无工资明细，请先设置计算规则并导入工资表。</td></tr>
                ) : items.map((item) => {
                  const calculation = item.calculationResult;
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{item.employeeCode}</td>
                      <td className="px-4 py-2.5">{item.employeeName}</td>
                      <td className="px-4 py-2.5 text-slate-500">{item.departmentName || '-'}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatMoney(calculation.grossSalary)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatMoney(calculation.employeeSocialInsurance)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatMoney(calculation.employeeHousingFund)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-amber-700">{formatMoney(calculation.individualIncomeTax)}</td>
                      <td className="px-4 py-2.5 font-medium tabular-nums text-slate-900">{formatMoney(calculation.netSalary)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatMoney(calculation.employerTotalCost)}</td>
                      <td className="px-4 py-2.5">{statusBadge(selectedBatch?.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>计算设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              社保和公积金比例按本账套适用地区及政策填写。个税依据：{settingsDraft.individualTax.policyLabel}，生效日期 {settingsDraft.individualTax.policyEffectiveDate}。
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-900">社保配置</h3>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="grid grid-cols-[160px_80px_1fr_1fr] bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>险种</span><span>启用</span><span>个人比例 (%)</span><span>企业比例 (%)</span>
                </div>
                {INSURANCE_ROWS.map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-[160px_80px_1fr_1fr] items-center gap-3 border-t border-slate-100 px-3 py-2">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={settingsDraft.socialInsurance[key].enabled}
                      onCheckedChange={(enabled) => setSettingsDraft((draft) => ({
                        ...draft,
                        socialInsurance: { ...draft.socialInsurance, [key]: { ...draft.socialInsurance[key], enabled } },
                      }))}
                    />
                    <Input value={settingsDraft.socialInsurance[key].employeeRate * 100} onChange={(event) => updateSocialRate(key, 'employeeRate', event.target.value)} />
                    <Input value={settingsDraft.socialInsurance[key].employerRate * 100} onChange={(event) => updateSocialRate(key, 'employerRate', event.target.value)} />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><Label>社保基数下限</Label><Input value={settingsDraft.socialInsurance.minimumBase} onChange={(event) => updateSocialBase('minimumBase', event.target.value)} /></div>
                <div><Label>社保基数上限</Label><Input value={settingsDraft.socialInsurance.maximumBase} onChange={(event) => updateSocialBase('maximumBase', event.target.value)} /></div>
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-sm font-medium text-slate-900">公积金配置</h3>
                <Switch
                  checked={settingsDraft.housingFund.enabled}
                  onCheckedChange={(enabled) => setSettingsDraft((draft) => ({
                    ...draft,
                    housingFund: { ...draft.housingFund, enabled },
                  }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div><Label>个人比例 (%)</Label><Input value={settingsDraft.housingFund.employeeRate * 100} onChange={(event) => updateHousing('employeeRate', event.target.value)} /></div>
                <div><Label>企业比例 (%)</Label><Input value={settingsDraft.housingFund.employerRate * 100} onChange={(event) => updateHousing('employerRate', event.target.value)} /></div>
                <div><Label>基数下限</Label><Input value={settingsDraft.housingFund.minimumBase} onChange={(event) => updateHousing('minimumBase', event.target.value)} /></div>
                <div><Label>基数上限</Label><Input value={settingsDraft.housingFund.maximumBase} onChange={(event) => updateHousing('maximumBase', event.target.value)} /></div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>取消</Button>
            <Button onClick={saveSettings}>保存设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
