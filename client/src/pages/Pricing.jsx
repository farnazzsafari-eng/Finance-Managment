import { useState, useEffect } from 'react';
import { getSubscriptionStatus, createCheckoutSession } from '../services/api';
import './Pricing.css';

export default function Pricing() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubscriptionStatus()
      .then((r) => setSubscription(r.data))
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await createCheckoutSession({
        successUrl: window.location.origin + '/settings',
        cancelUrl: window.location.origin + '/pricing',
      });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      alert('Stripe is in test mode. Replace placeholder keys in .env to enable checkout.');
    }
    setLoading(false);
  };

  const isActive = subscription?.status === 'active';

  return (
    <div className="pricing-page">
      <h1>Choose Your Plan</h1>
      <p className="pricing-subtitle">
        Manage your household finances with powerful tools
      </p>

      <div className="plans-grid">
        <div className={`plan-card ${!isActive ? 'current' : ''}`}>
          <div className="plan-header">
            <h2>Free</h2>
            <div className="plan-price">
              <span className="price-amount">$0</span>
              <span className="price-period">/month</span>
            </div>
          </div>
          <ul className="plan-features">
            <li>View Dashboard</li>
            <li>View Transactions</li>
            <li>View Reports</li>
            <li>View Account Balances</li>
            <li className="disabled">CSV Import</li>
            <li className="disabled">Email Reminders</li>
          </ul>
          {!isActive && (
            <div className="plan-badge">Current Plan</div>
          )}
        </div>

        <div className={`plan-card pro ${isActive ? 'current' : ''}`}>
          <div className="plan-ribbon">Recommended</div>
          <div className="plan-header">
            <h2>Pro</h2>
            <div className="plan-price">
              <span className="price-amount">$49.90</span>
              <span className="price-period">/month</span>
            </div>
          </div>
          <ul className="plan-features">
            <li>Everything in Free</li>
            <li>CSV Import</li>
            <li>Email Reminders</li>
            <li>Financial Advisor Access</li>
            <li>Priority Support</li>
            <li>Unlimited Households</li>
          </ul>
          {isActive ? (
            <div className="plan-badge active">Active</div>
          ) : (
            <button
              className="btn-subscribe"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? 'Redirecting...' : 'Subscribe Now'}
            </button>
          )}
        </div>
      </div>

      {isActive && subscription?.currentPeriodEnd && (
        <p className="subscription-info">
          Your Pro subscription renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
