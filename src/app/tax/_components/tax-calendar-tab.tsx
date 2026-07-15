'use client';

import { useMemo, useState } from 'react';
import { useTaxStore } from '@/stores/useTaxStore';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, ChevronRight, X as CloseIcon } from 'lucide-react';
import { getUrgencyConfig, getCurrentTaxDeadlines } from '@/lib/tax-deadlines';
import type { TaxDeadlineAlert } from '@/types';

interface TaxCalendarTabProps {
  onJumpToFiling?: (taxItemId: string, taxPeriod: string) => void;
}

export function TaxCalendarTab({ onJumpToFiling }: TaxCalendarTabProps) {
  // 订阅原始 state（稳定引用），用 useMemo 计算 alerts —— 与 current-period-bar 一致。
  // 不能订阅 s.getCurrentAlerts（稳定方法引用 → 状态变更后不重渲染，标记已申报后日历不刷新）。
  const taxItems = useTaxStore(s => s.taxItems);
  const taxFilings = useTaxStore(s => s.taxFilings);
  const holidays = useTaxStore(s => s.holidays);
  const markFiled = useTaxStore(s => s.markFiled);
  const unmarkFiled = useTaxStore(s => s.unmarkFiled);
  const canEdit = usePermission('voucher');
  const { toast } = useToast();

  const alerts = useMemo(
    () => getCurrentTaxDeadlines(taxItems, holidays, taxFilings, new Date()),
    [taxItems, taxFilings, holidays]
  );
  const [selectedAlert, setSelectedAlert] = useState<TaxDeadlineAlert | null>(null);

  // Group alerts by month (YYYY-MM format extracted from deadline)
  const groupedAlerts = useMemo(() => {
    const groups: Record<string, TaxDeadlineAlert[]> = {};
    alerts.forEach(alert => {
      const monthKey = alert.deadline.slice(0, 7); // YYYY-MM
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(alert);
    });
    return groups;
  }, [alerts]);

  // Generate all 12 months for current year
  const currentYear = new Date().getFullYear();
  const allMonths = useMemo(() => {
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${currentYear}-${String(m).padStart(2, '0')}`;
      months.push({
        monthKey,
        monthNum: m,
        monthName: getMonthName(m),
        alerts: groupedAlerts[monthKey] || []
      });
    }
    return months;
  }, [currentYear, groupedAlerts]);

  const handleMarkFiled = async (alert: TaxDeadlineAlert, filed: boolean) => {
    if (!canEdit) {
      toast({ type: 'error', title: '无权限修改申报状态' });
      return;
    }

    try {
      if (filed) {
        await markFiled(alert.taxItem.id, alert.taxPeriod, {
          filedDate: new Date().toISOString().slice(0, 10),
        });
        toast({ type: 'success', title: '已标记为已申报' });
      } else {
        await unmarkFiled(alert.taxItem.id, alert.taxPeriod);
        toast({ type: 'success', title: '已取消申报标记' });
      }
      setSelectedAlert(null); // Close detail panel
    } catch (err) {
      toast({ type: 'error', title: '操作失败' });
    }
  };

  const handleJumpToFiling = (alert: TaxDeadlineAlert) => {
    setSelectedAlert(null); // Close detail panel first
    if (onJumpToFiling) {
      onJumpToFiling(alert.taxItem.id, alert.taxPeriod);
    }
  };

  return (
    <div className="space-y-4">
      {alerts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-slate-400">
            暂无申报提醒
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {allMonths.map(({ monthKey, monthNum, monthName, alerts }) => (
          <MonthCard
            key={monthKey}
            monthNum={monthNum}
            monthName={monthName}
            alerts={alerts}
            selectedAlert={selectedAlert}
            onSelectAlert={setSelectedAlert}
          />
        ))}
      </div>

      {/* Inline detail panel */}
      {selectedAlert && (
        <DeadlineDetailPanel
          alert={selectedAlert}
          onMarkFiled={handleMarkFiled}
          onJumpToFiling={handleJumpToFiling}
          canEdit={canEdit}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}

function MonthCard({
  monthNum,
  monthName,
  alerts,
  selectedAlert,
  onSelectAlert,
}: {
  monthNum: number;
  monthName: string;
  alerts: TaxDeadlineAlert[];
  selectedAlert: TaxDeadlineAlert | null;
  onSelectAlert: (alert: TaxDeadlineAlert) => void;
}) {
  const hasUrgent = alerts.some(a => a.urgency === 'high' || a.urgency === 'urgent');
  const hasFiled = alerts.some(a => a.status === 'filed');

  return (
    <Card className={`border-2 ${hasUrgent ? 'border-orange-300 bg-orange-50' : hasFiled ? 'border-green-200 bg-green-50' : 'border-slate-200'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{monthName}</span>
          {hasUrgent && <span className="text-xs text-orange-600">🚨 紧急</span>}
          {hasFiled && !hasUrgent && <span className="text-xs text-green-600">✅ 已完成</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-2">
            无申报事项
          </div>
        )}
        {alerts.map((alert, idx) => (
          <DeadlineChip
            key={idx}
            alert={alert}
            isSelected={selectedAlert === alert}
            onClick={() => onSelectAlert(alert)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function DeadlineChip({
  alert,
  isSelected,
  onClick,
}: {
  alert: TaxDeadlineAlert;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = getUrgencyConfig(alert.urgency);
  const deadlineDay = new Date(alert.deadline).getDate();
  const colorClass = config.color.split(' ')[1]; // Extract the text color class

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2 rounded border transition-colors ${
        isSelected ? 'bg-white border-blue-400 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colorClass}`} />
          <span className="text-xs font-medium">{alert.taxItem.taxName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{deadlineDay}日</span>
          {alert.status === 'filed' && (
            <span className="text-xs text-green-600">✓</span>
          )}
          <ChevronRight className="h-3 w-3 text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function DeadlineDetailPanel({
  alert,
  onMarkFiled,
  onJumpToFiling,
  canEdit,
  onClose,
}: {
  alert: TaxDeadlineAlert;
  onMarkFiled: (alert: TaxDeadlineAlert, filed: boolean) => Promise<void>;
  onJumpToFiling: (alert: TaxDeadlineAlert) => void;
  canEdit: boolean;
  onClose: () => void;
}) {
  const config = getUrgencyConfig(alert.urgency);
  const isFiled = alert.status === 'filed';

  return (
    <Card className="border-blue-300 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{alert.taxItem.taxName}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={config.color}>
              {config.icon} {config.label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500">税款所属期</div>
            <div className="font-medium">{alert.periodLabel}</div>
          </div>
          <div>
            <div className="text-slate-500">截止日期</div>
            <div className="font-medium">{alert.deadline}</div>
          </div>
          <div>
            <div className="text-slate-500">当前状态</div>
            <div className="font-medium">
              {isFiled ? '已申报' : alert.status === 'overdue' ? '已逾期' : '待申报'}
            </div>
          </div>
          <div>
            <div className="text-slate-500">剩余天数</div>
            <div className="font-medium">
              {alert.daysRemaining >= 0 ? `${alert.daysRemaining} 天` : `已逾期 ${Math.abs(alert.daysRemaining)} 天`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          {canEdit && (
            <Button
              size="sm"
              variant={isFiled ? 'outline' : 'default'}
              onClick={() => onMarkFiled(alert, !isFiled)}
              className={isFiled ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
            >
              {isFiled ? (
                <>
                  <X className="h-4 w-4 mr-1" />
                  取消标记
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  标记已申报
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onJumpToFiling(alert)}
            className="flex-1"
          >
            在台账中查看
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getMonthName(month: number): string {
  const months = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  return months[month - 1];
}
