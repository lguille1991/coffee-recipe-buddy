import type { Metadata } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ResponsiveContainer from '@/components/ResponsiveContainer'
import SideNav from '@/components/SideNav'
import ThemeInitializer from '@/components/ThemeInitializer'
import { AuthProvider } from '@/components/AuthContext'

export const metadata: Metadata = {
  title: 'Coffee Recipe Buddy',
  description: 'Scan your coffee bag and get a personalized brew recipe',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head />
      <body
        className="min-h-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased"
        style={{
          fontFamily: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <ThemeInitializer />
        <AuthProvider>
          <SideNav />
          <main className="lg:ml-56 min-h-screen" id="main-content">
            <ResponsiveContainer>
              {children}
            </ResponsiveContainer>
          </main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}
