import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Instagram, Linkedin, Menu, ShoppingBag, Twitter, Wifi, X } from 'lucide-react'
import WhatsAppWidget from '@/components/public/WhatsAppWidget'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const homeSectionLinks = [
  { type: 'href', href: '/#how', label: 'How it works' },
  { type: 'href', href: '/#pricing', label: 'Pricing' },
  { type: 'href', href: '/#services', label: 'Services' },
  { type: 'route', to: '/demo', label: 'Demo' },
]

export default function PublicShell({ children, sectionLinks = homeSectionLinks }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: content } = usePlatformContent()
  const socialLinks = [
    { key: 'facebook', href: content?.socials?.facebook, icon: Facebook, label: 'Facebook' },
    { key: 'instagram', href: content?.socials?.instagram, icon: Instagram, label: 'Instagram' },
    { key: 'x', href: content?.socials?.x, icon: Twitter, label: 'X' },
    { key: 'linkedin', href: content?.socials?.linkedin, icon: Linkedin, label: 'LinkedIn' },
  ].filter((item) => item.href)

  const { data: demoStatus } = useQuery({
    queryKey: ['demo-status'],
    queryFn: () => api.get('/platform/demo-status').then((res) => res.data),
  })

  const primaryLinks = useMemo(
    () => {
      let links = [
        ...sectionLinks,
        { type: 'route', to: '/blog', label: 'Blog' },
        { type: 'route', to: '/about', label: 'About' },
        { type: 'route', to: '/contact', label: 'Contact' },
      ]
      
      if (demoStatus && !demoStatus.is_enabled) {
        links = links.filter((link) => link.to !== '/demo')
      }
      
      return links
    },
    [sectionLinks, demoStatus]
  )

  function closeMenu() {
    setMenuOpen(false)
  }

  function renderLink(link, mobile = false) {
    const className = mobile
      ? 'rounded-2xl px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 hover:text-gray-900'
      : 'text-sm font-medium text-gray-900 transition-colors hover:text-gray-900'

    if (link.type === 'href') {
      return (
        <a key={`${link.label}-${link.href}`} href={link.href} className={className} onClick={closeMenu}>
          {link.label}
        </a>
      )
    }

    return (
      <Link key={`${link.label}-${link.to}`} to={link.to} className={className} onClick={closeMenu}>
        {link.label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600">
              <Wifi size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-gray-900">
                {content?.platformName || 'FlowFi'}
              </p>
              <p className="truncate text-xs uppercase tracking-[0.18em] text-primary-600">
                WiFi commerce platform
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {primaryLinks.map((link) => renderLink(link))}
            <Link
              to="/shop"
              className="flex items-center gap-1.5 rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
            >
              <ShoppingBag size={14} />
              Shop
            </Link>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login" className="text-sm font-medium text-gray-900 hover:text-gray-900">
              Log in
            </Link>
            <Link to="/register" className="btn-primary text-sm">
              Get started
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-2xl border border-gray-200 p-2.5 transition-colors hover:bg-gray-50 lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-gray-100 bg-white px-6 py-5 shadow-lg lg:hidden">
            <div className="rounded-[28px] border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Navigate FlowFi</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-900">
                Explore pricing, features, rollout services, blog content, and the storefront from one mobile menu.
              </p>

              <div className="mt-5 grid gap-2">
                {primaryLinks.map((link) => renderLink(link, true))}
                <Link
                  to="/shop"
                  className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white"
                  onClick={closeMenu}
                >
                  <ShoppingBag size={15} />
                  Visit storefront
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link to="/login" className="btn-outline text-center" onClick={closeMenu}>
                  Log in
                </Link>
                <Link to="/register" className="btn-primary text-center" onClick={closeMenu}>
                  Start a workspace
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </nav>

      {children}
      <WhatsAppWidget />

      <footer className="border-t border-gray-100 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-600">
                <Wifi size={15} className="text-white" />
              </div>
              <div>
                <p className="font-display font-semibold text-gray-900">{content?.platformName || 'FlowFi'}</p>
                <p className="text-xs text-gray-900">Built in Nairobi</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              <Link to="/shop" className="text-sm text-gray-900 hover:text-gray-900">
                Shop
              </Link>
              <Link to="/blog" className="text-sm text-gray-900 hover:text-gray-900">
                Blog
              </Link>
              <Link to="/about" className="text-sm text-gray-900 hover:text-gray-900">
                About us
              </Link>
              <Link to="/contact" className="text-sm text-gray-900 hover:text-gray-900">
                Contact us
              </Link>
              <Link to="/legal/terms" className="text-sm text-gray-900 hover:text-gray-900">
                Terms of service
              </Link>
              <Link to="/legal/privacy" className="text-sm text-gray-900 hover:text-gray-900">
                Privacy policy
              </Link>
              <Link to="/legal/refund-policy" className="text-sm text-gray-900 hover:text-gray-900">
                Refund policy
              </Link>
              <Link to="/legal/faqs" className="text-sm text-gray-900 hover:text-gray-900">
                FAQs
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-6 md:flex-row">
            {socialLinks.length > 0 ? (
              <div className="flex items-center gap-3">
                {socialLinks.map(({ key, href, icon: Icon, label }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            ) : (
              <div />
            )}

            <p className="text-xs text-gray-900">Copyright {new Date().getFullYear()} FlowFi. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
