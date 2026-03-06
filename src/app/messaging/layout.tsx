import MessagingNav from '@/components/messaging/MessagingNav'

export default function MessagingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MessagingNav />
      {children}
    </>
  )
}
