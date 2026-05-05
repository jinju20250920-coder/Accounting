'use client';

import { useAuthStore } from '@/stores/useAuthStore';

export function usePermission(permissionId: string): boolean {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return hasPermission(permissionId);
}

export function usePermissions(permissionIds: string[]): boolean {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return permissionIds.every((id) => hasPermission(id));
}

export function useAnyPermission(permissionIds: string[]): boolean {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return permissionIds.some((id) => hasPermission(id));
}