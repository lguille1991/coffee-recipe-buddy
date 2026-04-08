export default function ResponsiveContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`
      w-full
      px-4
      sm:px-6
      md:max-w-2xl md:mx-auto md:px-8
      lg:max-w-3xl
      xl:max-w-5xl xl:px-8
      2xl:max-w-6xl
      ${className}
    `}>
      {children}
    </div>
  )
}
