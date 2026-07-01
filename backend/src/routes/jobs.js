const express = require('express')
const router = express.Router()
const { runDailySubscriptionBilling } = require('../services/subscription.service')

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET || process.env.BILLING_JOB_SECRET
  if (!secret) return false

  return req.headers.authorization === `Bearer ${secret}`
}

router.all('/daily-billing', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const summary = await runDailySubscriptionBilling()
    return res.json({ ok: true, ...summary })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
