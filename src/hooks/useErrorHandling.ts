import { useEffect, useCallback } from 'react';
import { useAuditStore } from '@/stores';
import { logVoucherAction, OperationType } from '@/stores/useAuditStore';

// 错误类型定义
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

export interface ErrorInfo {
  error: Error;
  context: ErrorContext;
  handled: boolean;
}

// 错误级别
export enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

// 错误处理器接口
export interface ErrorHandler {
  (error: Error, context?: ErrorContext): void;
}

// 全局错误处理器
class GlobalErrorHandler {
  private handlers: ErrorHandler[] = [];
  private errors: ErrorInfo[] = [];
  private maxErrors = 100;

  // 添加错误处理器
  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  // 移除错误处理器
  removeHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  // 处理错误
  handle(error: Error, context: ErrorContext = {}): void {
    const errorInfo: ErrorInfo = {
      error,
      context: {
        timestamp: Date.now(),
        userId: 'current_user', // 可以从 auth store 获取
        ...context
      },
      handled: false
    };

    // 记录错误
    this.errors.unshift(errorInfo);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // 调用所有处理器
    this.handlers.forEach(handler => {
      try {
        handler(error, context);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    });

    errorInfo.handled = true;
  }

  // 获取错误历史
  getErrors = (count?: number): ErrorInfo[] => {
    return count ? this.errors.slice(0, count) : [...this.errors];
  }

  // 清除错误历史
  clearErrors = (): void => {
    this.errors = [];
  }
}

// 创建全局错误处理器实例
const globalErrorHandler = new GlobalErrorHandler();

// 客户端错误处理器
const clientErrorHandler: ErrorHandler = (error, context) => {
  // 记录到审计日志
  logVoucherAction(
    'client-error',
    '系统错误',
    OperationType.CREATE,
    {
      message: error.message,
      stack: error.stack,
      context
    },
    'failed'
  );

  // 显示用户友好的错误提示
  let userMessage = '操作失败，请稍后重试';

  if (error.message.includes('网络')) {
    userMessage = '网络连接异常，请检查网络设置';
  } else if (error.message.includes('验证')) {
    userMessage = '输入数据有误，请检查后重试';
  } else if (error.message.includes('权限')) {
    userMessage = '您没有执行此操作的权限';
  } else if (error.message.includes('存储')) {
    userMessage = '存储空间不足，请清理后重试';
  }

  // 使用浏览器通知（如果用户允许）- 仅在客户端可用时使用
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('系统提示', {
      body: userMessage,
      icon: '/favicon.ico'
    });
  }

  console.error('Client Error:', error, context);
};

// 网络错误处理器
const networkErrorHandler: ErrorHandler = (error, context) => {
  // 特殊处理网络错误
  if (error.name === 'NetworkError' || error.message.includes('Failed to fetch')) {
    // 可以在这里重试逻辑
    console.warn('Network error detected, retry might be needed:', context);
  }
};

// 数据验证错误处理器
const validationErrorHandler: ErrorHandler = (error, context) => {
  if (error.name === 'ValidationError') {
    console.warn('Validation error:', error.message, context);
  }
};

// 注册默认处理器（仅在客户端）
if (typeof window !== 'undefined') {
  globalErrorHandler.addHandler(clientErrorHandler);
  globalErrorHandler.addHandler(networkErrorHandler);
  globalErrorHandler.addHandler(validationErrorHandler);
}

// React Hook: 使用错误处理
export function useErrorHandling() {
  const addErrorToAudit = useAuditStore(state => state.addRecord);

  const handleError = useCallback((error: Error, context: ErrorContext = {}) => {
    globalErrorHandler.handle(error, context);

    // 可以添加额外的错误处理逻辑
    addErrorToAudit({
      userId: context.userId || 'current_user',
      userName: '当前用户',
      operation: OperationType.CREATE,
      entityType: 'system',
      entityId: 'error',
      details: {
        message: error.message,
        stack: error.stack,
        context
      },
      result: 'failed',
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    });
  }, [addErrorToAudit]);

  return {
    handleError,
    getErrors: globalErrorHandler.getErrors,
    clearErrors: globalErrorHandler.clearErrors
  };
}

// React Hook: 监听全局错误
export function useGlobalErrorListener() {
  const { handleError } = useErrorHandling();

  useEffect(() => {
    // 处理未捕获的 Promise 拒绝
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(new Error(event.reason.message || '未处理的 Promise 拒绝'), {
        component: 'global',
        action: 'unhandledRejection'
      });
    };

    // 处理未捕获的错误
    const handleWindowError = (event: ErrorEvent) => {
      handleError(new Error(event.error.message || '未捕获的错误'), {
        component: 'global',
        action: 'windowError'
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
    };
  }, [handleError]);
}

// 工具函数：创建错误
export function createError(
  message: string,
  level: ErrorLevel = ErrorLevel.ERROR,
  context?: ErrorContext
): Error & { level: ErrorLevel; context?: ErrorContext } {
  const error = new Error(message) as Error & { level: ErrorLevel; context?: ErrorContext };
  error.level = level;
  error.context = context;
  return error;
}

// 工具函数：包装异步函数以进行错误处理
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: Error) => void
): () => Promise<T> {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));

      // 记录全局错误
      globalErrorHandler.handle(errorObj);

      // 调用自定义错误处理器
      if (errorHandler) {
        errorHandler(errorObj);
      }

      // 重新抛出错误
      throw errorObj;
    }
  };
}

// 工具函数：验证 API 响应
export function validateApiResponse(response: { error?: { message?: string }; status?: number } | null | undefined): { valid: boolean; error?: Error } {
  if (!response) {
    return {
      valid: false,
      error: createError('响应为空', ErrorLevel.ERROR)
    };
  }

  if (response.error) {
    return {
      valid: false,
      error: createError(response.error.message, ErrorLevel.ERROR)
    };
  }

  if (response.status && response.status >= 400) {
    return {
      valid: false,
      error: createError(`请求失败: ${response.status}`, ErrorLevel.ERROR)
    };
  }

  return { valid: true };
}

// 导出全局错误处理器实例，供类组件使用
export { globalErrorHandler };