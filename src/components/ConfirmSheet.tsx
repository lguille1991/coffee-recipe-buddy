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
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 pb-safe sm:pb-0 lg:pl-56">
      <div className="bg-[var(--card)] rounded-t-3xl sm:rounded-3xl w-full max-w-sm px-6 pt-6 pb-10">
        <h3 className="ui-sheet-title mb-1">{title}</h3>
        <p className="ui-sheet-body mb-6">{message}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full ui-button-primary font-semibold ${
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
            className="w-full ui-button-secondary bg-[var(--background)] border-transparent"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
