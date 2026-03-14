'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Department, Project } from '@/types';

interface AuxiliarySelectorProps {
  value: {
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  };
  onChange: (auxiliary: any) => void;
  className?: string;
}

// 模拟数据
const departments: Department[] = [
  { id: '1', code: 'DEPT001', name: '销售部', parentId: null, level: 1, frozen: false },
  { id: '2', code: 'DEPT002', name: '市场部', parentId: null, level: 1, frozen: false },
  { id: '3', code: 'DEPT003', name: '技术部', parentId: null, level: 1, frozen: false },
  { id: '4', code: 'DEPT004', name: '财务部', parentId: null, level: 1, frozen: false },
  { id: '5', code: 'DEPT005', name: '人力部', parentId: null, level: 1, frozen: false },
];

const projects: Project[] = [
  { id: '1', code: 'PRJ001', name: '客户管理系统', type: 'income', parentId: null, level: 1, startDate: '2024-01-01', frozen: false },
  { id: '2', code: 'PRJ002', name: '数据分析平台', type: 'cost', parentId: null, level: 1, startDate: '2024-02-01', frozen: false },
  { id: '3', code: 'PRJ003', name: '移动APP开发', type: 'income', parentId: null, level: 1, startDate: '2024-03-01', frozen: false },
];

const customers = [
  { id: '1', name: '公司A', code: 'CUST001' },
  { id: '2', name: '公司B', code: 'CUST002' },
  { id: '3', name: '公司C', code: 'CUST003' },
];

const suppliers = [
  { id: '1', name: '供应商A', code: 'SUPP001' },
  { id: '2', name: '供应商B', code: 'SUPP002' },
  { id: '3', name: '供应商C', code: 'SUPP003' },
];

export function AuxiliarySelector({ value, onChange, className }: AuxiliarySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'department' | 'project' | 'customer' | 'supplier'>('department');
  const [searchTerm, setSearchTerm] = useState('');

  // 获取当前类型的选项
  const getOptions = () => {
    switch (selectedType) {
      case 'department':
        return departments;
      case 'project':
        return projects;
      case 'customer':
        return customers;
      case 'supplier':
        return suppliers;
      default:
        return [];
    }
  };

  // 过滤选项
  const filteredOptions = getOptions().filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ('code' in option && option.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 处理选择
  const handleSelect = (option: any) => {
    onChange({
      ...value,
      [selectedType]: option.id || option.code
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  // 清除选择
  const handleClear = (type: string) => {
    onChange({
      ...value,
      [type]: undefined
    });
  };

  // 获取选项名称
  const getOptionName = (type: string, id: string) => {
    switch (type) {
      case 'department':
        const dept = departments.find(d => d.id === id);
        return dept?.name;
      case 'project':
        const project = projects.find(p => p.id === id);
        return project?.name;
      case 'customer':
        const customer = customers.find(c => c.code === id);
        return customer?.name;
      case 'supplier':
        const supplier = suppliers.find(s => s.code === id);
        return supplier?.name;
      default:
        return id;
    }
  };

  // 获取类型标签
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'department':
        return { label: '部门', color: 'bg-blue-100 text-blue-800' };
      case 'project':
        return { label: '项目', color: 'bg-green-100 text-green-800' };
      case 'customer':
        return { label: '客户', color: 'bg-purple-100 text-purple-800' };
      case 'supplier':
        return { label: '供应商', color: 'bg-orange-100 text-orange-800' };
      default:
        return { label: '', color: '' };
    }
  };

  return (
    <div className={className}>
      {/* 辅助核算项目选择按钮 */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full justify-between"
      >
        <span>
          {Object.keys(value).length > 0 ? '已选择辅助项目' : '选择辅助核算项目'}
        </span>
        <Badge variant="secondary">
          {Object.keys(value).length}
        </Badge>
      </Button>

      {/* 已选择的辅助项目 */}
      {Object.entries(value).filter(([_, v]) => v).map(([type, id]) => {
        const typeInfo = getTypeLabel(type);
        return (
          <div
            key={type}
            className="mt-2 flex items-center gap-2"
          >
            <Badge className={typeInfo.color}>
              {typeInfo.label}: {getOptionName(type, id)}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleClear(type)}
            >
              ×
            </Button>
          </div>
        );
      })}

      {/* 选择对话框 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择辅助核算项目</DialogTitle>
          </DialogHeader>

          {/* 类型选择 */}
          <div className="flex gap-2 mb-4">
            {(['department', 'project', 'customer', 'supplier'] as const).map(type => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
              >
                {getTypeLabel(type).label}
              </Button>
            ))}
          </div>

          {/* 搜索框 */}
          <Input
            placeholder={`搜索${getTypeLabel(selectedType).label}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />

          {/* 选项列表 */}
          <Command className="max-h-60">
            <CommandInput value={searchTerm} className="hidden" />
            <CommandEmpty>
              未找到匹配的{getTypeLabel(selectedType).label}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map(option => (
                <CommandItem
                  key={option.id || option.code}
                  onSelect={() => handleSelect(option)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.name}</span>
                      {'code' in option && (
                        <span className="text-sm text-slate-500">({option.code})</span>
                      )}
                    </div>
                    {selectedType === 'project' && 'type' in option && (
                      <span className="text-xs text-slate-500">
                        {(option as any).type === 'income' ? '收入类' : '成本类'}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>

          {/* 批量选择提示 */}
          {selectedType === 'department' && (
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-700">
                💡 提示：辅助核算项目可用于精确追踪各部门的费用支出
              </p>
            </div>
          )}

          {selectedType === 'project' && (
            <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
              <p className="text-sm text-green-700">
                💡 提示：项目核算可用于追踪收入和成本的归属
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}