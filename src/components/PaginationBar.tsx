export function PaginationBar({
  page,
  pages,
  onPageChange,
  loading = false,
}: {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}) {
  if (pages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-stage-card/60 px-4 py-3">
      <p className="text-xs text-white/40">
        Page {page} of {pages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page >= pages || loading}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
