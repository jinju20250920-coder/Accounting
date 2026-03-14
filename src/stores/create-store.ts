import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';

// 检查是否在客户端环境
const isClient = typeof window !== 'undefined';

// SSR兼容的store创建函数
export function createSSRCompatibleStore<T extends object>(
  initialState: T,
  persistConfig?: PersistOptions<T>
) {
  // 如果是服务器端，不使用persist
  if (!isClient || !persistConfig) {
    return create<T>()(() => initialState);
  }

  // 客户端使用persist - 正确类型化
  return create<T>()(
    persist(() => initialState, persistConfig)
  );
}