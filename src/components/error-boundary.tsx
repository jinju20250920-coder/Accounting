'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { globalErrorHandler, useErrorHandling } from '@/hooks/useErrorHandling';
import type { ErrorContext } from '@/hooks/useErrorHandling';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private dismissTimeout?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误到全局错误处理器
    // 如果组件还没有挂载（SSR情况），直接处理
    if (typeof window !== 'undefined') {
      const handleErrorInternal = () => {
        globalErrorHandler.handle(error, {
          component: this.getComponentName(errorInfo),
          action: 'render',
          data: {
            componentStack: errorInfo.componentStack,
            lineNumber: this.extractLineNumber(errorInfo.componentStack),
            fileName: this.extractFileName(errorInfo.componentStack)
          }
        });
      };

      // 延迟执行以确保错误处理器已经初始化
      setTimeout(handleErrorInternal, 0);

      this.setState({
        error,
        errorInfo,
        errorId: `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
    }

    // 调用错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private getComponentName(errorInfo: ErrorInfo): string {
    if (errorInfo.componentStack) {
      // 尝试从组件堆栈中提取组件名
      const match = errorInfo.componentStack.match(/in ([^\s]+)/);
      return match ? match[1] : 'UnknownComponent';
    }
    return 'UnknownComponent';
  }

  private extractLineNumber(componentStack?: string): number | null {
    if (!componentStack) return null;

    const match = componentStack.match(/at (\d+):(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  private extractFileName(componentStack?: string): string | null {
    if (!componentStack) return null;

    const match = componentStack.match(/in (\S+)/);
    return match ? match[1] : null;
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleCopyError = () => {
    if (this.state.error) {
      const errorDetails = {
        message: this.state.error.message,
        stack: this.state.error.stack,
        timestamp: new Date().toISOString(),
        component: this.getComponentName(this.state.errorInfo!),
        errorId: this.state.errorId
      };

      navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
    }
  };

  private handleDismiss = () => {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
    }

    this.dismissTimeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }, 100);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-4xl w-full space-y-6">
            {/* 主错误卡片 */}
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <AlertTriangle className="h-12 w-12 text-destructive" />
                </div>
                <CardTitle className="text-2xl">
                  出错了 📦
                </CardTitle>
                <CardDescription>
                  应用遇到了一个意外错误，但别担心，我们已经记录了这个问题。
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* 错误信息 */}
                {this.state.error && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">错误信息</h4>
                      <p className="text-sm font-mono bg-muted p-3 rounded">
                        {this.state.error.message}
                      </p>
                    </div>

                    {/* 错误ID */}
                    {this.state.errorId && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">错误ID</h4>
                        <Badge variant="outline" className="font-mono text-xs">
                          {this.state.errorId}
                        </Badge>
                      </div>
                    )}

                    {/* 组件位置 */}
                    {this.state.errorInfo && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">发生位置</h4>
                        <div className="text-sm text-muted-foreground">
                          <p>组件: {this.getComponentName(this.state.errorInfo)}</p>
                          <p>
                            行号: {this.extractLineNumber(this.state.errorInfo?.componentStack) || '未知'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 开发模式显示更多信息 */}
                    {process.env.NODE_ENV === 'development' && (
                      <Dialog>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => {}}>
                          <Bug className="h-4 w-4 mr-2" />
                          查看详细信息（开发模式）
                        </Button>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>错误详细信息</DialogTitle>
                            <DialogDescription>
                              以下是错误的技术详细信息，仅开发模式下可见。
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <h5 className="font-medium mb-2">错误堆栈</h5>
                              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-60">
                                {this.state.error?.stack}
                              </pre>
                            </div>
                            <div>
                              <h5 className="font-medium mb-2">React组件堆栈</h5>
                              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-60">
                                {this.state.errorInfo?.componentStack}
                              </pre>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={this.handleCopyError} variant="outline">
                              <Copy className="h-4 w-4 mr-2" />
                              复制错误信息
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button onClick={this.handleRefresh} className="flex-1">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新页面
                  </Button>
                  <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                    <Home className="h-4 w-4 mr-2" />
                    返回首页
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 帮助卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">需要帮助？</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  如果问题持续存在，您可以：
                </p>
                <ul className="text-sm space-y-2">
                  <li>
                    <strong>刷新页面</strong> - 清除临时错误状态
                  </li>
                  <li>
                    <strong>清除缓存</strong> - 按 Ctrl+Shift+R 强制刷新
                  </li>
                  <li>
                    <strong>联系技术支持</strong> - 提供错误ID以便快速定位问题
                  </li>
                </ul>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    错误ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      {this.state.errorId || 'unknown'}
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    时间: {new Date().toLocaleString('zh-CN')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 全局错误上下文，用于在错误边界外部提供错误处理
export const GlobalErrorContext = React.createContext<{
  handleError: (error: Error, context?: ErrorContext) => void;
  hasError: boolean;
}>({
  handleError: () => {},
  hasError: false
});

// 全局错误包装器组件
export function GlobalErrorProvider({ children }: { children: ReactNode }) {
  const { handleError } = useErrorHandling();
  const [globalError, setGlobalError] = React.useState<Error | null>(null);

  const handleGlobalError = (error: Error, context?: ErrorContext) => {
    setGlobalError(error);
    handleError(error, context);

    // 显示错误通知
    setTimeout(() => {
      // 这里可以添加错误通知组件的调用
    }, 0);
  };

  return (
    <GlobalErrorContext.Provider value={{
      handleError: handleGlobalError,
      hasError: !!globalError
    }}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </GlobalErrorContext.Provider>
  );
}