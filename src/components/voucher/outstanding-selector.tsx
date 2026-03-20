'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Check, X, ChevronRight } from 'lucide-react';
import { useAccountStore } from '@/stores/useAccountStore';

// 未结清单据项
interface OutstandingItem {
  entryId: string;
  voucherNo: string;
  docNo: string;
  date: string;
  summary: string;
  amount: number;
  remainingAmount: number;
  direction: 'debit' | 'credit';
  partnerName?: string;
}

// 未结清单据查询参数
interface OutstandingQuery {
  partnerName: string;
  subjectCode?: string;
  startDate?: string;
  endDate?: string;
  amountRange?: [number, number];
}

interface OutstandingSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  onSelect: (items: OutstandingItem[]) => void;
}

export function OutstandingSelector({
  isOpen,
  onClose,
  partnerName,
  onSelect
}: OutstandingSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OutstandingItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useState<OutstandingQuery>({
    partnerName,
    subjectCode: '',
    startDate: '',
    endDate: '',
    amountRange: [0, Infinity]
  });

  const { getOutstandingItems } = useAccountStore();

  useEffect(() => {
    if (isOpen && partnerName) {
      loadOutstandingItems();
    }
  }, [isOpen, partnerName]);

  const loadOutstandingItems = async () => {
    setLoading(true);
    try {
      const results = await getOutstandingItems(searchParams);
      setItems(results);
      setSelectedItems([]);
    } catch (error) {
      console.error('加载未结清单据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleConfirm = () => {
    const selected = items.filter(item => selectedItems.includes(item.entryId));
    onSelect(selected);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>选择未结清单据</DialogTitle>
        </DialogHeader>

        <div className="p-4 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="科目代码"
              value={searchParams.subjectCode || ''}
              onChange={(e) => setSearchParams(prev => ({
                ...prev,
                subjectCode: e.target.value
              }))}
            />
            <Input
              type="date"
              placeholder="开始日期"
              value={searchParams.startDate}
              onChange={(e) => setSearchParams(prev => ({
                ...prev,
                startDate: e.target.value
              }))}
            />
            <Input
              type="date"
              placeholder="结束日期"
              value={searchParams.endDate}
              onChange={(e) => setSearchParams(prev => ({
                ...prev,
                endDate: e.target.value
              }))}
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="最小金额"
                value={searchParams.amountRange![0]}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  amountRange: [parseFloat(e.target.value) || 0, prev.amountRange![1]]
                }))}
                step="0.01"
              />
              <Input
                type="number"
                placeholder="最大金额"
                value={searchParams.amountRange![1]}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  amountRange: [prev.amountRange![0], parseFloat(e.target.value) || Infinity]
                }))}
                step="0.01"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={loadOutstandingItems} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              查询
            </Button>
            <Button variant="outline" onClick={() => setSearchParams({
              partnerName,
              subjectCode: '',
              startDate: '',
              endDate: '',
              amountRange: [0, Infinity]
            })}>
              <X className="w-4 h-4 mr-2" />
              清空
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedItems.length === items.length && items.length > 0}
                onCheckedChange={() => selectedItems.length === items.length
                  ? setSelectedItems([])
                  : setSelectedItems(items.map(item => item.entryId))
                }
              />
              <span className="text-sm text-slate-600">
                已选 {selectedItems.length} / {items.length} 条
              </span>
            </div>
            <div className="text-sm text-slate-600">
              总金额:
              {items
                .filter(item => selectedItems.includes(item.entryId))
                .reduce((sum, item) => sum + item.remainingAmount, 0)
                .toFixed(2)}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th className="w-12 p-2 text-center text-sm font-medium border-r border-slate-300"></th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">凭证号</th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">单据号</th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">日期</th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">摘要</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">金额</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">剩余金额</th>
                  <th className="p-2 text-left text-sm font-medium">方向</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">
                      加载中...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      没有找到未结清单据
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.entryId}
                      className={selectedItems.includes(item.entryId) ? 'bg-blue-50' : ''}
                    >
                      <td className="p-2 text-center border-r border-slate-300">
                        <Checkbox
                          checked={selectedItems.includes(item.entryId)}
                          onCheckedChange={() => handleSelect(item.entryId)}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">{item.voucherNo}</td>
                      <td className="p-2 border-r border-slate-300">{item.docNo}</td>
                      <td className="p-2 border-r border-slate-300">{item.date}</td>
                      <td className="p-2 border-r border-slate-300">{item.summary}</td>
                      <td className="p-2 text-right border-r border-slate-300">{item.amount.toFixed(2)}</td>
                      <td className="p-2 text-right text-red-600 border-r border-slate-300">
                        {item.remainingAmount.toFixed(2)}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.direction === 'debit'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.direction === 'debit' ? '借方' : '贷方'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedItems.length === 0}
          >
            <Check className="w-4 h-4 mr-2" />
            确认核销
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
