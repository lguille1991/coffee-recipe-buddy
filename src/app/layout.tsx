import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ResponsiveContainer from '@/components/ResponsiveContainer'
import SideNav from '@/components/SideNav'
import { AuthProvider } from '@/components/AuthContext'

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
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body
        className="min-h-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased"
        style={{
          fontFamily: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
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
