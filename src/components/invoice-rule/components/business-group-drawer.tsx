// src/components/invoice-rule/components/business-group-drawer.tsx

import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BusinessGroupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (group: any) => void;
  defaultValues?: any;
}

// 预设的合作伙伴类型选项
const PRESET_PARTNER_TYPES = ['供应商', '客户', '员工', '其他'];

// 常用变量列表
const COMMON_VARIABLES = [
  { name: '税率', value: '{{税率}}', color: 'bg-blue-100 text-blue-700' },
  { name: '供应商', value: '{{供应商}}', color: 'bg-green-100 text-green-700' },
  { name: '商品类型', value: '{{商品类型}}', color: 'bg-purple-100 text-purple-700' },
];

export function BusinessGroupDrawer({
  open,
  onOpenChange,
  onSave,
  defaultValues,
}: BusinessGroupDrawerProps) {
  const [formData, setFormData] = useState({
    name: '',
    debitSubject: '',
    debitSubjectName: '',
    taxSubject: '2221.01.{{税率}}',
    creditSubject: '',
    creditSubjectName: '',
    partnerType: '供应商',
    customPartnerType: '',
    assetThreshold: 5000,
    description: '',
    isPreset: false,
    autoTax: true,
    keywords: [] as string[],
    keywordInput: '',
  });

  const [showCustomPartnerType, setShowCustomPartnerType] = useState(false);

  useEffect(() => {
    if (open && defaultValues) {
      const isCustomPartnerType = !PRESET_PARTNER_TYPES.includes(defaultValues.partnerType);
      setFormData({
        name: defaultValues.name || '',
        debitSubject: defaultValues.debitSubject || '',
        debitSubjectName: defaultValues.debitSubjectName || '',
        taxSubject: defaultValues.taxSubject || '2221.01.{{税率}}',
        creditSubject: defaultValues.creditSubject || '',
        creditSubjectName: defaultValues.creditSubjectName || '',
        partnerType: isCustomPartnerType ? '其他' : defaultValues.partnerType,
        customPartnerType: isCustomPartnerType ? defaultValues.partnerType : '',
        assetThreshold: defaultValues.assetThreshold ?? 5000,
        description: defaultValues.description || '',
        isPreset: defaultValues.isPreset || false,
        autoTax: defaultValues.autoTax !== false,
        keywords: defaultValues.keywords || [],
        keywordInput: '',
      });
      setShowCustomPartnerType(isCustomPartnerType);
    } else if (open) {
      // 重置表单用于新增
      setFormData({
        name: '',
        debitSubject: '',
        debitSubjectName: '',
        taxSubject: '2221.01.{{税率}}',
        creditSubject: '',
        creditSubjectName: '',
        partnerType: '供应商',
        customPartnerType: '',
        assetThreshold: 5000,
        description: '',
        isPreset: false,
        autoTax: true,
        keywords: [],
        keywordInput: '',
      });
      setShowCustomPartnerType(false);
    }
  }, [open, defaultValues]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }

    const finalPartnerType = showCustomPartnerType ? formData.customPartnerType.trim() : formData.partnerType;

    onSave({
      name: formData.name.trim(),
      debitSubject: formData.debitSubject,
      debitSubjectName: formData.debitSubjectName,
      taxSubject: formData.taxSubject,
      creditSubject: formData.creditSubject,
      creditSubjectName: formData.creditSubjectName,
      partnerType: finalPartnerType,
      assetThreshold: formData.assetThreshold,
      description: formData.description,
      isPreset: formData.isPreset,
      autoTax: formData.autoTax,
      keywords: formData.keywords,
    });
    onOpenChange(false);
  };

  const handlePartnerTypeChange = (value: string) => {
    if (value === '其他') {
      setShowCustomPartnerType(true);
      setFormData(prev => ({ ...prev, partnerType: value }));
    } else {
      setShowCustomPartnerType(false);
      setFormData(prev => ({ ...prev, partnerType: value, customPartnerType: '' }));
    }
  };

  const handleAddKeyword = () => {
    if (formData.keywordInput.trim() && !formData.keywords.includes(formData.keywordInput.trim())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, prev.keywordInput.trim()],
        keywordInput: '',
      }));
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword),
    }));
  };

  // 插入变量到税金科目
  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      taxSubject: prev.taxSubject + variable,
    }));
  };

  // 计算实时预览的凭证分录
  const getPreviewEntries = () => {
    const entries = [];

    if (formData.debitSubject) {
      entries.push({
        subject: formData.debitSubject,
        subjectName: formData.debitSubjectName || formData.debitSubject,
        debit: 1000.00, // 示例金额
        credit: 0,
      });
    }

    if (formData.taxSubject) {
      // 计算示例税额
      const taxAmount = 130.00;
      entries.push({
        subject: formData.taxSubject,
        subjectName: '税金科目',
        debit: taxAmount,
        credit: 0,
      });
    }

    if (formData.creditSubject) {
      // 计算贷方总金额
      const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
      entries.push({
        subject: formData.creditSubject,
        subjectName: formData.creditSubjectName || formData.creditSubject,
        debit: 0,
        credit: totalDebit,
      });
    }

    return entries;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>
            {defaultValues ? '编辑业务组' : '自定义业务组'}
          </DrawerTitle>
          <DrawerDescription>
            灵活配置业务组，支持完全自定义类型和参数设置
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* 双栏栅格布局 */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {/* 第一行：业务组名称 + 合作伙伴类型 */}
            <div>
              <Label className="text-xs" required>业务组名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：办公用品采购"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">合作伙伴类型</Label>
              <Select
                value={formData.partnerType}
                onValueChange={handlePartnerTypeChange}
              >
                <SelectTrigger className="h-8 w-full mt-1">
                  <SelectValue placeholder="选择合作伙伴类型" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_PARTNER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 自定义合作伙伴类型 */}
            {showCustomPartnerType && (
              <div className="col-span-2">
                <Label className="text-xs" required>自定义类型名称</Label>
                <Input
                  value={formData.customPartnerType}
                  onChange={(e) => setFormData(prev => ({ ...prev, customPartnerType: e.target.value }))}
                  placeholder="例如：服务商、承包商、代理商等"
                  className="h-8 text-sm mt-1"
                />
              </div>
            )}

            {/* 第二行：业务组描述（跨两栏） */}
            <div className="col-span-2">
              <Label className="text-xs">业务组描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="描述这个业务组的用途，例如：用于公司日常办公用品采购的发票处理"
                className="h-16 text-sm mt-1 resize-none"
              />
            </div>

            {/* 第三、四行：核心科目逻辑 */}
            <div className="space-y-4">
              {/* 借方科目 */}
              <div>
                <Label className="text-xs" required>借方科目</Label>
                <Input
                  value={formData.debitSubject}
                  onChange={(e) => setFormData(prev => ({ ...prev, debitSubject: e.target.value }))}
                  placeholder="例如：1403 原材料"
                  className="h-8 text-sm mt-1"
                />
              </div>

              {/* 税金科目（紧接借方下方） */}
              <div className="border-l-2 border-blue-200 pl-4 -ml-1">
                <Label className="text-xs">税金科目</Label>
                <div className="relative mt-1">
                  <Input
                    value={formData.taxSubject}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxSubject: e.target.value }))}
                    placeholder="例如：2221.01.{{税率}}"
                    className="h-8 text-sm pr-10"
                  />
                  <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                    <Switch
                      checked={formData.autoTax}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoTax: checked }))}
                      className="h-4 w-8"
                    />
                  </div>
                </div>
                {/* 常用变量选择器 */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {COMMON_VARIABLES.map((variable) => (
                    <Button
                      key={variable.name}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => insertVariable(variable.value)}
                    >
                      {variable.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 关键词关联 */}
              <div className="pt-2">
                <Label className="text-xs">关联关键词</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.keywordInput}
                    onChange={(e) => setFormData(prev => ({ ...prev, keywordInput: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    placeholder="输入关键词，按Enter添加"
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddKeyword}
                    className="h-8 px-3"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：贷方科目 */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs" required>贷方科目</Label>
                <Input
                  value={formData.creditSubject}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditSubject: e.target.value }))}
                  placeholder="例如：2202 应付账款"
                  className="h-8 text-sm mt-1"
                />
              </div>

              {/* 固定资产阈值（仅当供应商类型时显示） */}
              {(showCustomPartnerType ? formData.customPartnerType : formData.partnerType) === '供应商' && (
                <div>
                  <Label className="text-xs">固定资产阈值（元）</Label>
                  <Input
                    type="number"
                    value={formData.assetThreshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, assetThreshold: Number(e.target.value) }))}
                    placeholder="5000"
                    className="h-8 text-sm mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    超过此金额的采购自动识别为固定资产
                  </p>
                </div>
              )}

              {/* 系统预设标识 */}
              {formData.isPreset && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">系统预设</span>
                  <p className="text-xs text-purple-600 mt-2">此业务组为系统预设，建议保留以获得最佳匹配效果</p>
                </div>
              )}
            </div>
          </div>

          {/* 凭证预览（底部全宽） */}
          <div className="mt-8">
            <h4 className="font-medium text-sm mb-3">凭证预览</h4>
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 text-sm">
                {getPreviewEntries().map((entry, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 items-center">
                    <div className="col-span-1 text-right text-xs text-slate-500">
                      {entry.debit > 0 ? '借' : '贷'}
                    </div>
                    <div className="col-span-2">
                      <div className="font-medium">{entry.subject || '(未选择)'}</div>
                      <div className="text-xs text-slate-500">{entry.subjectName}</div>
                    </div>
                    <div className="col-span-1 text-right font-medium">
                      {entry.debit > 0 ? entry.debit.toFixed(2) : entry.credit.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                * 预览显示将根据实际业务数据动态调整
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>
            {defaultValues ? '更新业务组' : '保存业务组'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
