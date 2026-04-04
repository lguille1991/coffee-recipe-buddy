import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto relative">
      {/* Status bar spacer */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#333333]">Brygg</h1>
        <p className="text-[#5B5F66] text-sm mt-0.5">Good morning</p>
      </div>

      {/* Hero image */}
      <div className="px-6">
        <div
          className="w-full aspect-[4/3] rounded-[16px] overflow-hidden bg-[#D4C9B8]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      {/* CTA */}
      <div className="px-6 mt-6 flex flex-col items-center gap-3">
        <Link
          href="/scan"
          className="w-full flex items-center justify-center gap-2 bg-[#333333] text-white text-sm font-medium rounded-[14px] py-4 active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5.25" stroke="white" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2" fill="white" />
            <path d="M1 8H2.5M13.5 8H15M8 1V2.5M8 13.5V15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Scan Your Coffee Bag
        </Link>
        <Link
          href="/manual"
          className="w-full flex items-center justify-center gap-2 bg-white text-[#333333] text-sm font-medium rounded-[14px] py-3.5 border border-[#E1E2E5] active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3H13M3 6H10M3 9H13M3 12H8" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Enter Manually
        </Link>
      </div>

      {/* Bottom nav spacer */}
      <div className="h-24" />
      <BottomNav />
    </div>
  )
}
