'use client';

const STAMP_CONFIG: Record<string, { label: string; color: string; border: string; rotate: number }> = {
  posted: { label: '已入账', color: 'text-red-600', border: 'border-red-500', rotate: -12 },
  draft: { label: '草稿', color: 'text-slate-400', border: 'border-slate-400', rotate: -8 },
  review: { label: '审核', color: 'text-blue-500', border: 'border-blue-500', rotate: -10 },
  reversed: { label: '已冲销', color: 'text-red-700', border: 'border-red-700', rotate: -15 },
};

export function VoucherStamp({ status }: { status: string }) {
  const c = STAMP_CONFIG[status] || STAMP_CONFIG.draft;
  return (
    <div className="absolute top-0 right-0 z-10 pointer-events-none">
      <div
        className={`px-3 py-1 border-2 ${c.border} ${c.color} text-sm font-bold rounded-sm opacity-70`}
        style={{ transform: `rotate(${c.rotate}deg)`, transformOrigin: 'center' }}
      >
        {c.label}
      </div>
    </div>
  );
}