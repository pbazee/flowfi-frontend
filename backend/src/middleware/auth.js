const jwt = require('jsonwebtoken');
const { getSupabaseAdmin } = require('../lib/supabase');

function normalizeUserRole(role) {
  if (role === 'admin') return 'super_admin';
  if (role === 'tenant') return 'tenant_admin';
  return role;
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const db = getSupabaseAdmin();
    const { data: user, error } = await db
      .from('users')
      .select('id, email, role, status, tenant_id')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return res.status(401).json({ error: 'User not found' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account suspended' });

    req.user = { ...user, role: normalizeUserRole(user.role) };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(normalizeUserRole(req.user.role))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireTenantOwnership(req, res, next) {
  if (normalizeUserRole(req.user.role) === 'super_admin') return next();
  const tenantId = req.params.tenantId || req.body.tenant_id || req.query.tenant_id;
  if (tenantId && tenantId !== req.user.tenant_id) {
    return res.status(403).json({ error: 'Access denied to this tenant' });
  }
  next();
}

function blockDemoMutations(req, res, next) {
  if (req.user?.email === 'demo@flowfi.app' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return res.status(403).json({ error: 'Demo accounts cannot modify data.' });
  }
  next();
}

module.exports = { authenticate, normalizeUserRole, requireRole, requireTenantOwnership, blockDemoMutations };
