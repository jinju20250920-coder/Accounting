'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Building2, FileText, MapPin, Coins } from 'lucide-react';

interface SetupStepCompanyProps {
  data: {
    name: string;
    code: string;
    unifiedSocialCreditCode: string;
    taxNo: string;
    address: string;
    baseCurrency: string;
    accountingStandard: 'small-enterprise' | 'enterprise' | 'other';
    enableDate: string;
    startDate: string;
  };
  onChange: (data: SetupStepCompanyProps['data']) => void;
  accountSetId: string;
}

export function SetupStepCompany({ data, onChange }: SetupStepCompanyProps) {
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
          <Label>统一社会信用代码</Label>
            <Input
              value={data.unifiedSocialCreditCode}
              onChange={(e) => onChange({ ...data, unifiedSocialCreditCode: e.target.value, taxNo: e.target.value })}
              placeholder="91110000XXXXXXXXXX"
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
              onChange={(e) => onChange({ ...data, accountingStandard: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="small-enterprise">小企业会计准则</option>
              <option value="enterprise">企业会计准则</option>
              <option value="other">其他</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
