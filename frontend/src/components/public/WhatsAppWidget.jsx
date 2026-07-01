import { MessageCircleMore } from 'lucide-react'
import { usePlatformContent } from '@/hooks/usePlatformContent'

export default function WhatsAppWidget() {
  const { data: content } = usePlatformContent()
  const whatsapp = String(content?.contact?.whatsapp || '').replace(/[^\d]/g, '')

  if (!whatsapp) return null

  const platformName = content?.platformName || 'FlowFi'
  const href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello ${platformName}, I would like help with your platform.`)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_rgba(37,211,102,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(37,211,102,0.4)]"
      aria-label="Chat with FlowFi on WhatsApp"
    >
      <MessageCircleMore size={22} />
    </a>
  )
}
