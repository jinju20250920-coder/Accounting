'use client';

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, RefreshCw, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { useErrorHandling } from '@/hooks/useErrorHandling';

interface ErrorNotificationProps {
  errorId?: string;
  error?: Error;
  context?: {
    component?: string;
    action?: string;
    data?: any;
  };
  onDismiss?: () => void;
  onRetry?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export function ErrorNotification({
  errorId,
  error,
  context,
  onDismiss,
  onRetry,
  autoHide = false,
  duration = 5000
}: ErrorNotificationProps) {
  const { getErrors, clearErrors } = useErrorHandling();
  const [isVisible, setIsVisible] = React.useState(true);

  const handleClose = () => {
    setIsVisible(false);
    onDismiss?.();
    if (errorId) {
      clearErrors();
    }
  };

  const handleRetry = () => {
    onRetry?.();
    handleClose();
  };

  // 自动隐藏 — 必须在早返回之前调用，避免违反 Hooks 规则
  React.useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, handleClose]);

  // 如果没有传入错误，从全局错误状态获取
  const errorInfo = errorId ? getErrors(1)[0] : null;
  const currentError = error || (errorInfo ? errorInfo.error : null);

  if (!currentError || !isVisible) {
    return null;
  }

  const getErrorIcon = (error: Error) => {
    if (error.message.includes('网络')) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (error.message.includes('验证') || error.message.includes('格式')) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (error.message.includes('权限')) {
      return <AlertCircle className="h-4 w-4" />;
    }
    return <AlertCircle className="h-4 w-4" />;
  };

  const getErrorVariant = (error: Error) => {
    if (error.message.includes('致命') || error.message.includes('failed')) {
      return 'destructive' as const;
    }
    if (error.message.includes('警告') || error.message.includes('warning')) {
      return 'default' as const;
    }
    if (error.message.includes('成功') || error.message.includes('success')) {
      return 'default' as const;
    }
    return 'default' as const;
  };

  const getErrorBadgeColor = (error: Error) => {
    if (error.message.includes('网络')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (error.message.includes('验证') || error.message.includes('格式')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (error.message.includes('权限')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md transition-all duration-300 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
    }`}>
      <Alert variant={getErrorVariant(currentError)} className="relative">
        <div className="flex items-start gap-3">
          {getErrorIcon(currentError)}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getErrorBadgeColor(currentError)}>
                  {currentError.name}
                </Badge>
                {context?.action && (
                  <span className="text-xs text-muted-foreground">
                    {context.action}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <AlertDescription className="text-sm">
              <div className="font-medium mb-1">
                {currentError.message}
              </div>

              {context?.component && (
                <div className="text-xs text-muted-foreground mb-2">
                  位置: {context.component}
                </div>
              )}

              {context?.data && Object.keys(context.data).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    查看详细信息
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(context.data, null, 2)}
                  </pre>
                </details>
              )}

              {/* 操作按钮 */}
              {onRetry && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    重试
                  </Button>
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
}

// 错误通知管理器
export function useErrorNotifications() {
  const [notifications, setNotifications] = React.useState<{
    id: string;
    error: Error;
    context: any;
    autoHide: boolean;
  }[]>([]);

  const showError = (
    error: Error,
    context?: any,
    options: {
      autoHide?: boolean;
      duration?: number;
    } = {}
  ) => {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setNotifications(prev => [...prev, {
      id,
      error,
      context,
      autoHide: options.autoHide ?? true
    }]);

    // 返回关闭函数
    return () => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    };
  };

  const showSuccess = (
    message: string,
    context?: any,
    options: {
      autoHide?: boolean;
      duration?: number;
    } = {}
  ) => {
    const error = new Error(message);
    (error as any).name = 'Success';
    showError(error, context, { ...options, autoHide: true });
  };

  return {
    notifications,
    showError,
    showSuccess,
    dismissError: (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };
}