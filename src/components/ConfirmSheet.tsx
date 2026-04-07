'use client'

interface ConfirmSheetProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-safe">
      <div className="bg-[var(--card)] rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10">
        <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">{message}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full py-3.5 text-sm font-semibold rounded-[14px] active:opacity-80 disabled:opacity-50 flex items-center justify-center ${
              destructive
                ? 'bg-red-500 text-white'
                : 'bg-[var(--foreground)] text-[var(--background)]'
            }`}
          >
            {loading ? (
              <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${
                destructive ? 'border-white' : 'border-[var(--background)]'
              }`} />
            ) : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full py-3.5 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium rounded-[14px] active:opacity-80 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
