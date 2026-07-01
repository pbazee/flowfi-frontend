import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_BLOG_POSTS,
  DEFAULT_CONTACT_DETAILS,
  DEFAULT_LANDING_HERO,
  DEFAULT_REVIEWS,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_TRUSTED_VENUES,
  DEFAULT_WORKSPACE_PLANS,
} from '@/lib/defaultPlatformContent'
import { DEFAULT_SERVICES } from '@/lib/defaultServices'
import { getPlanRouterLimit } from '@/lib/workspacePlans'

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createEmptyService() {
  return {
    id: createId('service'),
    name: '',
    category: 'installation',
    description: '',
    longDescription: '',
    startingPrice: '',
    turnaround: '',
    featured: false,
  }
}

function createEmptyBlogPost() {
  return {
    id: createId('post'),
    title: '',
    category: 'Operations',
    excerpt: '',
    image: '',
    readTime: '5 min read',
    publishedAt: new Date().toISOString().slice(0, 10),
    content: '',
  }
}

function createEmptyPlan() {
  return {
    id: createId('plan'),
    name: '',
    price: '',
    period: 'monthly',
    router_limit: '',
    description: '',
    featuresText: '',
    featured: false,
  }
}

function createEmptyReview() {
  return {
    id: createId('review'),
    name: '',
    venue: '',
    role: '',
    rating: 5,
    quote: '',
  }
}

function createEmptyAboutStat() {
  return {
    id: createId('stat'),
    label: '',
    value: '',
  }
}

function parseJsonSetting(value, fallback) {
  if (!value) return fallback

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback
    }

    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function hydrateAboutStats(stats) {
  return stats.map((stat) => ({
    id: createId('stat'),
    label: stat.label || '',
    value: stat.value || '',
  }))
}

function buildForm(settings) {
  const heroSetting = parseJsonSetting(settings?.landing_hero, DEFAULT_LANDING_HERO)
  const aboutSetting = parseJsonSetting(settings?.about_content, DEFAULT_ABOUT_CONTENT)
  const trustedVenues = parseJsonSetting(settings?.trusted_venues, DEFAULT_TRUSTED_VENUES)
  const reviews = parseJsonSetting(settings?.customer_reviews, DEFAULT_REVIEWS)
  const aboutStats = Array.isArray(aboutSetting.stats) && aboutSetting.stats.length
    ? aboutSetting.stats
    : DEFAULT_ABOUT_CONTENT.stats

  return {
    platform_name: settings?.platform_name || 'FlowFi',
    support_phone: settings?.support_phone || DEFAULT_CONTACT_DETAILS.phone,
    support_email: settings?.support_email || DEFAULT_CONTACT_DETAILS.email,
    support_whatsapp: settings?.support_whatsapp || DEFAULT_CONTACT_DETAILS.whatsapp,
    support_address: settings?.support_address || DEFAULT_CONTACT_DETAILS.address,
    contact_intro: settings?.contact_intro || DEFAULT_CONTACT_DETAILS.intro,
    social_facebook: settings?.social_facebook || DEFAULT_SOCIAL_LINKS.facebook,
    social_instagram: settings?.social_instagram || DEFAULT_SOCIAL_LINKS.instagram,
    social_x: settings?.social_x || DEFAULT_SOCIAL_LINKS.x,
    social_linkedin: settings?.social_linkedin || DEFAULT_SOCIAL_LINKS.linkedin,
    mpesa_env: settings?.mpesa_env || 'sandbox',
    maintenance_mode: String(settings?.maintenance_mode) === 'true',
    hero: {
      ...DEFAULT_LANDING_HERO,
      ...heroSetting,
    },
    services: parseJsonSetting(settings?.services_catalog, DEFAULT_SERVICES).map((service) => ({
      ...createEmptyService(),
      ...service,
    })),
    reviews: reviews.map((review) => ({
      ...createEmptyReview(),
      ...review,
    })),
    blogPosts: parseJsonSetting(settings?.blog_posts, DEFAULT_BLOG_POSTS).map((post) => ({
      ...createEmptyBlogPost(),
      ...post,
    })),
    workspacePlans: parseJsonSetting(settings?.workspace_plans, DEFAULT_WORKSPACE_PLANS).map((plan) => ({
      ...createEmptyPlan(),
      ...plan,
      router_limit:
        getPlanRouterLimit(plan) === null
          ? 'unlimited'
          : Number.isFinite(getPlanRouterLimit(plan))
            ? String(getPlanRouterLimit(plan))
            : '',
      featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
    })),
    trustedVenues: trustedVenues.map((venue) => String(venue || '').trim()).filter(Boolean),
    about: {
      ...DEFAULT_ABOUT_CONTENT,
      ...aboutSetting,
      values: Array.isArray(aboutSetting.values) && aboutSetting.values.length
        ? aboutSetting.values
        : DEFAULT_ABOUT_CONTENT.values,
      stats: hydrateAboutStats(aboutStats),
    },
  }
}

function buildPayload(form) {
  return {
    platform_name: form.platform_name.trim() || 'FlowFi',
    support_phone: form.support_phone.trim(),
    support_email: form.support_email.trim(),
    support_whatsapp: form.support_whatsapp.trim(),
    support_address: form.support_address.trim(),
    contact_intro: form.contact_intro.trim(),
    social_facebook: form.social_facebook.trim(),
    social_instagram: form.social_instagram.trim(),
    social_x: form.social_x.trim(),
    social_linkedin: form.social_linkedin.trim(),
    mpesa_env: form.mpesa_env,
    maintenance_mode: form.maintenance_mode,
    landing_hero: JSON.stringify({
      eyebrow: form.hero.eyebrow.trim() || DEFAULT_LANDING_HERO.eyebrow,
      headline: form.hero.headline.trim() || DEFAULT_LANDING_HERO.headline,
      highlight: form.hero.highlight.trim() || DEFAULT_LANDING_HERO.highlight,
      summary: form.hero.summary.trim() || DEFAULT_LANDING_HERO.summary,
      helperText: form.hero.helperText.trim() || DEFAULT_LANDING_HERO.helperText,
      primaryCtaLabel: form.hero.primaryCtaLabel.trim() || DEFAULT_LANDING_HERO.primaryCtaLabel,
      secondaryCtaLabel: form.hero.secondaryCtaLabel.trim() || DEFAULT_LANDING_HERO.secondaryCtaLabel,
    }),
    services_catalog: JSON.stringify(
      form.services
        .map((service) => ({
          id: service.id || `service-${service.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: service.name.trim(),
          category: service.category || 'installation',
          description: service.description.trim(),
          longDescription: service.longDescription.trim(),
          startingPrice: service.startingPrice.trim(),
          turnaround: service.turnaround.trim(),
          featured: Boolean(service.featured),
        }))
        .filter((service) => service.name && service.description)
    ),
    customer_reviews: JSON.stringify(
      form.reviews
        .map((review) => ({
          id: review.id || createId('review'),
          name: review.name.trim(),
          venue: review.venue.trim(),
          role: review.role.trim(),
          rating: Math.max(1, Math.min(5, Number(review.rating || 5))),
          quote: review.quote.trim(),
        }))
        .filter((review) => review.name && review.quote)
    ),
    blog_posts: JSON.stringify(
      form.blogPosts
        .map((post) => ({
          id: post.id || createId('post'),
          title: post.title.trim(),
          category: post.category.trim() || 'Operations',
          excerpt: post.excerpt.trim(),
          image: post.image.trim(),
          readTime: post.readTime.trim() || '5 min read',
          publishedAt: post.publishedAt || new Date().toISOString().slice(0, 10),
          content: post.content.trim(),
        }))
        .filter((post) => post.title && post.excerpt)
    ),
    workspace_plans: JSON.stringify(
      form.workspacePlans
        .map((plan) => ({
          id: plan.id || createId('plan'),
          name: plan.name.trim(),
          price: Number(plan.price || 0),
          period: plan.period.trim() || 'monthly',
          router_limit: (() => {
            const rawRouterLimit = String(plan.router_limit || '').trim().toLowerCase()
            if (rawRouterLimit === 'unlimited') return null
            if (!rawRouterLimit) return undefined
            const parsedRouterLimit = Number(rawRouterLimit)
            return Number.isFinite(parsedRouterLimit) && parsedRouterLimit > 0
              ? parsedRouterLimit
              : undefined
          })(),
          description: plan.description.trim(),
          features: String(plan.featuresText || '')
            .split(/\r?\n/)
            .map((feature) => feature.trim())
            .filter(Boolean),
          featured: Boolean(plan.featured),
        }))
        .filter((plan) => plan.name)
    ),
    trusted_venues: JSON.stringify(
      form.trustedVenues.map((venue) => venue.trim()).filter(Boolean)
    ),
    about_content: JSON.stringify({
      eyebrow: form.about.eyebrow.trim(),
      headline: form.about.headline.trim(),
      summary: form.about.summary.trim(),
      story: form.about.story.trim(),
      values: form.about.values.map((value) => value.trim()).filter(Boolean),
      stats: form.about.stats
        .map((stat) => ({ label: stat.label.trim(), value: stat.value.trim() }))
        .filter((stat) => stat.label && stat.value),
    }),
  }
}

export function useAdminContentSettings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => buildForm())

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then((response) => response.data),
  })

  useEffect(() => {
    if (!settings) return
    setForm(buildForm(settings))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/admin/settings', payload).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['platform-services'] })
      queryClient.invalidateQueries({ queryKey: ['platform-content'] })
      toast.success('Platform settings saved')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not save platform settings')
    },
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateHeroField(key, value) {
    setForm((current) => ({
      ...current,
      hero: { ...current.hero, [key]: value },
    }))
  }

  function updateService(serviceId, key, value) {
    setForm((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.id === serviceId ? { ...service, [key]: value } : service
      ),
    }))
  }

  function addService() {
    setForm((current) => ({
      ...current,
      services: [...current.services, createEmptyService()],
    }))
  }

  function removeService(serviceId) {
    setForm((current) => ({
      ...current,
      services: current.services.filter((service) => service.id !== serviceId),
    }))
  }

  function updateReview(reviewId, key, value) {
    setForm((current) => ({
      ...current,
      reviews: current.reviews.map((review) =>
        review.id === reviewId ? { ...review, [key]: value } : review
      ),
    }))
  }

  function addReview() {
    setForm((current) => ({
      ...current,
      reviews: [createEmptyReview(), ...current.reviews],
    }))
  }

  function removeReview(reviewId) {
    setForm((current) => ({
      ...current,
      reviews: current.reviews.filter((review) => review.id !== reviewId),
    }))
  }

  function updateBlogPost(postId, key, value) {
    setForm((current) => ({
      ...current,
      blogPosts: current.blogPosts.map((post) =>
        post.id === postId ? { ...post, [key]: value } : post
      ),
    }))
  }

  function addBlogPost() {
    setForm((current) => ({
      ...current,
      blogPosts: [createEmptyBlogPost(), ...current.blogPosts],
    }))
  }

  function removeBlogPost(postId) {
    setForm((current) => ({
      ...current,
      blogPosts: current.blogPosts.filter((post) => post.id !== postId),
    }))
  }

  function updatePlan(planId, key, value) {
    setForm((current) => ({
      ...current,
      workspacePlans: current.workspacePlans.map((plan) =>
        plan.id === planId ? { ...plan, [key]: value } : plan
      ),
    }))
  }

  function addPlan() {
    setForm((current) => ({
      ...current,
      workspacePlans: [...current.workspacePlans, createEmptyPlan()],
    }))
  }

  function removePlan(planId) {
    setForm((current) => ({
      ...current,
      workspacePlans: current.workspacePlans.filter((plan) => plan.id !== planId),
    }))
  }

  function updateTrustedVenue(index, value) {
    setForm((current) => ({
      ...current,
      trustedVenues: current.trustedVenues.map((venue, venueIndex) => (
        venueIndex === index ? value : venue
      )),
    }))
  }

  function addTrustedVenue() {
    setForm((current) => ({
      ...current,
      trustedVenues: [...current.trustedVenues, ''],
    }))
  }

  function removeTrustedVenue(index) {
    setForm((current) => ({
      ...current,
      trustedVenues: current.trustedVenues.filter((_, venueIndex) => venueIndex !== index),
    }))
  }

  function updateAboutField(key, value) {
    setForm((current) => ({
      ...current,
      about: { ...current.about, [key]: value },
    }))
  }

  function updateAboutValue(index, value) {
    setForm((current) => ({
      ...current,
      about: {
        ...current.about,
        values: current.about.values.map((entry, entryIndex) => (
          entryIndex === index ? value : entry
        )),
      },
    }))
  }

  function addAboutValue() {
    setForm((current) => ({
      ...current,
      about: {
        ...current.about,
        values: [...current.about.values, ''],
      },
    }))
  }

  function removeAboutValue(index) {
    setForm((current) => ({
      ...current,
      about: {
        ...current.about,
        values: current.about.values.filter((_, entryIndex) => entryIndex !== index),
      },
    }))
  }

  function updateAboutStat(statId, key, value) {
    setForm((current) => ({
      ...current,
      about: {
        ...current.about,
        stats: current.about.stats.map((stat) =>
          stat.id === statId ? { ...stat, [key]: value } : stat
        ),
      },
    }))
  }

  function addAboutStat() {
    setForm((current) => ({
      ...current,
      about: {
        ...current.about,
        stats: [...current.about.stats, createEmptyAboutStat()],
      },
    }))
  }

  function removeAboutStat(statId) {
    setForm((current) => ({
      ...current,
      about: {
        ...current.about,
        stats: current.about.stats.filter((stat) => stat.id !== statId),
      },
    }))
  }

  function saveSettings() {
    saveMutation.mutate(buildPayload(form))
  }

  const featuredServices = useMemo(
    () => form.services.filter((service) => service.featured).length,
    [form.services]
  )

  const featuredPlans = useMemo(
    () => form.workspacePlans.filter((plan) => plan.featured).length,
    [form.workspacePlans]
  )

  return {
    form,
    isLoading,
    saveMutation,
    featuredPlans,
    featuredServices,
    updateField,
    updateHeroField,
    updateService,
    addService,
    removeService,
    updateReview,
    addReview,
    removeReview,
    updateBlogPost,
    addBlogPost,
    removeBlogPost,
    updatePlan,
    addPlan,
    removePlan,
    updateTrustedVenue,
    addTrustedVenue,
    removeTrustedVenue,
    updateAboutField,
    updateAboutValue,
    addAboutValue,
    removeAboutValue,
    updateAboutStat,
    addAboutStat,
    removeAboutStat,
    saveSettings,
  }
}
