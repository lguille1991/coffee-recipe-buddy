import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ResponsiveContainer from '@/components/ResponsiveContainer'
import SideNav from '@/components/SideNav'
import ThemeInitializer from '@/components/ThemeInitializer'
import { AuthProvider } from '@/components/AuthContext'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

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
    <html lang="en" className={`h-full ${geistSans.variable}`} suppressHydrationWarning>
      <head />
      <body className="min-h-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased">
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
