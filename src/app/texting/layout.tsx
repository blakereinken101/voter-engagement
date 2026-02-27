import TextingNav from '@/components/texting/TextingNav'

export default function TextingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TextingNav />
      {children}
    </>
  )
}
