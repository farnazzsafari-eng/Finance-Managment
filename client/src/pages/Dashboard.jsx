import { useState, useEffect } from 'react';
import { getSummary, getMonthlyTrend, getOverallBalance, getUsers, getCategoryDetails, getBalances, getCategoryDetailReport } from '../services/api';
import { groupByParentCategory, CATEGORY_HIERARCHY } from '../utils/categoryMapping';
import DateRangeFilter, { getPresetDates } from '../components/DateRangeFilter';
import BankLogo from '../components/BankLogo';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import './Dashboard.css';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TRACKED_CATEGORIES = [
  { emoji: '⚡', label: 'Electricity', category: 'Utilities', subCategory: 'Electricity' },
  { emoji: '⛽', label: 'Gas/Fuel', category: 'Gas', subCategory: '' },
  { emoji: '🌐', label: 'Internet', category: 'Utilities', subCategory: 'Internet' },
  { emoji: '📱', label: 'Phone', category: 'Utilities', subCategory: 'Phone' },
  { emoji: '🏠', label: 'Rent', category: 'Housing/Rent', subCategory: '' },
  { emoji: '🚬', label: 'Smoking/Vape', category: 'Shopping', subCategory: 'Smoking/Vape' },
  { emoji: '📺', label: 'Subscriptions', category: 'Subscriptions', subCategory: '' },
  { emoji: '🍷', label: 'Alcohol', category: 'Entertainment', subCategory: 'Alcohol' },
  { emoji: '🛒', label: 'Costco', category: 'Groceries', subCategory: 'Costco' },
];

function TrackedExpenses({ startDate, endDate, owner }) {
  const [data, setData] = useState({});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    TRACKED_CATEGORIES.forEach((tc) => {
      getCategoryDetailReport({
        category: tc.category,
        subCategory: tc.subCategory || undefined,
        startDate, endDate,
        owner: owner || undefined,
      }).then((r) => {
        setData((prev) => ({ ...prev, [tc.label]: r.data }));
      });
    });
    setExpanded(null);
  }, [startDate, endDate, owner]);

  const fmt = (v) => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

  return (
    <div className="tracked-expenses">
      <h3>Tracked Expenses</h3>
      <div className="tracked-grid">
        {TRACKED_CATEGORIES.map((tc) => {
          const d = data[tc.label];
          const isOpen = expanded === tc.label;
          return (
            <div key={tc.label} className={`tracked-card ${isOpen ? 'expanded' : ''}`} onClick={() => setExpanded(isOpen ? null : tc.label)}>
              <div className="tracked-header">
                <span className="tracked-emoji">{tc.emoji}</span>
                <span className="tracked-label">{tc.label}</span>
                <span className="tracked-arrow">{isOpen ? '▼' : '▶'}</span>
              </div>
              <div className="tracked-amount">{fmt(d?.total)}</div>
              <div className="tracked-meta">
                {d?.count || 0} txn &bull; avg {fmt(d?.average)}/mo
              </div>

              {isOpen && d && (
                <div className="tracked-detail" onClick={(e) => e.stopPropagation()}>
                  {d.monthlyTotals?.length > 0 && (
                    <div className="tracked-monthly">
                      <h4>Monthly Breakdown</h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={d.monthlyTotals}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip formatter={(v) => fmt(v)} />
                          <Bar dataKey="total" fill="#e74c3c" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {d.transactions?.length > 0 && (
                    <div className="tracked-txns">
                      <h4>Transactions ({d.transactions.length})</h4>
                      <div className="tracked-table-wrap">
                        <table className="tracked-table">
                          <thead>
                            <tr><th>Date</th><th>Description</th><th>Amount</th><th>Card</th><th>Owner</th></tr>
                          </thead>
                          <tbody>
                            {d.transactions.slice(0, 50).map((t, i) => (
                              <tr key={i}>
                                <td>{new Date(t.date).toLocaleDateString('en-CA')}</td>
                                <td>{t.description?.substring(0, 40)}</td>
                                <td className="red">{fmt(t.amount)}</td>
                                <td>{t.bank} {t.cardType}</td>
                                <td>{t.owner?.name || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const initDates = getPresetDates('thisMonth');
  const [startDate, setStartDate] = useState(initDates.startDate);
  const [endDate, setEndDate] = useState(initDates.endDate);
  const [filterOwner, setFilterOwner] = useState('');
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [overallBal, setOverallBal] = useState(null);
  const [expandedCat, setExpandedCat] = useState(null);
  const [catDetails, setCatDetails] = useState([]);
  const [detailCat, setDetailCat] = useState(null);
  const [balances, setBalances] = useState(null);

  useEffect(() => {
    getUsers().then((r) => setUsers(r.data));
    getOverallBalance({}).then((r) => setOverallBal(r.data));
    getBalances().then((r) => setBalances(r.data));
  }, []);

  useEffect(() => {
    const params = { startDate, endDate };
    if (filterOwner) params.owner = filterOwner;
    getSummary(params).then((r) => setSummary(r.data));
    getMonthlyTrend(params).then((r) => setTrend(r.data));
    // Update overall balance for owner filter
    getOverallBalance({ owner: filterOwner || undefined }).then((r) => setOverallBal(r.data));
  }, [startDate, endDate, filterOwner]);

  const handleDateChange = (s, e) => { setStartDate(s); setEndDate(e); };

  if (!summary) return <div className="loading">Loading...</div>;

  const parentGroups = groupByParentCategory(summary.byCategory);
  const totalExpense = summary.byCategory.reduce((s, c) => s + c.total, 0);

  const barData = trend.map((t) => ({
    name: `${MONTHS_SHORT[t.month - 1]} ${t.year !== new Date().getFullYear() ? t.year : ''}`.trim(),
    Income: t.income,
    Expense: t.expense,
  }));

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <DateRangeFilter
        users={users}
        owner={filterOwner}
        onOwnerChange={setFilterOwner}
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateChange}
      />

      <div className="summary-cards">
        <div className="card income">
          <h3>Income</h3>
          <p>${summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="card expense">
          <h3>Expenses</h3>
          <p>${summary.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="card internal">
          <h3>Internal Transfer</h3>
          <p>${(summary.internalTransfers?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <small>{summary.internalTransfers?.count || 0} transactions</small>
        </div>
        <div className="card balance">
          <h3>Period Balance</h3>
          <p>${summary.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="card total-balance">
          <h3>Actual Balance</h3>
          <p>${(() => {
            if (!balances?.accounts) return '...';
            const USD_RATE = 1.40;
            const total = balances.accounts
              .filter((a) => a.type === 'bank')
              .reduce((s, a) => s + (a.currency === 'USD' ? a.amount * USD_RATE : a.amount), 0);
            return total.toLocaleString('en-US', { minimumFractionDigits: 0 });
          })()}</p>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-container">
          <div className="chart-header">
            <h3>
              {expandedCat
                ? <><button className="back-btn" onClick={() => setExpandedCat(null)}>All</button> {expandedCat}</>
                : 'Expenses by Category'
              }
            </h3>
          </div>

          {expandedCat ? (
            // Drill-down: show subcategories + click for item details
            <div>
              <div className="category-bars">
                {parentGroups
                  .find((g) => g.name === expandedCat)
                  ?.subs.map((sub) => {
                    const pct = totalExpense > 0 ? (sub.total / totalExpense) * 100 : 0;
                    const parentColor = CATEGORY_HIERARCHY[expandedCat]?.color || '#999';
                    const isActive = detailCat === sub.name;
                    return (
                      <div key={sub.name} className={`cat-bar-row clickable ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setDetailCat(isActive ? null : sub.name);
                          if (!isActive) {
                            getCategoryDetails({ startDate, endDate, owner: filterOwner || undefined, category: sub.name })
                              .then((r) => setCatDetails(r.data));
                          }
                        }}>
                        <div className="cat-bar-label">
                          <span className="cat-dot" style={{ background: parentColor }} />
                          <span className="cat-name">{sub.name}</span>
                        </div>
                        <div className="cat-bar-track">
                          <div className="cat-bar-fill" style={{ width: `${pct}%`, background: parentColor }} />
                        </div>
                        <div className="cat-bar-value">
                          <span className="cat-amount">${sub.total.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                          <span className="cat-count">{sub.count} txn</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              {detailCat && catDetails.length > 0 && (
                <div className="cat-details-table">
                  <h4>{detailCat} — Items</h4>
                  <table className="detail-table">
                    <thead><tr><th>Description</th><th>Amount</th><th>Count</th></tr></thead>
                    <tbody>
                      {catDetails.map((d) => (
                        <tr key={d._id}><td>{d._id}</td><td>${d.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td>{d.count}x</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            // Parent groups view
            <div className="category-bars">
              {parentGroups
                .filter((g) => g.name !== 'Income')
                .map((g) => {
                  const pct = totalExpense > 0 ? (g.total / totalExpense) * 100 : 0;
                  return (
                    <div
                      key={g.name}
                      className="cat-bar-row clickable"
                      onClick={() => g.subs.length > 1 ? setExpandedCat(g.name) : null}
                    >
                      <div className="cat-bar-label">
                        <span className="cat-dot" style={{ background: g.color }} />
                        <span className="cat-name">{g.icon} {g.name}</span>
                        {g.subs.length > 1 && <span className="drill-arrow">›</span>}
                      </div>
                      <div className="cat-bar-track">
                        <div className="cat-bar-fill" style={{ width: `${pct}%`, background: g.color }} />
                      </div>
                      <div className="cat-bar-value">
                        <span className="cat-amount">${g.total.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                        <span className="cat-pct">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="chart-container">
          <h3>Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="Income" fill="#2ecc71" />
              <Bar dataKey="Expense" fill="#e74c3c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-container">
          <h3>By Bank</h3>
          {summary.byBank.length > 0 ? (
            <div className="stat-list">
              {summary.byBank.map((b) => (
                <div key={b._id} className="stat-item">
                  <span><BankLogo bank={b._id} size="sm" /> {b._id || 'Store'}</span>
                  <span>${b.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          ) : <p className="no-data">No data</p>}
        </div>
        <div className="chart-container">
          <h3>By Card Type</h3>
          {summary.byCardType.length > 0 ? (
            <div className="stat-list">
              {summary.byCardType.map((c) => (
                <div key={c._id} className="stat-item">
                  <span>{c._id || 'Unknown'}</span>
                  <span>${c.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : <p className="no-data">No data</p>}
        </div>
      </div>

      <TrackedExpenses startDate={startDate} endDate={endDate} owner={filterOwner} />

      {balances?.accounts?.length > 0 && (() => {
        const USD_RATE = 1.40;
        const bankAccounts = balances.accounts.filter((a) => a.type === 'bank');
        const assets = balances.accounts.filter((a) => a.type === 'asset');
        const liabilities = balances.accounts.filter((a) => a.type === 'liability');

        const toCAD = (a) => a.currency === 'USD' ? a.amount * USD_RATE : a.amount;
        const bankTotal = bankAccounts.reduce((s, a) => s + toCAD(a), 0);
        const assetTotal = assets.reduce((s, a) => s + toCAD(a), 0);
        const liabTotal = liabilities.reduce((s, a) => s + toCAD(a), 0);
        const netWorth = bankTotal + assetTotal - liabTotal;

        return (
          <>
            <div className="charts-row">
              <div className="chart-container">
                <h3>Account Balances</h3>
                <div className="stat-list">
                  {bankAccounts.map((a, i) => (
                    <div key={i} className="stat-item">
                      <span>{a.label} <span className="owner-tag">{a.owner}</span></span>
                      <span className="green">{a.currency === 'USD' ? 'US' : ''}${a.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="stat-item total-row">
                    <span><strong>Total (CAD)</strong></span>
                    <span className="green"><strong>${bankTotal.toLocaleString('en-US', { minimumFractionDigits: 0 })}</strong></span>
                  </div>
                </div>
              </div>

              <div className="chart-container">
                <h3>Assets & Receivables</h3>
                <div className="stat-list">
                  {assets.map((a, i) => (
                    <div key={i} className="stat-item">
                      <span>{a.label} {a.note && <span className="note-tag">{a.note}</span>}</span>
                      <span className="blue">{a.currency === 'USD' ? 'US' : ''}${a.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="stat-item total-row">
                    <span><strong>Total Assets (CAD)</strong></span>
                    <span className="blue"><strong>${assetTotal.toLocaleString('en-US', { minimumFractionDigits: 0 })}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="net-worth-card">
              <h3>Net Worth</h3>
              <p className={netWorth >= 0 ? 'positive' : 'negative'}>
                ${netWorth.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
              <div className="nw-breakdown">
                <span>Bank: ${bankTotal.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                <span>Assets: ${assetTotal.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                {liabTotal > 0 && <span>Liabilities: -${liabTotal.toLocaleString()}</span>}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
