import { useState, useEffect } from 'react';
import {
  getMonthlyReport, getByPersonReport, getByCardReport,
  getTopMerchants, getSavingsRate, getCashFlow, getYearOverYear, getUsers, getSummary,
  getCategoryDetails,
} from '../services/api';
import { groupByParentCategory, CATEGORY_HIERARCHY, SUB_COLORS } from '../utils/categoryMapping';
import DateRangeFilter, { getPresetDates } from '../components/DateRangeFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, LineChart, Line, ComposedChart,
} from 'recharts';
import './Reports.css';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'categories', label: 'Categories' },
  { key: 'person', label: 'By Person' },
  { key: 'card', label: 'By Card' },
  { key: 'merchants', label: 'Top Merchants' },
  { key: 'cashflow', label: 'Cash Flow' },
  { key: 'yoy', label: 'Year Compare' },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Reports() {
  const init = getPresetDates('thisYear');
  const [startDate, setStartDate] = useState(init.startDate);
  const [endDate, setEndDate] = useState(init.endDate);
  const [filterOwner, setFilterOwner] = useState('');
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('overview');

  const [savings, setSavings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [personData, setPersonData] = useState([]);
  const [cardData, setCardData] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [yoyData, setYoyData] = useState(null);
  const [year1, setYear1] = useState(new Date().getFullYear() - 1);
  const [year2, setYear2] = useState(new Date().getFullYear());
  const [expandedCat, setExpandedCat] = useState(null);

  useEffect(() => { getUsers().then((r) => setUsers(r.data)); }, []);

  useEffect(() => {
    const p = { startDate, endDate, owner: filterOwner || undefined };
    if (tab === 'overview') {
      getSavingsRate(p).then((r) => setSavings(r.data));
      getSummary(p).then((r) => setSummary(r.data));
    }
    if (tab === 'categories') getSummary(p).then((r) => setSummary(r.data));
    if (tab === 'person') getByPersonReport(p).then((r) => setPersonData(r.data));
    if (tab === 'card') getByCardReport(p).then((r) => setCardData(r.data));
    if (tab === 'merchants') getTopMerchants({ ...p, limit: 15 }).then((r) => setMerchants(r.data));
    if (tab === 'cashflow') getCashFlow(p).then((r) => setCashflow(r.data));
  }, [tab, startDate, endDate, filterOwner]);

  useEffect(() => {
    if (tab === 'yoy') getYearOverYear({ owner: filterOwner || undefined, year1, year2 }).then((r) => setYoyData(r.data));
  }, [tab, filterOwner, year1, year2]);

  return (
    <div className="reports-page">
      <div className="page-header"><h1>Reports</h1></div>
      <DateRangeFilter users={users} owner={filterOwner} onOwnerChange={setFilterOwner} startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
      <div className="tab-bar">
        {TABS.map((t) => (<button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>))}
      </div>
      <div className="tab-content">
        {tab === 'overview' && <OverviewTab savings={savings} summary={summary} />}
        {tab === 'categories' && <CategoriesTab summary={summary} expanded={expandedCat} setExpanded={setExpandedCat} dateParams={{startDate, endDate, owner: filterOwner || undefined}} />}
        {tab === 'person' && <PersonTab data={personData} />}
        {tab === 'card' && <CardTab data={cardData} />}
        {tab === 'merchants' && <MerchantsTab data={merchants} />}
        {tab === 'cashflow' && <CashFlowTab data={cashflow} />}
        {tab === 'yoy' && <YoYTab data={yoyData} year1={year1} year2={year2} setYear1={setYear1} setYear2={setYear2} />}
      </div>
    </div>
  );
}

function OverviewTab({ savings, summary }) {
  if (!savings.length) return <p className="no-data">No data for this period</p>;
  const chartData = savings.map((s) => ({
    name: `${MONTHS_SHORT[s.month - 1]} ${String(s.year).slice(2)}`,
    Income: s.income, Expense: s.expense, Savings: s.savings,
    'Rate%': Math.round(s.savingsRate),
  }));
  const totalIncome = savings.reduce((s, m) => s + m.income, 0);
  const totalExpense = savings.reduce((s, m) => s + m.expense, 0);
  const totalSavings = totalIncome - totalExpense;
  const avgRate = totalIncome > 0 ? (totalSavings / totalIncome * 100) : 0;

  return (
    <div>
      <div className="overview-stats">
        <div className="mini-stat green">Total Income<br /><strong>${totalIncome.toFixed(0)}</strong></div>
        <div className="mini-stat red">Total Expenses<br /><strong>${totalExpense.toFixed(0)}</strong></div>
        <div className="mini-stat blue">Net Savings<br /><strong>${totalSavings.toFixed(0)}</strong></div>
        <div className="mini-stat purple">Avg Savings Rate<br /><strong>{avgRate.toFixed(1)}%</strong></div>
      </div>
      <div className="chart-box">
        <h3>Income vs Expenses</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={12} />
            <Tooltip formatter={(v) => `$${Number(v).toFixed(0)}`} /><Legend />
            <Bar dataKey="Income" fill="#2ecc71" /><Bar dataKey="Expense" fill="#e74c3c" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-box">
        <h3>Savings Rate Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={12} />
            <Tooltip formatter={(v, name) => name === 'Rate%' ? `${v}%` : `$${Number(v).toFixed(0)}`} /><Legend />
            <Bar dataKey="Savings" fill="#3498db" />
            <Line type="monotone" dataKey="Rate%" stroke="#9b59b6" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {summary && (
        <div className="chart-box">
          <h3>Category Breakdown</h3>
          <table className="data-table"><thead><tr><th>Category</th><th>Amount</th><th>Count</th><th>%</th></tr></thead>
            <tbody>{summary.byCategory.map((c) => (
              <tr key={c._id}><td><span className="cat-dot-sm" style={{ background: SUB_COLORS[c._id] || '#999' }} />{c._id}</td>
                <td>${c.total.toFixed(2)}</td><td>{c.count}</td><td>{summary.totalExpense > 0 ? (c.total / summary.totalExpense * 100).toFixed(1) : 0}%</td></tr>
            ))}</tbody></table>
        </div>
      )}
    </div>
  );
}

function CategoriesTab({ summary, expanded, setExpanded, dateParams }) {
  const [detailCat, setDetailCat] = useState(null);
  const [catDetails, setCatDetails] = useState([]);

  if (!summary) return <p className="no-data">Loading...</p>;
  const parentGroups = groupByParentCategory(summary.byCategory);
  const totalExp = summary.byCategory.reduce((s, c) => s + c.total, 0);

  const showDetails = (catName) => {
    if (detailCat === catName) { setDetailCat(null); return; }
    setDetailCat(catName);
    getCategoryDetails({ ...dateParams, category: catName }).then((r) => setCatDetails(r.data));
  };

  return (
    <div>
      <div className="chart-box">
        <h3>{expanded ? <><button className="back-btn" onClick={() => { setExpanded(null); setDetailCat(null); }}>← All</button>{expanded}</> : 'Category Groups'}</h3>
        <div className="cat-detail-bars">
          {expanded
            ? parentGroups.find((g) => g.name === expanded)?.subs.map((sub) => {
                const pct = totalExp > 0 ? (sub.total / totalExp * 100) : 0;
                const color = CATEGORY_HIERARCHY[expanded]?.color || '#999';
                return (<div key={sub.name}>
                  <div className={`cat-bar-row clickable ${detailCat === sub.name ? 'active' : ''}`} onClick={() => showDetails(sub.name)}>
                    <div className="cat-bar-label"><span className="cat-dot" style={{ background: color }} /><span className="cat-name">{sub.name}</span></div>
                    <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${Math.max(pct * 2, 1)}%`, background: color }} /></div>
                    <div className="cat-bar-value"><span className="cat-amount">${sub.total.toFixed(0)}</span><span className="cat-count">{sub.count} txn</span></div>
                  </div>
                  {detailCat === sub.name && catDetails.length > 0 && (
                    <div className="inline-details">
                      {catDetails.slice(0, 15).map((d) => (
                        <div key={d._id} className="detail-row">
                          <span className="detail-desc">{d._id}</span>
                          <span className="detail-amt">${d.total.toFixed(2)} ({d.count}x)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>);
              })
            : parentGroups.filter((g) => g.name !== 'Income').map((g) => {
                const pct = totalExp > 0 ? (g.total / totalExp * 100) : 0;
                return (<div key={g.name} className="cat-bar-row clickable" onClick={() => g.subs.length > 1 ? setExpanded(g.name) : showDetails(g.subs[0]?.name)}>
                  <div className="cat-bar-label"><span className="cat-dot" style={{ background: g.color }} /><span className="cat-name">{g.icon} {g.name}</span>{g.subs.length > 1 && <span className="drill-arrow">›</span>}</div>
                  <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${pct}%`, background: g.color }} /></div>
                  <div className="cat-bar-value"><span className="cat-amount">${g.total.toFixed(0)}</span><span className="cat-pct">{pct.toFixed(0)}%</span></div></div>);
              })
          }
        </div>
      </div>
      <div className="chart-box">
        <h3>All Subcategories</h3>
        <table className="data-table"><thead><tr><th>Group</th><th>Category</th><th>Amount</th><th>Count</th><th>%</th></tr></thead>
          <tbody>{parentGroups.filter((g) => g.name !== 'Income').flatMap((g) => g.subs.map((sub) => (
            <tr key={sub.name}><td><span className="cat-dot-sm" style={{ background: g.color }} />{g.name}</td><td>{sub.name}</td>
              <td>${sub.total.toFixed(2)}</td><td>{sub.count}</td><td>{totalExp > 0 ? (sub.total / totalExp * 100).toFixed(1) : 0}%</td></tr>
          )))}</tbody></table>
      </div>
    </div>
  );
}

function PersonTab({ data }) {
  if (!data.length) return <p className="no-data">No data</p>;
  const persons = {};
  data.forEach((d) => { const n = d._id.owner; if (!persons[n]) persons[n] = { name: n, total: 0, cats: [] }; persons[n].total += d.total; persons[n].cats.push({ cat: d._id.category, total: d.total, count: d.count }); });
  const pl = Object.values(persons).sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="chart-box"><h3>Spending by Person</h3>
        <ResponsiveContainer width="100%" height={100 + pl.length * 40}>
          <BarChart data={pl.map((p) => ({ name: p.name, Total: p.total }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" fontSize={13} width={90} />
            <Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Bar dataKey="Total" fill="#e74c3c" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {pl.map((p) => (<div key={p.name} className="chart-box"><h3>{p.name} — ${p.total.toFixed(2)}</h3>
        <table className="data-table compact"><thead><tr><th>Category</th><th>Amount</th><th>Count</th><th>%</th></tr></thead>
          <tbody>{p.cats.sort((a, b) => b.total - a.total).slice(0, 10).map((c) => (
            <tr key={c.cat}><td><span className="cat-dot-sm" style={{ background: SUB_COLORS[c.cat] || '#999' }} />{c.cat}</td>
              <td>${c.total.toFixed(2)}</td><td>{c.count}</td><td>{(c.total / p.total * 100).toFixed(0)}%</td></tr>
          ))}</tbody></table></div>))}
    </div>
  );
}

function CardTab({ data }) {
  if (!data.length) return <p className="no-data">No data</p>;
  const cd = data.map((d) => ({ name: `${d._id.bank || 'Store'} (${d._id.cardType || '?'})`, Total: d.total }));
  return (<div className="chart-box"><h3>Spending by Card</h3>
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart data={cd} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" fontSize={12} width={160} />
        <Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Bar dataKey="Total" fill="#3498db" /></BarChart>
    </ResponsiveContainer></div>);
}

function MerchantsTab({ data }) {
  if (!data.length) return <p className="no-data">No data</p>;
  return (
    <div>
      <div className="chart-box"><h3>Top Merchants</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, data.length * 30)}>
          <BarChart data={data.map((d) => ({ name: d._id?.substring(0, 35) || '?', Total: d.total }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" fontSize={11} width={220} />
            <Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Bar dataKey="Total" fill="#ff5722" /></BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-box"><h3>Details</h3>
        <table className="data-table"><thead><tr><th>Merchant</th><th>Total</th><th>Count</th><th>Avg</th></tr></thead>
          <tbody>{data.map((d) => (<tr key={d._id}><td>{d._id?.substring(0, 50)}</td><td>${d.total.toFixed(2)}</td><td>{d.count}</td><td>${d.avgAmount.toFixed(2)}</td></tr>))}</tbody></table>
      </div>
    </div>
  );
}

function CashFlowTab({ data }) {
  if (!data.length) return <p className="no-data">No data</p>;
  const weekly = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, i + 7);
    weekly.push({ date: chunk[0].date.substring(5), income: chunk.reduce((s, d) => s + d.income, 0), expense: chunk.reduce((s, d) => s + d.expense, 0), balance: chunk[chunk.length - 1].cumulativeBalance });
  }
  return (<div className="chart-box"><h3>Weekly Cash Flow</h3>
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={12} />
        <Tooltip formatter={(v) => `$${Number(v).toFixed(0)}`} /><Legend />
        <Area type="monotone" dataKey="income" fill="#d4edda" stroke="#2ecc71" />
        <Area type="monotone" dataKey="expense" fill="#fde8e8" stroke="#e74c3c" />
        <Line type="monotone" dataKey="balance" stroke="#3498db" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer></div>);
}

function YoYTab({ data, year1, year2, setYear1, setYear2 }) {
  return (
    <div>
      <div className="yoy-selectors">
        <label>Year 1: <input type="number" value={year1} onChange={(e) => setYear1(+e.target.value)} min={2024} max={2030} /></label>
        <label>Year 2: <input type="number" value={year2} onChange={(e) => setYear2(+e.target.value)} min={2024} max={2030} /></label>
      </div>
      {data ? (<div className="chart-box"><h3>Expenses: {data.year1} vs {data.year2}</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} />
            <Tooltip formatter={(v) => `$${Number(v).toFixed(0)}`} /><Legend />
            <Bar dataKey={`${data.year1}_expense`} name={`${data.year1}`} fill="#f39c12" />
            <Bar dataKey={`${data.year2}_expense`} name={`${data.year2}`} fill="#e74c3c" /></BarChart>
        </ResponsiveContainer>
        <div className="yoy-summary">
          <div className="mini-stat orange">{data.year1} Total<br /><strong>${data.data.reduce((s, d) => s + d[`${data.year1}_expense`], 0).toFixed(0)}</strong></div>
          <div className="mini-stat red">{data.year2} Total<br /><strong>${data.data.reduce((s, d) => s + d[`${data.year2}_expense`], 0).toFixed(0)}</strong></div>
        </div></div>) : <p className="no-data">Loading...</p>}
    </div>
  );
}
