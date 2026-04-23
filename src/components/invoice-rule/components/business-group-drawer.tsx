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
import { SubjectVariableInput } from './subject-variable-input';

interface BusinessGroupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (group: any) => void;
  defaultValues?: any;
}

// 预设的合作伙伴类型选项
const PRESET_PARTNER_TYPES = ['供应商', '客户', '员工', '其他'];

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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>
            {defaultValues ? '编辑业务组' : '自定义业务组'}
          </DrawerTitle>
          <DrawerDescription>
            灵活配置业务组，支持完全自定义类型和参数设置
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6 p-6 max-h-[70vh] overflow-y-auto">
          {/* 基本信息 */}
          <section>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              基本信息
              {formData.isPreset && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">系统预设</span>
              )}
            </h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs" required>业务组名称</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：办公用品采购、IT设备租赁、差旅费报销等"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">业务组描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述这个业务组的用途，例如：用于公司日常办公用品采购的发票处理"
                  className="h-20 text-sm mt-1 resize-none"
                />
              </div>
            </div>
          </section>

          {/* 合作伙伴类型 */}
          <section>
            <h4 className="font-medium text-sm mb-3">合作伙伴类型</h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">选择类型</Label>
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
              {showCustomPartnerType && (
                <div>
                  <Label className="text-xs" required>自定义类型名称</Label>
                  <Input
                    value={formData.customPartnerType}
                    onChange={(e) => setFormData(prev => ({ ...prev, customPartnerType: e.target.value }))}
                    placeholder="例如：服务商、承包商、代理商等"
                    className="h-8 text-sm mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    输入自定义的合作伙伴类型名称
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 会计科目模板 */}
          <section>
            <h4 className="font-medium text-sm mb-3">会计科目模板</h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs" required>借方科目</Label>
                <Input
                  value={formData.debitSubject}
                  onChange={(e) => setFormData(prev => ({ ...prev, debitSubject: e.target.value }))}
                  placeholder="例如：1403 原材料"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">税金科目</Label>
                <SubjectVariableInput
                  value={formData.taxSubject}
                  onChange={(value) => setFormData(prev => ({ ...prev, taxSubject: value }))}
                  placeholder="例如：2221.01.{{税率}}"
                  className="text-sm"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">自动匹配税率</span>
                  <Switch
                    checked={formData.autoTax}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoTax: checked }))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs" required>贷方科目</Label>
                <Input
                  value={formData.creditSubject}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditSubject: e.target.value }))}
                  placeholder="例如：2202 应付账款"
                  className="h-8 text-sm mt-1"
                />
              </div>
            </div>
          </section>

          {/* 特殊设置 */}
          <section>
            <h4 className="font-medium text-sm mb-3">特殊设置</h4>
            <div className="space-y-3">
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

              {/* 关键词关联 */}
              <div>
                <Label className="text-xs">关联关键词</Label>
                <p className="text-xs text-slate-500 mb-2">
                  添加与该业务组相关的关键词，用于发票智能匹配
                </p>
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
          </section>

          {/* 凭证预览 */}
          <section>
            <h4 className="font-medium text-sm mb-3">凭证预览</h4>
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500 mb-1">借方</div>
                  <div className="font-medium">{formData.debitSubject || '(未选择)'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">贷方</div>
                  <div className="font-medium">{formData.creditSubject || '(未选择)'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-500 mb-1">税金科目</div>
                  <div className="font-medium">{formData.taxSubject || '(未设置)'}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                * 预览显示将根据实际业务数据动态调整
              </div>
            </div>
          </section>
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
