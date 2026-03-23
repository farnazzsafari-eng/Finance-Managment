import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import './Review.css';

const CATEGORIES = [
  'Groceries', 'Restaurants', 'Transportation', 'Housing/Rent',
  'Utilities', 'Entertainment', 'Health', 'Education', 'Clothing',
  'Subscriptions', 'Shopping', 'Gas', 'Insurance', 'Income', 'Transfer',
  'Transfers', 'Fees & Charges', 'Pets', 'Food Delivery',
  'Travel', 'Salary', 'Furniture', 'Personal Care', 'Other',
];

export default function Review() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [filter, setFilter] = useState('Other');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, reviewed: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, txRes] = await Promise.all([
        api.get('/users'),
        api.get('/transactions', {
          params: {
            category: filter || undefined,
            owner: ownerFilter || undefined,
          },
        }),
      ]);
      setUsers(usersRes.data);

      // Group by unique description for batch editing
      const grouped = {};
      txRes.data.forEach((t) => {
        const key = t.description.substring(0, 60);
        if (!grouped[key]) {
          grouped[key] = {
            key,
            description: t.description,
            category: t.category,
            type: t.type,
            bank: t.bank,
            owner: t.owner,
            count: 0,
            totalAmount: 0,
            ids: [],
            dates: [],
          };
        }
        grouped[key].count++;
        grouped[key].totalAmount += t.amount;
        grouped[key].ids.push(t._id);
        grouped[key].dates.push(t.date);
      });

      const sorted = Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
      setTransactions(sorted);
      setStats({
        total: txRes.data.length,
        groups: sorted.length,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [filter, ownerFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateCategory = async (group, newCategory) => {
    setSaving((s) => ({ ...s, [group.key]: true }));
    try {
      await Promise.all(
        group.ids.map((id) =>
          api.put(`/transactions/${id}`, { category: newCategory })
        )
      );
      // Remove from list
      setTransactions((prev) => prev.filter((t) => t.key !== group.key));
      setStats((s) => ({ ...s, total: s.total - group.count, groups: s.groups - 1 }));
    } catch (err) {
      console.error(err);
    }
    setSaving((s) => ({ ...s, [group.key]: false }));
  };

  const updateType = async (group, newType) => {
    setSaving((s) => ({ ...s, [group.key + '_type']: true }));
    try {
      await Promise.all(
        group.ids.map((id) =>
          api.put(`/transactions/${id}`, { type: newType })
        )
      );
      group.type = newType;
      setTransactions([...transactions]);
    } catch (err) {
      console.error(err);
    }
    setSaving((s) => ({ ...s, [group.key + '_type']: false }));
  };

  const getOwnerName = (ownerId) => {
    const user = users.find((u) => u._id === ownerId);
    return user?.name || '';
  };

  return (
    <div className="review-page">
      <div className="review-header">
        <h1>Review Transactions</h1>
        <div className="review-stats">
          <span className="stat-badge">{stats.total} transactions</span>
          <span className="stat-badge">{stats.groups} groups</span>
        </div>
      </div>

      <div className="review-filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>{u.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <h3>All caught up!</h3>
          <p>No transactions to review in this category.</p>
        </div>
      ) : (
        <div className="review-list">
          {transactions.map((group) => (
            <div key={group.key} className="review-card">
              <div className="review-card-top">
                <div className="review-info">
                  <span className={`type-badge ${group.type}`}>{group.type}</span>
                  <span className="review-desc">{group.description}</span>
                </div>
                <div className="review-meta">
                  <span className="review-amount">
                    ${group.totalAmount.toFixed(2)}
                  </span>
                  <span className="review-count">{group.count}x</span>
                  <span className="review-bank">{group.bank || ''}</span>
                  <span className="review-owner">{getOwnerName(group.owner)}</span>
                </div>
              </div>
              <div className="review-card-bottom">
                <div className="review-actions">
                  <select
                    className="category-select"
                    value={group.category}
                    onChange={(e) => updateCategory(group, e.target.value)}
                    disabled={saving[group.key]}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="type-toggle">
                    <button
                      className={`toggle-btn ${group.type === 'expense' ? 'active' : ''}`}
                      onClick={() => updateType(group, 'expense')}
                      disabled={saving[group.key + '_type']}
                    >
                      Expense
                    </button>
                    <button
                      className={`toggle-btn ${group.type === 'income' ? 'active' : ''}`}
                      onClick={() => updateType(group, 'income')}
                      disabled={saving[group.key + '_type']}
                    >
                      Income
                    </button>
                  </div>
                </div>
                <div className="quick-cats">
                  {['Groceries', 'Shopping', 'Restaurants', 'Transportation', 'Transfers', 'Clothing', 'Entertainment'].map((c) => (
                    <button
                      key={c}
                      className="quick-cat-btn"
                      onClick={() => updateCategory(group, c)}
                      disabled={saving[group.key]}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
