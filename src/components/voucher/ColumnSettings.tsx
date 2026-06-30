'use client';

import * as React from 'react';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';

// 所有可显示的字段
const COLUMN_FIELDS = [
  { id: 'summary', label: '摘要', defaultVisible: true },
  { id: 'subjectCode', label: '科目编码', defaultVisible: true },
  { id: 'subjectName', label: '科目名称', defaultVisible: true },
  { id: 'debit', label: '借方', defaultVisible: true },
  { id: 'credit', label: '贷方', defaultVisible: true },
  { id: 'deptCode', label: '部门', defaultVisible: true },
  { id: 'projectCode', label: '项目', defaultVisible: true },
  { id: 'customerCode', label: '客户', defaultVisible: true },
  { id: 'supplierCode', label: '供应商', defaultVisible: false },
  { id: 'operation', label: '操作', defaultVisible: true },
];

interface ColumnSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Record<string, boolean>) => void;
}

export function ColumnSettings({ isOpen, onClose, onSave }: ColumnSettingsProps) {
  // 从 localStorage 读取设置
  const [visibleFields, setVisibleFields] = React.useState<Record<string, boolean>>(() => {
    // Only access localStorage on client side
    if (typeof window === 'undefined') {
      return COLUMN_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: f.defaultVisible }), {});
    }

    const saved = localStorage.getItem('voucher-column-settings');
    return saved ? JSON.parse(saved) : COLUMN_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: f.defaultVisible }), {});
  });

  const toggleField = (fieldId: string) => {
    setVisibleFields(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const handleSave = () => {
    localStorage.setItem('voucher-column-settings', JSON.stringify(visibleFields));
    onSave(visibleFields);
    onClose();
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          const newIsOpen = !isOpen;
          if (!newIsOpen) {
            setVisibleFields(JSON.parse(localStorage.getItem('voucher-column-settings') || '{}'));
          }
        }}
        className="p-1.5 hover:bg-slate-100 rounded-md"
      >
        <Settings className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 w-72 bg-white border border-slate-200 rounded-md shadow-lg mt-1">
          <div className="p-4">
            <h3 className="font-semibold text-sm mb-3">列显示设置</h3>

            <div className="space-y-2">
              {COLUMN_FIELDS.map((field) => (
                <div key={field.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{field.label}</span>
                  <Switch
                    checked={visibleFields[field.id]}
                    onCheckedChange={() => toggleField(field.id)}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}