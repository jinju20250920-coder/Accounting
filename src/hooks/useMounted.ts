import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

// SSR-safe mount detection without setState-in-effect.
// See https://react.dev/reference/react/useSyncExternalStore
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
