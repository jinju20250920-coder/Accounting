'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ExternalLink } from 'lucide-react';
import type { FixedAsset, AssetChangeRecord } from '@/types';

interface AssetChangeRecordListProps {
  asset: FixedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewVoucher?: (voucherId: string) => void;
}

const changeTypeLabels: Record<string, { label: string; color: string }> = {
  acquisition: { label: '取得', color: 'bg-blue-100 text-blue-700' },
  depreciation: { label: '折旧', color: 'bg-green-100 text-green-700' },
  improvement: { label: '改造', color: 'bg-purple-100 text-purple-700' },
  disposal: { label: '处置', color: 'bg-red-100 text-red-700' },
  transfer: { label: '调拨', color: 'bg-amber-100 text-amber-700' },
  status_change: { label: '状态变更', color: 'bg-slate-100 text-slate-700' },
};

export function AssetChangeRecordList({
  asset,
  open,
  onOpenChange,
  onViewVoucher,
}: AssetChangeRecordListProps) {
  const [records, setRecords] = useState<AssetChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && asset) {
      loadRecords();
    }
  }, [open, asset]);

  const loadRecords = async () => {
    if (!asset) return;

    setLoading(true);
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (!db) return;

      const result = db.exec(
        `SELECT * FROM assetChangeRecords WHERE assetId = ? ORDER BY createTime DESC`,
        [asset.id]
      );

      const loadedRecords: AssetChangeRecord[] = result[0]?.values?.map((row: any[]) => ({
        id: row[0],
        assetId: row[1],
        assetCode: row[2],
        assetName: row[3],
        accountSetId: row[4],
        changeType: row[5],
        changeDate: row[6],
        period: row[7],
        fieldName: row[8],
        beforeValue: row[9],
        afterValue: row[10],
        voucherId: row[11],
        voucherNo: row[12],
        reason: row[13],
        operatorId: row[14],
        createTime: row[15],
      })) || [];

      setRecords(loadedRecords);
    } catch (error) {
      console.error('加载变动记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500" />
            资产变动记录
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
            <span>
              <span className="text-slate-500">资产编码：</span>
              <span className="font-medium">{asset.assetCode}</span>
            </span>
            <span>
              <span className="text-slate-500">资产名称：</span>
              <span>{asset.assetName}</span>
            </span>
          </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-slate-500">
                加载中...
              </div>
            ) : records.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-500">
                暂无变动记录
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => {
                  const typeInfo = changeTypeLabels[record.changeType] || {
                    label: record.changeType,
                    color: 'bg-slate-100 text-slate-700',
                  };

                  return (
                    <div
                      key={record.id}
                      className="p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                          <span className="text-sm text-slate-500">
                            {record.changeDate}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({record.period})
                          </span>
                        </div>
                        {record.voucherNo && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-blue-600"
                            onClick={() => record.voucherId && onViewVoucher?.(record.voucherId)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {record.voucherNo}
                          </Button>
                        )}
                      </div>

                      <div className="mt-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">字段：</span>
                          <span className="font-medium">{record.fieldName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-slate-500">变更：</span>
                          <span className="text-red-600 line-through">{record.beforeValue}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-green-600">{record.afterValue}</span>
                        </div>
                        {record.reason && (
                          <div className="mt-1 text-slate-500">
                            原因：{record.reason}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-xs text-slate-400">
                        {new Date(record.createTime).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AssetChangeRecordList;
