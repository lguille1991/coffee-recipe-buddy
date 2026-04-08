import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ResponsiveContainer from '@/components/ResponsiveContainer'
import SideNav from '@/components/SideNav'
import { ThemeProvider } from '@/components/ThemeProvider'
import { NavGuardProvider } from '@/components/NavGuardContext'

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Coffee Recipe Buddy',
  description: 'Scan your coffee bag and get a personalized brew recipe',
}

const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})()`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${roboto.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased" style={{ fontFamily: 'var(--font-roboto), Roboto, sans-serif' }}>
        <ThemeProvider>
          <NavGuardProvider>
            <SideNav />
            <div className="lg:ml-56 min-h-screen">
              <ResponsiveContainer>
                {children}
              </ResponsiveContainer>
            </div>
            <BottomNav />
          </NavGuardProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
