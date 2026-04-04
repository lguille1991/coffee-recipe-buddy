import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Brygg — Coffee Recipe Buddy',
  description: 'Scan your coffee bag and get a personalized brew recipe',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${roboto.variable} h-full`}>
      <body className="min-h-full bg-[#F5F5F5] text-[#333333] antialiased" style={{ fontFamily: 'var(--font-roboto), Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
