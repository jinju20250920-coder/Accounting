'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Building2, FileText, MapPin, Coins, FileSignature } from 'lucide-react';

interface SetupStepCompanyProps {
  data: {
    name: string;
    code: string;
    taxNo: string;
    address: string;
    baseCurrency: string;
    accountingStandard: 'small-enterprise' | 'enterprise' | 'other';
    taxpayerType: 'small' | 'general';
    voucherWord: string;
    voucherNoPeriod: 'monthly' | 'yearly' | 'continuous';
    voucherNoDigits: 3 | 4 | 5;
    useClassifiedWords: boolean;
    classifiedWords: { receipt: string; payment: string; general: string };
    enableDate: string;
    startDate: string;
  };
  onChange: (data: SetupStepCompanyProps['data']) => void;
  accountSetId: string;
  lastVoucherFullNo?: string;
}

export function SetupStepCompany({ data, onChange, lastVoucherFullNo }: SetupStepCompanyProps) {
  const classifiedWords = data.classifiedWords || { receipt: '收', payment: '付', general: '记' };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">公司基本信息</h2>
        <p className="text-sm text-slate-500 mt-1">填写公司的基本信息，这些信息将用于凭证、报表等</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label required>账套名称</Label>
          <Input
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="公司名称"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label required>账套编码</Label>
          <Input
            value={data.code}
            onChange={(e) => onChange({ ...data, code: e.target.value })}
            placeholder="SET001"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label required>启用日期</Label>
          <ChineseDatePicker
            value={data.startDate}
            onChange={(v) => onChange({ ...data, startDate: v })}
          />
        </div>
        <div className="space-y-2">
          <Label required>启用年月</Label>
          <ChineseMonthPicker
            value={data.enableDate}
            onChange={(v) => onChange({ ...data, enableDate: v })}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">税务信息</span>
        </div>
        <div className="space-y-2 max-w-md">
          <Label>纳税人识别号</Label>
            <Input
              value={data.taxNo}
              onChange={(e) => onChange({ ...data, taxNo: e.target.value })}
              placeholder="纳税人识别号"
              autoComplete="off"
            />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">地址信息</span>
        </div>
        <div className="space-y-2">
          <Label>公司地址</Label>
          <Input
            value={data.address}
            onChange={(e) => onChange({ ...data, address: e.target.value })}
            placeholder="北京市朝阳区..."
            autoComplete="off"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">会计政策</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>本位币</Label>
            <select
              value={data.baseCurrency}
              onChange={(e) => onChange({ ...data, baseCurrency: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="人民币">人民币 (CNY)</option>
              <option value="美元">美元 (USD)</option>
              <option value="欧元">欧元 (EUR)</option>
              <option value="港币">港币 (HKD)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>会计准则</Label>
            <select
              value={data.accountingStandard}
              onChange={(e) => onChange({ ...data, accountingStandard: e.target.value as 'small-enterprise' | 'enterprise' | 'other' })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="small-enterprise">小企业会计准则</option>
              <option value="enterprise">企业会计准则</option>
              <option value="other">其他</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-4">
          <FileSignature className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">凭证编号</span>
        </div>

        {/* 统一 vs 分类 模式 */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-4">
          <div>
            <p className="text-sm font-medium text-slate-900">凭证字模式</p>
            <p className="text-xs text-slate-500">分类模式：收款用「收」、付款用「付」、转账用「记」，各自独立编号</p>
          </div>
          <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
            <button
              onClick={() => onChange({ ...data, useClassifiedWords: false })}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${!data.useClassifiedWords ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              统一凭证字
            </button>
            <button
              onClick={() => onChange({ ...data, useClassifiedWords: true })}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${data.useClassifiedWords ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              分类凭证字
            </button>
          </div>
        </div>

        {!data.useClassifiedWords ? (
          /* 统一模式 */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>凭证字</Label>
              <select
                value={data.voucherWord}
                onChange={(e) => onChange({ ...data, voucherWord: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="记">记（记账凭证）</option>
                <option value="收">收（收款凭证）</option>
                <option value="付">付（付款凭证）</option>
                <option value="转">转（转账凭证）</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>编号周期</Label>
              <select
                value={data.voucherNoPeriod}
                onChange={(e) => onChange({ ...data, voucherNoPeriod: e.target.value as 'monthly' | 'yearly' | 'continuous' })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="monthly">按月编号（推荐）</option>
                <option value="yearly">按年编号</option>
                <option value="continuous">连续编号</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>序号位数</Label>
              <select
                value={data.voucherNoDigits}
                onChange={(e) => onChange({ ...data, voucherNoDigits: Number(e.target.value) as 3 | 4 | 5 })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value={3}>3位（001-999）</option>
                <option value={4}>4位（0001-9999）</option>
                <option value={5}>5位（00001-99999）</option>
              </select>
            </div>
          </div>
        ) : (
          /* 分类模式 */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>收款凭证字</Label>
                <Input
                  value={classifiedWords.receipt}
                  onChange={(e) => onChange({ ...data, classifiedWords: { ...classifiedWords, receipt: e.target.value } })}
                  className="text-center font-medium"
                  maxLength={2}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>付款凭证字</Label>
                <Input
                  value={classifiedWords.payment}
                  onChange={(e) => onChange({ ...data, classifiedWords: { ...classifiedWords, payment: e.target.value } })}
                  className="text-center font-medium"
                  maxLength={2}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>转账凭证字</Label>
                <Input
                  value={classifiedWords.general}
                  onChange={(e) => onChange({ ...data, classifiedWords: { ...classifiedWords, general: e.target.value } })}
                  className="text-center font-medium"
                  maxLength={2}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>编号周期</Label>
                <select
                  value={data.voucherNoPeriod}
                  onChange={(e) => onChange({ ...data, voucherNoPeriod: e.target.value as 'monthly' | 'yearly' | 'continuous' })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="monthly">按月编号（推荐）</option>
                  <option value="yearly">按年编号</option>
                  <option value="continuous">连续编号</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>序号位数</Label>
                <select
                  value={data.voucherNoDigits}
                  onChange={(e) => onChange({ ...data, voucherNoDigits: Number(e.target.value) as 3 | 4 | 5 })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value={3}>3位（001-999）</option>
                  <option value={4}>4位（0001-9999）</option>
                  <option value={5}>5位（00001-99999）</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">编号格式预览</p>
              {data.useClassifiedWords ? (
                <div className="space-y-1">
                  <p className="text-sm font-mono">
                    <span className="text-green-700">{classifiedWords.receipt}-</span>
                    <span className="text-slate-700">{data.voucherNoPeriod === 'monthly' ? (data.enableDate || 'YYYYMM') : data.voucherNoPeriod === 'yearly' ? (data.enableDate?.substring(0, 4) || 'YYYY') : ''}-{'0'.repeat(data.voucherNoDigits - 1)}1</span>
                    <span className="text-xs text-slate-400 ml-2">收款</span>
                  </p>
                  <p className="text-sm font-mono">
                    <span className="text-red-700">{classifiedWords.payment}-</span>
                    <span className="text-slate-700">{data.voucherNoPeriod === 'monthly' ? (data.enableDate || 'YYYYMM') : data.voucherNoPeriod === 'yearly' ? (data.enableDate?.substring(0, 4) || 'YYYY') : ''}-{'0'.repeat(data.voucherNoDigits - 1)}1</span>
                    <span className="text-xs text-slate-400 ml-2">付款</span>
                  </p>
                  <p className="text-sm font-mono">
                    <span className="text-blue-700">{classifiedWords.general}-</span>
                    <span className="text-slate-700">{data.voucherNoPeriod === 'monthly' ? (data.enableDate || 'YYYYMM') : data.voucherNoPeriod === 'yearly' ? (data.enableDate?.substring(0, 4) || 'YYYY') : ''}-{'0'.repeat(data.voucherNoDigits - 1)}1</span>
                    <span className="text-xs text-slate-400 ml-2">转账</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm font-mono text-slate-700">
                  {data.voucherWord}-
                  {data.voucherNoPeriod === 'monthly' ? (data.enableDate || 'YYYYMM') : data.voucherNoPeriod === 'yearly' ? (data.enableDate?.substring(0, 4) || 'YYYY') : ''}
                  -{'0'.repeat(data.voucherNoDigits - 1)}1
                </p>
              )}
            </div>
            {lastVoucherFullNo && (
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">当前最后编号</p>
                <p className="text-sm font-mono text-blue-600">{lastVoucherFullNo}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {data.voucherNoPeriod === 'monthly' && '每月从1开始重新编号'}
            {data.voucherNoPeriod === 'yearly' && '每年从1开始重新编号'}
            {data.voucherNoPeriod === 'continuous' && '永不重置，持续递增'}
          </p>
        </div>
      </div>
    </div>
  );
}
