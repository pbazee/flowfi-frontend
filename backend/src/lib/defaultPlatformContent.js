const { DEFAULT_SERVICES } = require('./defaultServices')

const DEFAULT_BLOG_POSTS = [
  {
    id: 'wifi-revenue-playbook',
    title: 'How venues turn guest WiFi into a real revenue line',
    category: 'Growth',
    excerpt:
      'A practical playbook for malls, hotels, campuses, and markets that want paid access without making the experience feel clunky.',
    image:
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    readTime: '5 min read',
    publishedAt: '2026-03-12',
  },
  {
    id: 'mikrotik-rollout-checklist',
    title: 'The MikroTik rollout checklist we use before go-live',
    category: 'Operations',
    excerpt:
      'From API access and captive portal branding to package pricing and payment testing, this checklist keeps launches calm.',
    image:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
    readTime: '7 min read',
    publishedAt: '2026-02-20',
  },
  {
    id: 'loyalty-for-public-wifi',
    title: 'Why loyalty works even for short-session public WiFi',
    category: 'Retention',
    excerpt:
      'Customers may buy short sessions, but repeat behavior compounds quickly when points, rewards, and convenience are designed well.',
    image:
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
    readTime: '4 min read',
    publishedAt: '2026-01-28',
  },
]

const DEFAULT_WORKSPACE_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 4000,
    period: 'monthly',
    trial_days: 14,
    router_limit: 1,
    description: 'A light monthly workspace plan for smaller venues getting started with paid guest WiFi.',
    features: [
      'M-Pesa and Paystack collections',
      'Captive portal branding',
      'Loyalty rewards',
      'Basic analytics',
    ],
    featured: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 8500,
    period: 'monthly',
    trial_days: 14,
    router_limit: 5,
    description: 'The default production plan for active venues that need loyalty, shop sales, and deeper operations.',
    features: [
      'M-Pesa and Paystack collections',
      'Loyalty rewards',
      'Shop storefront',
      'Priority support',
    ],
    featured: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 18000,
    period: 'monthly',
    trial_days: 30,
    router_limit: null,
    description: 'Custom support and rollout capacity for large, multi-site, or white-label deployments.',
    features: [
      'Multi-site operations',
      'White-label rollout support',
      'Priority incident response',
      'Dedicated onboarding',
      'Custom reporting',
    ],
    featured: false,
  },
]

const DEFAULT_TRUSTED_VENUES = [
  'Garden City Mall',
  'Gikomba Market',
  'Strathmore University',
  'Sarova Hotels',
  'Junction Mall',
  'City Market',
  'Westgate Mall',
]

const DEFAULT_REVIEWS = [
  {
    id: 'review-garden-city',
    name: 'Peter Mwangi',
    venue: 'Garden City Mall',
    role: 'Operations Lead',
    rating: 5,
    quote:
      'FlowFi helped us turn guest WiFi into a cleaner revenue flow. The portal, payments, and router rollout finally feel connected.',
  },
  {
    id: 'review-sarova',
    name: 'Mercy Njeri',
    venue: 'Sarova Hotels',
    role: 'Guest Experience Manager',
    rating: 5,
    quote:
      'Our team needed something practical, not another dashboard. FlowFi gave us better visibility, faster support, and a branded customer journey.',
  },
  {
    id: 'review-strathmore',
    name: 'Daniel Otieno',
    venue: 'Strathmore University',
    role: 'ICT Administrator',
    rating: 4,
    quote:
      'The setup was straightforward and the reporting made it easier to explain usage and performance to the wider team.',
  },
  {
    id: 'review-junction',
    name: 'Jane Wambui',
    venue: 'Junction Mall',
    role: 'Commercial Manager',
    rating: 5,
    quote:
      'We liked having payments, storefront orders, and rollout support in one place. It reduced the back-and-forth during launch.',
  },
]

const DEFAULT_LANDING_HERO = {
  eyebrow: 'Guest WiFi, payments, loyalty, and rollout support',
  headline: 'Turn your venue WiFi into',
  highlight: 'a measurable business channel',
  summary:
    'FlowFi helps malls, markets, hotels, campuses, and venues run branded captive portals, collect payments, reward repeat customers, and manage rollout services from one system.',
  helperText:
    'Choose a plan, pay with M-Pesa or Paystack, then configure your router and portal.',
  primaryCtaLabel: 'Start a workspace',
  secondaryCtaLabel: 'Visit storefront',
}

const DEFAULT_ABOUT_CONTENT = {
  eyebrow: 'About FlowFi',
  headline: 'We help venues monetize connectivity without the usual operational mess.',
  summary:
    'FlowFi combines payments, hotspot management, storefront sales, and service delivery into one workflow so teams can launch faster and keep operations lean.',
  story:
    'We built FlowFi for operators who were tired of juggling disconnected tools for WiFi sales, router management, support, and reporting. The goal is simple: make it easy for a venue to go from “we offer guest WiFi” to “our connectivity is a measurable business channel.”',
  values: [
    'Simple setup that gets tenants live fast',
    'Payments and operations tied to the same source of truth',
    'Local support for real-world deployments, not just dashboards',
  ],
  stats: [
    { label: 'Launch speed', value: 'Under 1 hour' },
    { label: 'Core focus', value: 'WiFi + payments + support' },
    { label: 'Built for', value: 'Kenyan venues' },
  ],
}

const DEFAULT_CONTACT_DETAILS = {
  intro:
    'Talk to us about deployments, storefront products, support retainers, or a custom rollout for your venue.',
  address: 'Nairobi, Kenya',
  phone: '+254746284433',
  email: 'peterkinuthia726@gmail.com',
  whatsapp: '+254746284433',
}

const DEFAULT_SOCIAL_LINKS = {
  facebook: '',
  instagram: '',
  x: '',
  linkedin: '',
}

module.exports = {
  DEFAULT_SERVICES,
  DEFAULT_BLOG_POSTS,
  DEFAULT_WORKSPACE_PLANS,
  DEFAULT_TRUSTED_VENUES,
  DEFAULT_REVIEWS,
  DEFAULT_LANDING_HERO,
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_CONTACT_DETAILS,
  DEFAULT_SOCIAL_LINKS,
}
