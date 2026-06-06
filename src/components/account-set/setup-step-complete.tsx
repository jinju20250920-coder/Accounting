'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Building2,
  LayoutTemplate,
  Scale,
  Landmark,
  Sliders,
  PartyPopper,
} from 'lucide-react';
import type { SetupProgress } from './setup-wizard';
import { INDUSTRY_TEMPLATES } from '@/lib/data/industry-templates';

interface SetupStepCompleteProps {
  progress: SetupProgress;
  companyData: {
    name: string;
    code: string;
    baseCurrency: string;
    accountingStandard: string;
    enableDate: string;
  };
  selectedTemplate: string | null;
}

const STEP_CONFIG = [
  { id: 'company', label: '公司信息', icon: Building2 },
  { id: 'template', label: '行业模板', icon: LayoutTemplate },
  { id: 'opening', label: '期初余额', icon: Scale },
  { id: 'bank', label: '银行账户', icon: Landmark },
  { id: 'rules', label: '业务规则', icon: Sliders },
];

export function SetupStepComplete({ progress, companyData, selectedTemplate }: SetupStepCompleteProps) {
  const template = selectedTemplate ? INDUSTRY_TEMPLATES.find(t => t.id === selectedTemplate) : null;

  const rulesDetail = [
    { label: '税务配置', done: progress.taxConfigured },
    { label: '工资社保', done: progress.payrollConfigured },
    { label: '固定资产', done: progress.assetConfigured },
    { label: '发票业务组', done: progress.invoiceRulesConfigured },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <PartyPopper className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">设置完成！</h2>
        <p className="text-sm text-slate-500 mt-1">您的账套已准备就绪，可以开始使用了</p>
      </div>

      {/* Summary */}
      <div className="border rounded-lg divide-y">
        <div className="p-4">
          <h3 className="font-medium text-slate-900 mb-2">账套信息</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-500">名称：</span>
              <span className="font-medium">{companyData.name}</span>
            </div>
            <div>
              <span className="text-slate-500">编码：</span>
              <span className="font-medium">{companyData.code}</span>
            </div>
            <div>
              <span className="text-slate-500">本位币：</span>
              <span className="font-medium">{companyData.baseCurrency}</span>
            </div>
            <div>
              <span className="text-slate-500">启用年月：</span>
              <span className="font-medium">{companyData.enableDate}</span>
            </div>
            <div>
              <span className="text-slate-500">会计准则：</span>
              <span className="font-medium">
                {companyData.accountingStandard === 'small-enterprise' ? '小企业会计准则'
                  : companyData.accountingStandard === 'enterprise' ? '企业会计准则' : '其他'}
              </span>
            </div>
            {template && (
              <div>
                <span className="text-slate-500">行业模板：</span>
                <span className="font-medium">{template.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-medium text-slate-900 mb-3">设置进度</h3>
          <div className="space-y-2">
            {STEP_CONFIG.map((step) => {
              const isCompleted = progress.completed.includes(step.id);
              const isSkipped = progress.skippedOptional.includes(step.id);
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : isSkipped ? (
                    <Icon className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Icon className="h-4 w-4 text-slate-300" />
                  )}
                  <span className={`text-sm ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  {isCompleted && (
                    <Badge className="bg-green-50 text-green-600 text-xs">已完成</Badge>
                  )}
                  {isSkipped && (
                    <Badge className="bg-slate-50 text-slate-400 text-xs">已跳过</Badge>
                  )}

                  {/* Show rules sub-items detail */}
                  {step.id === 'rules' && isCompleted && (
                    <div className="flex gap-1 ml-2">
                      {rulesDetail.filter(r => r.done).map(r => (
                        <Badge key={r.label} className="bg-blue-50 text-blue-600 text-xs">{r.label}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-medium mb-1">下一步建议</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          {!progress.invoiceRulesConfigured && (
            <li>在「设置 → 发票规则」中配置发票业务组和税金科目</li>
          )}
          {!progress.payrollConfigured && (
            <li>在「工资管理」中配置社保公积金费率</li>
          )}
          <li>在「设置 → 往来单位」中导入客户和供应商</li>
          <li>开始录入凭证，或导入银行流水自动生成凭证</li>
        </ul>
      </div>
    </div>
  );
}
