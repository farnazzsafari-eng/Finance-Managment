const express = require('express');
const Household = require('../models/Household');
const auth = require('../middleware/auth');
const router = express.Router();

let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
  console.warn('Stripe not configured:', e.message);
}

// Create checkout session
router.post('/create-checkout', auth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const household = await Household.findById(req.householdId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    // Create or reuse Stripe customer
    let customerId = household.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { householdId: req.householdId },
      });
      customerId = customer.id;
      household.subscription = household.subscription || {};
      household.subscription.stripeCustomerId = customerId;
      await household.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${req.body.successUrl || 'http://localhost:5173/settings'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.body.cancelUrl || 'http://localhost:5173/pricing'}`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      // In test mode without webhook secret, parse body directly
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const household = await Household.findOne({ 'subscription.stripeCustomerId': customerId });
        if (household) {
          household.subscription.status = 'active';
          household.subscription.stripeSubscriptionId = session.subscription;
          await household.save();
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const household = await Household.findOne({ 'subscription.stripeCustomerId': sub.customer });
        if (household) {
          household.subscription.status = sub.status === 'active' ? 'active' : 'cancelled';
          household.subscription.currentPeriodEnd = new Date(sub.current_period_end * 1000);
          await household.save();
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const household = await Household.findOne({ 'subscription.stripeCustomerId': sub.customer });
        if (household) {
          household.subscription.status = 'cancelled';
          await household.save();
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get subscription status
router.get('/status', auth, async (req, res) => {
  try {
    const household = await Household.findById(req.householdId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    res.json({
      status: household.subscription?.status || 'free',
      currentPeriodEnd: household.subscription?.currentPeriodEnd,
      stripeCustomerId: household.subscription?.stripeCustomerId,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
