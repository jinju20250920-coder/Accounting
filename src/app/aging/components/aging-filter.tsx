'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import type { AgingMode } from '@/lib/accounting';

interface AgingFilterProps {
  mode: AgingMode;
  onModeChange: (mode: AgingMode) => void;
  asOfDate: string;
  onAsOfDateChange: (date: string) => void;
  customBuckets?: number[];
  onCustomBucketsChange?: (buckets: number[]) => void;
  useCustomBuckets?: boolean;
  onUseCustomBucketsChange?: (use: boolean) => void;
}

export function AgingFilter({
  mode,
  onModeChange,
  asOfDate,
  onAsOfDateChange,
  customBuckets = [30, 90, 180, 365, 730],
  onCustomBucketsChange,
  useCustomBuckets = false,
  onUseCustomBucketsChange
}: AgingFilterProps) {
  const handleBucketChange = (index: number, value: string) => {
    const newBuckets = [...customBuckets];
    const numValue = value ? parseInt(value) : 0;
    newBuckets[index] = numValue;
    // 不自动排序，让用户自由定义区间
    onCustomBucketsChange?.(newBuckets);
  };

  // 生成区间标签用于显示
  const getBucketLabel = (index: number) => {
    if (index === 0) {
      return `0-${customBuckets[0]}天`;
    }
    if (index === customBuckets.length) {
      return `${customBuckets[customBuckets.length - 1]}天以上`;
    }
    return `${customBuckets[index - 1] + 1}-${customBuckets[index]}天`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Label>账龄刻度:</Label>
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value as AgingMode)}
              className="border rounded p-2 text-sm"
            >
              <option value="month">按月</option>
              <option value="year">按年</option>
              <option value="day">按天</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Label>截止日期:</Label>
            <ChineseDatePicker
              value={asOfDate}
              onChange={(v) => onAsOfDateChange(v)}
              className="w-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label>自定义区间:</Label>
            <input
              type="checkbox"
              checked={useCustomBuckets}
              onChange={(e) => onUseCustomBucketsChange?.(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </div>
        </div>

        {useCustomBuckets && (
          <div className="mt-4 space-y-4">
            <div className="text-sm text-gray-600 mb-2">
              设置5个区间的截止天数（支持任意区间段）
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label>区间1截止:</Label>
                <Input
                  type="number"
                  value={customBuckets[0]}
                  onChange={(e) => handleBucketChange(0, e.target.value)}
                  placeholder="30"
                  className="w-full"
                />
                <div className="text-xs text-gray-500">{getBucketLabel(0)}</div>
              </div>
              <div className="space-y-1">
                <Label>区间2截止:</Label>
                <Input
                  type="number"
                  value={customBuckets[1]}
                  onChange={(e) => handleBucketChange(1, e.target.value)}
                  placeholder="90"
                  className="w-full"
                />
                <div className="text-xs text-gray-500">{getBucketLabel(1)}</div>
              </div>
              <div className="space-y-1">
                <Label>区间3截止:</Label>
                <Input
                  type="number"
                  value={customBuckets[2]}
                  onChange={(e) => handleBucketChange(2, e.target.value)}
                  placeholder="180"
                  className="w-full"
                />
                <div className="text-xs text-gray-500">{getBucketLabel(2)}</div>
              </div>
              <div className="space-y-1">
                <Label>区间4截止:</Label>
                <Input
                  type="number"
                  value={customBuckets[3]}
                  onChange={(e) => handleBucketChange(3, e.target.value)}
                  placeholder="365"
                  className="w-full"
                />
                <div className="text-xs text-gray-500">{getBucketLabel(3)}</div>
              </div>
              <div className="space-y-1">
                <Label>区间5截止:</Label>
                <Input
                  type="number"
                  value={customBuckets[4]}
                  onChange={(e) => handleBucketChange(4, e.target.value)}
                  placeholder="730"
                  className="w-full"
                />
                <div className="text-xs text-gray-500">{getBucketLabel(4)}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              最后区间: {getBucketLabel(customBuckets.length)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
