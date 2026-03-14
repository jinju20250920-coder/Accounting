import { cn } from '@/lib/utils';

export default function TestComponent() {
  return <div className={cn('bg-red-500', 'text-white')}>Test Component</div>;
}