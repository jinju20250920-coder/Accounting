'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useVoucherTemplateStore } from '@/stores';

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string, loadAmounts: boolean) => void;
}

export function TemplateSelector({
  open,
  onClose,
  onSelectTemplate
}: TemplateSelectorProps) {
  const { templates } = useVoucherTemplateStore();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loadAmounts, setLoadAmounts] = useState(false);

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate, loadAmounts);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>选择凭证模板</DialogTitle>
          <DialogDescription>
            选择一个模板来快速创建凭证
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.map(template => (
              <button
                key={template.id}
                className={`w-full p-4 border rounded-lg text-left transition-colors ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="font-medium">{template.name}</div>
                {template.description && (
                  <div className="text-sm text-slate-500 mt-1">
                    {template.description}
                  </div>
                )}
                <div className="text-xs text-slate-400 mt-2">
                  {template.entries.length} 条分录
                </div>
              </button>
            ))}
          </div>

          {/* Loading options */}
          <div className="border-t pt-4">
            <Label className="font-medium mb-2 block">加载选项</Label>
            <RadioGroup
              defaultValue="no-amounts"
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="no-amounts"
                  id="no-amounts"
                  onClick={() => setLoadAmounts(false)}
                />
                <Label htmlFor="no-amounts">
                  不加载金额（仅加载摘要、科目、部门、项目等）
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="with-amounts"
                  id="with-amounts"
                  onClick={() => setLoadAmounts(true)}
                />
                <Label htmlFor="with-amounts">
                  完全加载（加载所有信息，包括金额）
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTemplate}
          >
            确认导入
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
