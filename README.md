# FlowFi — WiFi Monetization Platform

> **Built in Nairobi 🇰🇪 · Node.js + React + Supabase**

FlowFi is a multi-tenant WiFi monetization platform. Mall owners, market operators, hotels, and schools connect their MikroTik routers and earn money from WiFi access — with M-Pesa STK push, Paystack, loyalty rewards, vouchers, and a full shop.

---

## 🗂️ Project Structure

```
flowfi/
├── backend/              Node.js + Express API
│   ├── src/
│   │   ├── index.js      Main entry point
│   │   ├── routes/       auth, admin, tenant, payments, vouchers, loyalty, shop, portal...
│   │   ├── services/     mikrotik, payment, notification, loyalty
│   │   ├── middleware/   auth (JWT), rate limiting
│   │   └── lib/          supabase client, winston logger, cron jobs
│   └── .env.example      ← Copy to .env and fill in keys
├── frontend/             React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx       All routes
│   │   ├── pages/        landing, admin, tenant, customer, auth, shop
│   │   ├── components/   layouts (AdminLayout, TenantLayout)
│   │   ├── store/        auth (Zustand), cart (Zustand)
│   │   └── lib/          axios api client, socket.io
│   └── .env.example      ← Copy to .env and fill in keys
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql   ← Run this in Supabase SQL editor
```

---

## ⚡ Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd flowfi
npm install:all
# Or manually:
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`
3. Copy your **Project URL**, **anon key**, and **service_role key** from Project Settings → API

### 3. Configure environment variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your keys (see table below)
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Edit .env with your Supabase public keys
```

### 4. Create Super Admin

After running the migration, insert your super admin directly in Supabase:
```sql
-- In Supabase SQL editor:
INSERT INTO users (email, password_hash, name, role, status)
VALUES (
  'admin@flowfi.co.ke',
  '$2a$12$...', -- bcrypt hash of your password (generate below)
  'Super Admin',
  'super_admin',
  'active'
);
```

Or use the bootstrap endpoint once on first run (set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `.env`).

### 5. Run development servers

```bash
# From project root — runs both backend and frontend
npm run dev

# Backend: http://localhost:5000
# Frontend: http://localhost:5173
```

---

## 🔑 Environment Variables Reference

### Backend (.env)

| Key | Description | Where to get it |
|-----|-------------|-----------------|
| `JWT_SECRET` | Random 32+ char string | Generate: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Different random string | Generate: `openssl rand -hex 32` |
| `SUPABASE_URL` | Your project URL | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Public anon key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key ⚠️ secret | Supabase → Settings → API |
| `MPESA_CONSUMER_KEY` | Daraja API consumer key | [developer.safaricom.co.ke](https://developer.safaricom.co.ke) |
| `MPESA_CONSUMER_SECRET` | Daraja API consumer secret | Safaricom Daraja portal |
| `MPESA_SHORTCODE` | Your M-Pesa shortcode | Safaricom Daraja portal |
| `MPESA_PASSKEY` | STK push passkey | Safaricom Daraja portal |
| `MPESA_CALLBACK_URL` | Public URL for callbacks | Your deployed domain + `/api/payments/mpesa/callback` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | [dashboard.paystack.com](https://dashboard.paystack.com) |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook secret | Paystack → Settings → Webhooks |
| `EMAIL_HOST` | SMTP host | e.g. `smtp.gmail.com` |
| `EMAIL_USER` | Email address | Your Gmail / Mailgun account |
| `EMAIL_PASS` | App password | Gmail → Security → App passwords |
| `AT_API_KEY` | Africa's Talking API key | [africastalking.com](https://africastalking.com) |
| `AT_USERNAME` | Africa's Talking username | AT dashboard |

### Frontend (.env)

| Key | Description |
|-----|-------------|
| `VITE_API_URL` | Backend URL, e.g. `http://localhost:5000/api` |
| `VITE_SUPABASE_URL` | Same as backend `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as backend `SUPABASE_ANON_KEY` |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key (starts with `pk_`) |
| `VITE_SOCKET_URL` | Backend URL for Socket.io |

---

## 🧩 System Architecture

```
Super Admin (you)
  ├── Approves/suspends tenants
  ├── Sets commission % per tenant
  ├── Views platform-wide analytics
  └── Manages shop (products, orders)

Tenant Admin (mall/market/hotel owner)
  ├── Connects MikroTik routers
  ├── Creates WiFi packages
  ├── Branded captive portal
  ├── M-Pesa / Paystack payments
  ├── Voucher generation
  ├── Loyalty rewards program
  └── Customer analytics

Customer (WiFi user)
  ├── Hits captive portal
  ├── Buys package via M-Pesa or Paystack
  ├── Gets instant WiFi access
  ├── Earns loyalty points
  └── Redeems rewards
```

---

## 🌐 Key URLs

| URL | Description |
|-----|-------------|
| `/` | Landing page |
| `/shop` | Public shop |
| `/register` | Tenant registration |
| `/login` | Login (admin + tenant) |
| `/admin` | Super admin dashboard |
| `/tenant` | Tenant dashboard |
| `/portal/:tenantId` | Customer captive portal |
| `/my-wifi/:tenantId` | Customer self-service portal |

---

## 📡 API Endpoints

### Auth
```
POST /api/auth/register       Tenant registration
POST /api/auth/login          Login (all roles)
POST /api/auth/refresh        Refresh JWT
GET  /api/auth/me             Get current user
```

### Payments
```
POST /api/payments/mpesa/initiate        STK Push
POST /api/payments/mpesa/callback        M-Pesa webhook (Safaricom calls this)
POST /api/payments/mpesa/query           Query STK status
POST /api/payments/paystack/initialize   Paystack payment
POST /api/payments/paystack/webhook      Paystack webhook
GET  /api/payments/paystack/verify/:ref  Verify Paystack payment
```

### Admin (super_admin only)
```
GET    /api/admin/dashboard
GET    /api/admin/tenants
PATCH  /api/admin/tenants/:id/status
PATCH  /api/admin/tenants/:id/commission
GET    /api/admin/analytics
GET    /api/admin/commissions
GET    /api/admin/settings
PUT    /api/admin/settings
```

### Tenant
```
GET  /api/tenant/dashboard
GET  /api/tenant/profile
PUT  /api/tenant/profile
GET  /api/tenant/sessions
GET  /api/tenant/transactions
GET  /api/tenant/analytics
GET  /api/tenant/customers
```

### Packages
```
GET    /api/packages/public/:tenantId    Public — for captive portal
GET    /api/packages                     List my packages
POST   /api/packages                     Create package
PUT    /api/packages/:id                 Update package
DELETE /api/packages/:id                 Deactivate package
```

### Routers (MikroTik)
```
GET  /api/routers               List my routers
POST /api/routers               Add router (tests connection)
POST /api/routers/:id/test      Test router connection
GET  /api/routers/:id/sessions  Live sessions on router
DEL  /api/routers/:id           Remove router
```

### Vouchers
```
POST /api/vouchers/generate     Generate batch
GET  /api/vouchers              List vouchers
GET  /api/vouchers/qr/:id       Get QR code
POST /api/vouchers/redeem       Redeem voucher (public)
```

### Loyalty
```
GET  /api/loyalty/balance/:tenantId/:phone    Customer points
GET  /api/loyalty/rewards/:tenantId           Rewards catalogue
POST /api/loyalty/redeem                      Redeem reward
GET  /api/loyalty/settings                    Tenant loyalty config
PUT  /api/loyalty/settings                    Update config
GET  /api/loyalty/rewards                     Manage rewards
POST /api/loyalty/rewards                     Create reward
GET  /api/loyalty/leaderboard                 Top customers
```

### Shop
```
GET  /api/shop/products                List products (public)
GET  /api/shop/products/:slug          Product detail (public)
POST /api/shop/orders                  Place order (public)
GET  /api/shop/orders/:reference       Track order (public)
POST /api/shop/products                Admin: add product
PUT  /api/shop/products/:id            Admin: update product
GET  /api/shop/admin/orders            Admin: all orders
PATCH /api/shop/admin/orders/:id       Admin: update order status
```

---

## 🔧 MikroTik Setup

For each tenant's router, enable the API:
```
/ip service enable api
/ip service set api port=8728
/user add name=flowfi password=STRONG_PASS group=full
```

Set the hotspot login page URL to your portal:
```
/ip hotspot profile set [find] login-by=http-chap html-directory=hotspot
```

Configure the walled garden to allow your FlowFi domain before login.

---

## 🚀 Deployment

**Backend:** Deploy to Railway, Render, or any Node.js host.

**Frontend:** Deploy to Vercel or Netlify.

**Supabase:** Already hosted — just update `SUPABASE_URL` in production `.env`.

**M-Pesa callbacks:** Requires a public HTTPS URL. Use ngrok for local testing:
```bash
ngrok http 5000
# Then set MPESA_CALLBACK_URL=https://xxxx.ngrok.io/api/payments/mpesa/callback
```

---

## 📝 Next Steps (pages to complete)

The following pages have been scaffolded and need full UI implementation:
- `frontend/src/pages/tenant/Routers.jsx` — Router add/test/remove UI
- `frontend/src/pages/tenant/Packages.jsx` — Package CRUD with happy hour config
- `frontend/src/pages/tenant/Vouchers.jsx` — Batch generate + print/QR view
- `frontend/src/pages/tenant/Loyalty.jsx` — Points settings + rewards catalogue
- `frontend/src/pages/tenant/Sessions.jsx` — Live sessions table
- `frontend/src/pages/tenant/Transactions.jsx` — Transaction history
- `frontend/src/pages/tenant/Customers.jsx` — Customer list + spending
- `frontend/src/pages/tenant/Settings.jsx` — Portal branding, payment config
- `frontend/src/pages/shop/ShopPage.jsx` — Product grid
- `frontend/src/pages/shop/ProductPage.jsx` — Product detail + add to cart
- `frontend/src/pages/shop/CartPage.jsx` — Cart
- `frontend/src/pages/shop/CheckoutPage.jsx` — Checkout + M-Pesa payment
- `frontend/src/pages/admin/Analytics.jsx` — Platform charts
- `frontend/src/pages/admin/Commissions.jsx` — Commission report
- `frontend/src/pages/admin/ShopProducts.jsx` — Product management
- `frontend/src/pages/admin/ShopOrders.jsx` — Order management

All API endpoints for these pages are complete in the backend.

---

Built with ❤️ in Nairobi · FlowFi © 2025
# flowfi-frontend
# flowfi-backend
