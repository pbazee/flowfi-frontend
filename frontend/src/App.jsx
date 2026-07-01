import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

// Landing
import Landing from '@/pages/landing/Landing'
import BlogPage from '@/pages/public/BlogPage'
import AboutPage from '@/pages/public/AboutPage'
import ContactPage from '@/pages/public/ContactPage'
import ReviewsPage from '@/pages/public/ReviewsPage'
import ServicePage from '@/pages/public/ServicePage'
import LegalPage from '@/pages/public/LegalPage'
import BlogPost from '@/pages/public/BlogPost'
import ShopPage from '@/pages/shop/ShopPage'
import ProductPage from '@/pages/shop/ProductPage'
import CartPage from '@/pages/shop/CartPage'
import CheckoutPage from '@/pages/shop/CheckoutPage'
import OrderConfirmedPage from '@/pages/shop/OrderConfirmedPage'
import OrderTrackPage from '@/pages/shop/OrderTrackPage'

// Auth
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import Demo from '@/pages/auth/Demo'

// Admin
import AdminLayout from '@/components/layout/AdminLayout'
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminTenants from '@/pages/admin/Tenants'
import AdminUsers from '@/pages/admin/Users'
import AdminAnalytics from '@/pages/admin/Analytics'
import AdminShopProducts from '@/pages/admin/ShopProducts'
import AdminShopOrders from '@/pages/admin/ShopOrders'
import AdminSettings from '@/pages/admin/Settings'
import AdminServices from '@/pages/admin/Services'
import AdminPlans from '@/pages/admin/Plans'
import AdminShippingRules from '@/pages/admin/ShippingRules'
import AdminBlog from '@/pages/admin/Blog'
import AdminReviews from '@/pages/admin/Reviews'
import AdminAbout from '@/pages/admin/About'
import AdminLegal from '@/pages/admin/Legal'
import AdminMessages from '@/pages/admin/Messages'
import AdminCommunications from '@/pages/admin/Communications'
import DemoManagement from '@/pages/admin/DemoManagement'

// Tenant
import TenantLayout from '@/components/layout/TenantLayout'
import TenantDashboard from '@/pages/tenant/Dashboard'
import TenantRouters from '@/pages/tenant/Routers'
import TenantPackages from '@/pages/tenant/Packages'
import TenantSessionCredits from '@/pages/tenant/SessionCredits'
import TenantSessions from '@/pages/tenant/Sessions'
import TenantTransactions from '@/pages/tenant/Transactions'
import TenantLoyalty from '@/pages/tenant/Loyalty'
import TenantCustomers from '@/pages/tenant/Customers'
import TenantAnalytics from '@/pages/tenant/Analytics'
import TenantSettings from '@/pages/tenant/Settings'
import TenantBilling from '@/pages/tenant/Billing'

// Captive Portal (public)
import CaptivePortal from '@/pages/customer/CaptivePortal'
import PaymentCallback from '@/pages/customer/PaymentCallback'
import CustomerPortal from '@/pages/customer/CustomerPortal'

function ProtectedRoute({ children, role }) {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role && user?.role !== role) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:id" element={<BlogPost />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
      <Route path="/legal/:slug" element={<LegalPage />} />
      <Route path="/services/:serviceId" element={<ServicePage />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/shop/:slug" element={<ProductPage />} />
      <Route path="/shop/cart" element={<CartPage />} />
      <Route path="/shop/checkout" element={<CheckoutPage />} />
      <Route path="/shop/order-confirmed" element={<OrderConfirmedPage />} />
      <Route path="/shop/track" element={<OrderTrackPage />} />
      <Route path="/shop/track/:reference" element={<OrderTrackPage />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/demo" element={<Demo />} />

      {/* Captive Portal - public, per-tenant */}
      <Route path="/portal/:tenantId" element={<CaptivePortal />} />
      <Route path="/payment/callback" element={<PaymentCallback />} />
      <Route path="/my-wifi/:tenantId" element={<CustomerPortal />} />

      {/* Admin */}
      <Route
        path="/admin"
        element={<ProtectedRoute role="super_admin"><AdminLayout /></ProtectedRoute>}
      >
        <Route index element={<AdminDashboard />} />
        <Route path="tenants" element={<AdminTenants />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="shop/products" element={<AdminShopProducts />} />
        <Route path="shop/orders" element={<AdminShopOrders />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="communications" element={<AdminCommunications />} />
        <Route path="demo" element={<DemoManagement />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="shipping" element={<AdminShippingRules />} />
        <Route path="blog" element={<AdminBlog />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="about" element={<AdminAbout />} />
        <Route path="legal" element={<AdminLegal />} />
      </Route>

      {/* Tenant Admin */}
      <Route
        path="/tenant"
        element={<ProtectedRoute role="tenant_admin"><TenantLayout /></ProtectedRoute>}
      >
        <Route index element={<TenantDashboard />} />
        <Route path="routers" element={<TenantRouters />} />
        <Route path="packages" element={<TenantPackages />} />
        <Route path="session-credits" element={<TenantSessionCredits />} />
        <Route path="sessions" element={<TenantSessions />} />
        <Route path="transactions" element={<TenantTransactions />} />
        <Route path="loyalty" element={<TenantLoyalty />} />
        <Route path="customers" element={<TenantCustomers />} />
        <Route path="analytics" element={<TenantAnalytics />} />
        <Route path="billing" element={<TenantBilling />} />
        <Route path="settings" element={<TenantSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
