import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  getTransactions, getUsers, createTransaction, deleteTransaction, updateTransaction,
  getSavingsRate, getSummary, getByPersonReport, getByCardReport,
  getTopMerchants, getCashFlow, getYearOverYear, getCategoryDetails,
  getCategoryDetailReport,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import BankLogo from '../components/BankLogo';
import { groupByParentCategory, CATEGORY_HIERARCHY, SUB_COLORS } from '../utils/categoryMapping';
import DateRangeFilter, { getPresetDates } from '../components/DateRangeFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, LineChart, Line, ComposedChart,
} from 'recharts';
import './Transactions.css';

// Category -> SubCategory mapping
const CATEGORY_MAP = {
  'Groceries': ['Supermarket', 'Costco', 'Walmart', 'Save-On-Foods', 'Superstore', 'Specialty Store', 'Other'],
  'Restaurants': ['Fast Food', 'Dine-in', 'Cafe/Coffee', 'Bar/Pub', 'Other'],
  'Food Delivery': ['UberEats', 'DoorDash', 'SkipTheDishes', 'Other'],
  'Transportation': ['Gas', 'Transit/Compass', 'Uber/Lyft', 'Car Lease', 'Car Repair', 'EV Charging', 'Parking', 'Other'],
  'Housing/Rent': ['Rent', 'Mortgage', 'Property Tax', 'Home Repair', 'Other'],
  'Utilities': ['Phone/Mobile', 'Internet', 'Hydro/Electric', 'Water', 'Other'],
  'Entertainment': ['Streaming', 'Events/Tickets', 'Wine/Liquor', 'Gaming', 'Other'],
  'Health': ['Pharmacy', 'Dental', 'Doctor/Clinic', 'Prescriptions', 'Other'],
  'Education': ['Tuition', 'Course', 'Immigration', 'Books', 'Other'],
  'Clothing': ['Shoes', 'Casual Wear', 'Sports Wear', 'Accessories', 'Other'],
  'Personal Care': ['Salon/Barber', 'Skincare', 'Training', 'Other'],
  'Subscriptions': ['Software/Apps', 'Membership', 'Cloud Storage', 'AI Tools', 'Other'],
  'Shopping': ['Amazon', 'Home Depot', 'IKEA', 'Canadian Tire', 'Temu', 'Best Buy', 'Electronics', 'Home/Kitchen', 'Vape', 'Books', 'Other'],
  'Gas': ['Chevron', 'Costco Gas', 'Shell', 'Esso', 'Petro-Canada', 'Other'],
  'Insurance': ['Car Insurance', 'Life Insurance', 'Home Insurance', 'Health Insurance', 'Other'],
  'Travel': ['Flights', 'Hotels', 'Car Rental', 'Activities', 'Other'],
  'Furniture': ['Living Room', 'Bedroom', 'Kitchen', 'Office', 'Other'],
  'Pets': ['Food', 'Supplies', 'Vet', 'Other'],
  'Salary': ['Payroll', 'Freelance', 'Side Income', 'Other'],
  'Fees & Charges': ['Bank Fee', 'Interest', 'NSF Fee', 'Annual Fee', 'Other'],
  'Transfers': ['E-Transfer Sent', 'E-Transfer Received', 'Wire Transfer', 'Other'],
  'Internal Transfer': ['Between Own Accounts', 'Credit Card Payment', 'Refund/Reversal', 'Other'],
  'Income': ['Salary', 'Freelance', 'Investment', 'Refund', 'Other'],
  'Transfer': ['Internal', 'External', 'Other'],
  'Other': ['Uncategorized', 'Other'],
};

const ALL_CATEGORIES = Object.keys(CATEGORY_MAP);
const BANKS = ['Wealthsimple', 'Scotia', 'TD', 'CIBC', 'RBC'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REPORT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'categories', label: 'Categories' },
  { key: 'catdetail', label: 'By Category Detail' },
  { key: 'person', label: 'By Person' },
  { key: 'card', label: 'By Card' },
  { key: 'merchants', label: 'Top Merchants' },
  { key: 'cashflow', label: 'Cash Flow' },
  { key: 'yoy', label: 'Year Compare' },
];

const TRANSFER_CATEGORIES = ['Transfers', 'Internal Transfer', 'Transfer'];

function fmt(n) {
  return n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parse sender/receiver from transfer description */
function parseTransferParties(description, type) {
  if (!description) return { from: '', to: '' };
  const desc = description.trim();

  // E-TRANSFER patterns
  // "Internet Banking E-TRANSFER 011530733302 FARNAZ SAFARI" -> receiver
  // "E-TRANSFER ***f4j" -> masked
  // "SEND E-TFR ***Jwc" -> sent to someone
  // "payroll deposit Payroll" -> from employer

  let from = '';
  let to = '';

  // Pattern: E-TRANSFER followed by a number then a NAME
  const eTransferName = desc.match(/E-TRANSFER\s+\d+\s+(.+)/i);
  if (eTransferName) {
    const name = eTransferName[1].trim();
    if (type === 'expense') {
      to = titleCase(name);
    } else {
      from = titleCase(name);
    }
    return { from, to };
  }

  // Pattern: E-TRANSFER followed by a name (no number)
  const eTransferDirect = desc.match(/E-TRANSFER\s+(?!\*{2,})([A-Z][A-Z\s]+)/i);
  if (eTransferDirect) {
    const name = eTransferDirect[1].trim();
    if (name.length > 2 && !name.match(/^\*+/)) {
      if (type === 'expense') {
        to = titleCase(name);
      } else {
        from = titleCase(name);
      }
      return { from, to };
    }
  }

  // Pattern: masked E-TRANSFER ***xxx
  const maskedTransfer = desc.match(/E-TRANSFER\s+\*{2,}\w*/i) || desc.match(/E-TFR\s+\*{2,}\w*/i);
  if (maskedTransfer) {
    if (type === 'expense') {
      to = '(masked)';
    } else {
      from = '(masked)';
    }
    return { from, to };
  }

  // Pattern: SEND E-TFR
  const sendEtfr = desc.match(/SEND\s+E-TFR\s+(.*)/i);
  if (sendEtfr) {
    const remainder = sendEtfr[1].trim();
    to = remainder.match(/^\*{2,}/) ? '(masked)' : (remainder ? titleCase(remainder) : '(unknown)');
    return { from, to };
  }

  // Pattern: payroll / deposit
  if (desc.match(/payroll/i)) {
    from = 'Employer (Payroll)';
    return { from, to };
  }

  // Pattern: "TF" or "TFR" patterns for internal transfers between own accounts
  if (desc.match(/\bTF\b|\bTFR\b/i) && !desc.match(/E-TFR/i)) {
    from = 'Own Account';
    to = 'Own Account';
    return { from, to };
  }

  // Generic: if description has a person name after common keywords
  const afterKeyword = desc.match(/(?:TO|FROM|SENT|RECEIVED)\s+([A-Z][A-Z\s]+)/i);
  if (afterKeyword) {
    const name = titleCase(afterKeyword[1].trim());
    if (desc.match(/TO|SENT/i)) to = name;
    else from = name;
    return { from, to };
  }

  return { from, to };
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract a clean merchant/person name from transaction description */
function extractMerchant(description) {
  if (!description) return '';
  let d = description.trim();

  // E-TRANSFER: extract person name
  const eTransferName = d.match(/E-TRANSFER\s+\d+\s+(.+)/i);
  if (eTransferName) return titleCase(eTransferName[1].trim());

  const eTransferDirect = d.match(/E-TRANSFER\s+(?!\*{2,})([A-Z][A-Z\s]+)/i);
  if (eTransferDirect && eTransferDirect[1].trim().length > 2) return titleCase(eTransferDirect[1].trim());

  if (d.match(/E-TRANSFER|E-TFR/i)) return '';

  // Payroll
  if (d.match(/payroll/i)) return 'Employer';

  // Internal transfers
  if (d.match(/\bTF\b|\bTFR\b/i) && !d.match(/E-TFR/i)) return 'Own Account';

  // Remove common prefixes
  d = d.replace(/^(VISA|MC|INTERAC|POS|PRE-AUTH|PURCHASE|PAYMENT|RECURRING|PAY)\s+/i, '');
  d = d.replace(/^(Internet Banking|Online Banking|Mobile Banking)\s+/i, '');

  // Remove trailing location: city, province/state patterns
  d = d.replace(/\s+([\w\s]+,\s*[A-Z]{2})\s*$/i, '');

  // Remove trailing reference numbers, phone numbers, long digit strings
  d = d.replace(/\s+\d{6,}.*$/g, '');
  d = d.replace(/\s+[A-Z0-9]{8,}$/g, '');
  d = d.replace(/\s+P[0-9A-F]{8,}/gi, '');

  // Remove hash/pound codes
  d = d.replace(/\s*#\d+/g, '');

  // Remove trailing numbers (store numbers like "2244")
  d = d.replace(/\s+\d{2,5}\s*$/g, '');

  // Clean up extra whitespace
  d = d.replace(/\s+/g, ' ').trim();

  // If still too long or has junk, take first meaningful words
  if (d.length > 30) {
    d = d.split(/\s+/).slice(0, 3).join(' ');
  }

  return d ? titleCase(d) : '';
}

/** Build card label from bank + cardType */
function cardLabel(bank, cardType) {
  if (!bank && !cardType) return '-';
  const b = bank || '';
  const c = cardType ? (cardType.charAt(0).toUpperCase() + cardType.slice(1)) : '';
  return `${b} ${c}`.trim();
}

export default function Transactions() {
  const { canWrite } = useAuth();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'reports'
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    owner: '', bank: '', cardType: '', category: '', subCategory: '', type: '', startDate: '', endDate: '',
  });
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [serverTotals, setServerTotals] = useState({ income: 0, expense: 0, net: 0 });
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineCategory, setInlineCategory] = useState('');
  const [inlineSubCategory, setInlineSubCategory] = useState('');
  const [form, setForm] = useState({
    owner: '', date: '', description: '', amount: '', type: 'expense',
    category: 'Other', subCategory: '', bank: '', cardType: 'debit',
  });

  // Reports state
  const [reportTab, setReportTab] = useState('overview');
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

  // Drill-down modal state
  const [drilldown, setDrilldown] = useState(null); // { title, transactions }
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  useEffect(() => {
    getUsers().then((res) => setUsers(res.data));
  }, []);

  const fetchTransactions = useCallback(() => {
    if (viewMode !== 'list') return;
    const cleanFilters = { page, limit: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) cleanFilters[k] = v; });
    getTransactions(cleanFilters).then((res) => {
      const data = res.data;
      setTransactions(data.transactions || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
      setServerTotals(data.totals || { income: 0, expense: 0, net: 0 });
    });
  }, [filters, page, viewMode]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Fetch report data when in reports mode
  useEffect(() => {
    if (viewMode !== 'reports') return;
    const p = {
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      owner: filters.owner || undefined,
      bank: filters.bank || undefined,
    };
    if (reportTab === 'overview') {
      getSavingsRate(p).then((r) => setSavings(r.data));
      getSummary(p).then((r) => setSummary(r.data));
    }
    if (reportTab === 'categories') getSummary(p).then((r) => setSummary(r.data));
    if (reportTab === 'person') getByPersonReport(p).then((r) => setPersonData(r.data));
    if (reportTab === 'card') getByCardReport(p).then((r) => setCardData(r.data));
    if (reportTab === 'merchants') getTopMerchants({ ...p, limit: 15 }).then((r) => setMerchants(r.data));
    if (reportTab === 'cashflow') getCashFlow(p).then((r) => setCashflow(r.data));
  }, [viewMode, reportTab, filters.startDate, filters.endDate, filters.owner, filters.bank]);

  useEffect(() => {
    if (viewMode !== 'reports' || reportTab !== 'yoy') return;
    getYearOverYear({ owner: filters.owner || undefined, year1, year2 }).then((r) => setYoyData(r.data));
  }, [viewMode, reportTab, filters.owner, year1, year2]);

  const handleFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'category') next.subCategory = '';
      return next;
    });
  };

  // Drill-down: fetch transactions matching a filter criteria
  const openDrilldown = async (title, extraFilters) => {
    setDrilldownLoading(true);
    setDrilldown({ title, transactions: [] });
    try {
      const p = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        owner: filters.owner || undefined,
        bank: filters.bank || undefined,
        limit: 200,
        ...extraFilters,
      };
      const res = await getTransactions(p);
      setDrilldown({ title, transactions: res.data.transactions || [] });
    } catch {
      setDrilldown({ title, transactions: [] });
    }
    setDrilldownLoading(false);
  };

  // Inline category edit
  const startInlineEdit = (t) => {
    setInlineEditId(t._id);
    setInlineCategory(t.category);
    setInlineSubCategory(t.subCategory || '');
  };

  const saveInlineEdit = async (id) => {
    await updateTransaction(id, { category: inlineCategory, subCategory: inlineSubCategory });
    setInlineEditId(null);
    fetchTransactions();
  };

  const cancelInlineEdit = () => { setInlineEditId(null); };

  const openAdd = () => {
    setEditingId(null);
    setForm({ owner: users[0]?._id || '', date: new Date().toISOString().slice(0, 10), description: '', amount: '', type: 'expense', category: 'Other', subCategory: '', bank: '', cardType: 'debit' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const data = { ...form, amount: parseFloat(form.amount) };
    if (editingId) {
      await updateTransaction(editingId, data);
    } else {
      await createTransaction(data);
    }
    setShowModal(false);
    fetchTransactions();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t._id !== id));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (sortField === 'date') { va = new Date(va); vb = new Date(vb); }
    if (sortField === 'amount') { va = Number(va); vb = Number(vb); }
    if (sortField === 'owner') { va = a.owner?.name || ''; vb = b.owner?.name || ''; }
    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const totalIncome = serverTotals.income;
  const totalExpense = serverTotals.expense;

  const availableSubCategories = filters.category
    ? (CATEGORY_MAP[filters.category] || [])
    : [...new Set(transactions.map(t => t.subCategory).filter(Boolean))].sort();

  // Check if any visible transactions are transfers (for showing From/To columns)
  const hasTransfers = sortedTransactions.some(t => TRANSFER_CATEGORIES.includes(t.category));

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h1>Transactions</h1>
        <div className="header-actions">
          <div className="view-toggle">
            <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>List View</button>
            <button className={`toggle-btn ${viewMode === 'reports' ? 'active' : ''}`} onClick={() => setViewMode('reports')}>Reports View</button>
          </div>
          {canWrite && viewMode === 'list' && <button className="btn-primary" onClick={openAdd}>+ Add Transaction</button>}
        </div>
      </div>

      {/* Shared filter bar */}
      <div className="filter-bar">
        <select value={filters.owner} onChange={(e) => handleFilter('owner', e.target.value)}>
          <option value="">All Users</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </select>
        <select value={filters.bank} onChange={(e) => handleFilter('bank', e.target.value)}>
          <option value="">All Banks</option>
          {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {viewMode === 'list' && (
          <>
            <select value={filters.cardType} onChange={(e) => handleFilter('cardType', e.target.value)}>
              <option value="">All Cards</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            <select value={filters.category} onChange={(e) => handleFilter('category', e.target.value)}>
              <option value="">All Categories</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filters.category || availableSubCategories.length > 0) && (
              <select value={filters.subCategory} onChange={(e) => handleFilter('subCategory', e.target.value)}>
                <option value="">All Sub-Categories</option>
                {availableSubCategories.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select value={filters.type} onChange={(e) => handleFilter('type', e.target.value)}>
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </>
        )}
        <input type="date" value={filters.startDate} onChange={(e) => handleFilter('startDate', e.target.value)} />
        <input type="date" value={filters.endDate} onChange={(e) => handleFilter('endDate', e.target.value)} />
      </div>

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <>
          <div className="totals-bar">
            <span className="total-income">Income: ${fmt(totalIncome)}</span>
            <span className="total-expense">Expenses: ${fmt(totalExpense)}</span>
            <span className="total-balance" style={{ color: totalIncome - totalExpense >= 0 ? '#27ae60' : '#e74c3c' }}>
              Net: ${fmt(totalIncome - totalExpense)}
            </span>
            <span className="total-count">{totalCount.toLocaleString()} transactions</span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('date')}>Date{sortIcon('date')}</th>
                  <th className="sortable" onClick={() => handleSort('description')}>Description{sortIcon('description')}</th>
                  <th className="sortable" onClick={() => handleSort('amount')}>Amount{sortIcon('amount')}</th>
                  <th className="sortable" onClick={() => handleSort('type')}>Type{sortIcon('type')}</th>
                  <th className="sortable" onClick={() => handleSort('category')}>Category{sortIcon('category')}</th>
                  <th className="sortable" onClick={() => handleSort('subCategory')}>Sub-Cat{sortIcon('subCategory')}</th>
                  {hasTransfers && <th>From</th>}
                  {hasTransfers && <th>To</th>}
                  <th className="sortable" onClick={() => handleSort('bank')}>Card{sortIcon('bank')}</th>
                  <th>Paid To</th>
                  <th className="sortable" onClick={() => handleSort('owner')}>Owner{sortIcon('owner')}</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((t) => {
                  const isTransfer = TRANSFER_CATEGORIES.includes(t.category);
                  const parties = isTransfer ? parseTransferParties(t.description, t.type) : { from: '', to: '' };
                  return (
                    <tr key={t._id} className={t.category === 'Internal Transfer' ? 'row-transfer' : ''}>
                      <td>{new Date(t.date).toLocaleDateString()}</td>
                      <td className="desc-cell" title={t.description}>{t.description}</td>
                      <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                        ${fmt(t.amount)}
                      </td>
                      <td><span className={`badge ${t.type}`}>{t.type}</span></td>

                      {canWrite && inlineEditId === t._id ? (
                        <>
                          <td>
                            <select className="inline-select" value={inlineCategory}
                              onChange={(e) => { setInlineCategory(e.target.value); setInlineSubCategory(''); }} autoFocus>
                              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td>
                            <select className="inline-select" value={inlineSubCategory}
                              onChange={(e) => setInlineSubCategory(e.target.value)}>
                              <option value="">--</option>
                              {(CATEGORY_MAP[inlineCategory] || []).map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <span className="inline-actions">
                              <button className="btn-xs btn-save" onClick={() => saveInlineEdit(t._id)}>&#10003;</button>
                              <button className="btn-xs btn-cancel" onClick={cancelInlineEdit}>&#10007;</button>
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={canWrite ? 'clickable-cell' : ''} onClick={canWrite ? () => startInlineEdit(t) : undefined}>
                            {t.category}
                          </td>
                          <td className={canWrite ? 'clickable-cell' : ''} onClick={canWrite ? () => startInlineEdit(t) : undefined}>
                            {t.subCategory || <span className="muted">--</span>}
                          </td>
                        </>
                      )}

                      {hasTransfers && <td className="transfer-party">{isTransfer ? (parties.from || <span className="muted">--</span>) : ''}</td>}
                      {hasTransfers && <td className="transfer-party">{isTransfer ? (parties.to || <span className="muted">--</span>) : ''}</td>}

                      <td title={cardLabel(t.bank, t.cardType)}>{t.bank ? <><BankLogo bank={t.bank} size="sm" /> <span className="card-type-label">{t.cardType ? t.cardType.charAt(0).toUpperCase() + t.cardType.slice(1) : ''}</span></> : '-'}</td>
                      <td className="merchant-cell" title={extractMerchant(t.description)}>{extractMerchant(t.description) || <span className="muted">--</span>}</td>
                      <td>{t.owner?.name || '-'}</td>
                      {canWrite && (
                        <td>
                          <button className="btn-sm btn-danger" onClick={() => handleDelete(t._id)} title="Delete">X</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {transactions.length === 0 && (
                  <tr><td colSpan={hasTransfers ? 12 : 10} className="no-data">No transactions found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(1)}>&laquo;</button>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&lsaquo;</button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>&rsaquo;</button>
              <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}>&raquo;</button>
            </div>
          )}
        </>
      )}

      {/* REPORTS VIEW */}
      {viewMode === 'reports' && (
        <div className="reports-section">
          <div className="tab-bar">
            {REPORT_TABS.map((t) => (
              <button key={t.key} className={`tab-btn ${reportTab === t.key ? 'active' : ''}`} onClick={() => setReportTab(t.key)}>{t.label}</button>
            ))}
          </div>
          <div className="tab-content">
            {reportTab === 'overview' && <OverviewTab savings={savings} summary={summary} onDrilldown={openDrilldown} />}
            {reportTab === 'categories' && (
              <CategoriesTab summary={summary} expanded={expandedCat} setExpanded={setExpandedCat}
                dateParams={{ startDate: filters.startDate, endDate: filters.endDate, owner: filters.owner || undefined }}
                onDrilldown={openDrilldown} />
            )}
            {reportTab === 'catdetail' && (
              <CategoryDetailTab dateParams={{ startDate: filters.startDate, endDate: filters.endDate, owner: filters.owner || undefined }} />
            )}
            {reportTab === 'person' && <PersonTab data={personData} onDrilldown={openDrilldown} />}
            {reportTab === 'card' && <CardTab data={cardData} onDrilldown={openDrilldown} />}
            {reportTab === 'merchants' && <MerchantsTab data={merchants} onDrilldown={openDrilldown} />}
            {reportTab === 'cashflow' && <CashFlowTab data={cashflow} />}
            {reportTab === 'yoy' && <YoYTab data={yoyData} year1={year1} year2={year2} setYear1={setYear1} setYear2={setYear2} />}
          </div>
        </div>
      )}

      {/* DRILL-DOWN MODAL */}
      {drilldown && (
        <div className="modal-overlay" onClick={() => setDrilldown(null)}>
          <div className="modal drilldown-modal" onClick={(e) => e.stopPropagation()}>
            <div className="drilldown-header">
              <h2>{drilldown.title}</h2>
              <button className="btn-close" onClick={() => setDrilldown(null)}>Close</button>
            </div>
            {drilldownLoading ? (
              <p className="no-data">Loading transactions...</p>
            ) : drilldown.transactions.length === 0 ? (
              <p className="no-data">No transactions found</p>
            ) : (
              <>
                <p className="drilldown-count">{drilldown.transactions.length} transaction{drilldown.transactions.length !== 1 ? 's' : ''} - Total: ${fmt(drilldown.transactions.reduce((s, t) => s + t.amount, 0))}</p>
                <div className="drilldown-table-wrap">
                  <table className="drilldown-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Description</th><th>Amount</th><th>Card</th><th>Paid To</th><th>Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldown.transactions.map((t) => (
                        <tr key={t._id}>
                          <td>{new Date(t.date).toLocaleDateString()}</td>
                          <td className="desc-cell" title={t.description}>{t.description}</td>
                          <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>${fmt(t.amount)}</td>
                          <td>{cardLabel(t.bank, t.cardType)}</td>
                          <td className="merchant-cell">{extractMerchant(t.description) || '--'}</td>
                          <td>{t.owner?.name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit' : 'Add'} Transaction</h2>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <label>
                  Owner
                  <select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} required>
                    <option value="">Select</option>
                    {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                  </select>
                </label>
                <label>
                  Date
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </label>
                <label>
                  Description
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </label>
                <label>
                  Amount
                  <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </label>
                <label>
                  Type
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label>
                  Category
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subCategory: '' })}>
                    {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  Sub-Category
                  <select value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })}>
                    <option value="">--</option>
                    {(CATEGORY_MAP[form.category] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>
                  Bank
                  <select value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}>
                    <option value="">None</option>
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <label>
                  Card Type
                  <select value={form.cardType} onChange={(e) => setForm({ ...form, cardType: e.target.value })}>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== REPORT SUB-COMPONENTS ===== */

function OverviewTab({ savings, summary, onDrilldown }) {
  if (!savings.length) return <p className="no-data">No data for this period</p>;
  const chartData = savings.map((s) => ({
    name: `${MONTHS_SHORT[s.month - 1]} ${String(s.year).slice(2)}`,
    Income: s.income, Expense: s.expense, Savings: s.savings,
    'Rate%': Math.round(s.savingsRate),
    _month: s.month, _year: s.year,
  }));
  const totalIncome = savings.reduce((s, m) => s + m.income, 0);
  const totalExpense = savings.reduce((s, m) => s + m.expense, 0);
  const totalSavings = totalIncome - totalExpense;
  const avgRate = totalIncome > 0 ? (totalSavings / totalIncome * 100) : 0;

  const handleBarClick = (data) => {
    if (!data || !data.activePayload?.[0]) return;
    const point = data.activePayload[0].payload;
    const monthStart = `${point._year}-${String(point._month).padStart(2, '0')}-01`;
    const lastDay = new Date(point._year, point._month, 0).getDate();
    const monthEnd = `${point._year}-${String(point._month).padStart(2, '0')}-${lastDay}`;
    onDrilldown(`Transactions for ${point.name}`, { startDate: monthStart, endDate: monthEnd });
  };

  return (
    <div>
      <div className="overview-stats">
        <div className="mini-stat green">Total Income<br /><strong>${totalIncome.toFixed(0)}</strong></div>
        <div className="mini-stat red">Total Expenses<br /><strong>${totalExpense.toFixed(0)}</strong></div>
        <div className="mini-stat blue">Net Savings<br /><strong>${totalSavings.toFixed(0)}</strong></div>
        <div className="mini-stat purple">Avg Savings Rate<br /><strong>{avgRate.toFixed(1)}%</strong></div>
      </div>
      <div className="chart-box">
        <h3>Income vs Expenses (click a bar to drill down)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
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
          <h3>Category Breakdown (click a row to see transactions)</h3>
          <table className="data-table"><thead><tr><th>Category</th><th>Amount</th><th>Count</th><th>%</th></tr></thead>
            <tbody>{summary.byCategory.map((c) => (
              <tr key={c._id} className="clickable-row" onClick={() => onDrilldown(`${c._id} transactions`, { category: c._id })}>
                <td><span className="cat-dot-sm" style={{ background: SUB_COLORS[c._id] || '#999' }} />{c._id}</td>
                <td>${c.total.toFixed(2)}</td><td>{c.count}</td><td>{summary.totalExpense > 0 ? (c.total / summary.totalExpense * 100).toFixed(1) : 0}%</td></tr>
            ))}</tbody></table>
        </div>
      )}
    </div>
  );
}

function CategoriesTab({ summary, expanded, setExpanded, dateParams, onDrilldown }) {
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
        <h3>{expanded ? <><button className="back-btn" onClick={() => { setExpanded(null); setDetailCat(null); }}>&#8592; All</button>{expanded}</> : 'Category Groups (click to drill down)'}</h3>
        <div className="cat-detail-bars">
          {expanded
            ? parentGroups.find((g) => g.name === expanded)?.subs.map((sub) => {
                const pct = totalExp > 0 ? (sub.total / totalExp * 100) : 0;
                const color = CATEGORY_HIERARCHY[expanded]?.color || '#999';
                return (<div key={sub.name}>
                  <div className={`cat-bar-row clickable ${detailCat === sub.name ? 'active' : ''}`} onClick={() => { showDetails(sub.name); onDrilldown(`${sub.name} transactions`, { category: sub.name }); }}>
                    <div className="cat-bar-label"><span className="cat-dot" style={{ background: color }} /><span className="cat-name">{sub.name}</span></div>
                    <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${Math.max(pct * 2, 1)}%`, background: color }} /></div>
                    <div className="cat-bar-value"><span className="cat-amount">${sub.total.toFixed(0)}</span><span className="cat-count">{sub.count} txn</span></div>
                  </div>
                </div>);
              })
            : parentGroups.filter((g) => g.name !== 'Income').map((g) => {
                const pct = totalExp > 0 ? (g.total / totalExp * 100) : 0;
                return (<div key={g.name} className="cat-bar-row clickable" onClick={() => {
                  if (g.subs.length > 1) { setExpanded(g.name); }
                  else { onDrilldown(`${g.subs[0]?.name} transactions`, { category: g.subs[0]?.name }); }
                }}>
                  <div className="cat-bar-label"><span className="cat-dot" style={{ background: g.color }} /><span className="cat-name">{g.icon} {g.name}</span>{g.subs.length > 1 && <span className="drill-arrow">&rsaquo;</span>}</div>
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
            <tr key={sub.name} className="clickable-row" onClick={() => onDrilldown(`${sub.name} transactions`, { category: sub.name })}>
              <td><span className="cat-dot-sm" style={{ background: g.color }} />{g.name}</td><td>{sub.name}</td>
              <td>${sub.total.toFixed(2)}</td><td>{sub.count}</td><td>{totalExp > 0 ? (sub.total / totalExp * 100).toFixed(1) : 0}%</td></tr>
          )))}</tbody></table>
      </div>
    </div>
  );
}

function PersonTab({ data, onDrilldown }) {
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
      {pl.map((p) => (<div key={p.name} className="chart-box"><h3>{p.name} -- ${p.total.toFixed(2)}</h3>
        <table className="data-table compact"><thead><tr><th>Category</th><th>Amount</th><th>Count</th><th>%</th></tr></thead>
          <tbody>{p.cats.sort((a, b) => b.total - a.total).slice(0, 10).map((c) => (
            <tr key={c.cat} className="clickable-row" onClick={() => onDrilldown(`${p.name} - ${c.cat}`, { category: c.cat })}>
              <td><span className="cat-dot-sm" style={{ background: SUB_COLORS[c.cat] || '#999' }} />{c.cat}</td>
              <td>${c.total.toFixed(2)}</td><td>{c.count}</td><td>{(c.total / p.total * 100).toFixed(0)}%</td></tr>
          ))}</tbody></table></div>))}
    </div>
  );
}

function CardTab({ data, onDrilldown }) {
  if (!data.length) return <p className="no-data">No data</p>;
  const cd = data.map((d) => ({ name: `${d._id.bank || 'Store'} (${d._id.cardType || '?'})`, Total: d.total, bank: d._id.bank, cardType: d._id.cardType }));

  const handleClick = (data) => {
    if (!data || !data.activePayload?.[0]) return;
    const point = data.activePayload[0].payload;
    onDrilldown(`${point.name} transactions`, { bank: point.bank, cardType: point.cardType });
  };

  return (<div className="chart-box"><h3>Spending by Card (click to drill down)</h3>
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart data={cd} layout="vertical" onClick={handleClick} style={{ cursor: 'pointer' }}>
        <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" fontSize={12} width={160} />
        <Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Bar dataKey="Total" fill="#3498db" /></BarChart>
    </ResponsiveContainer></div>);
}

function MerchantsTab({ data, onDrilldown }) {
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

/* ===== CATEGORY DETAIL TAB ===== */

const TRACKED_CATEGORIES = [
  { emoji: '\u26A1', label: 'Electricity', filter: { category: 'Utilities', subCategory: 'Hydro/Electric' }, color: '#f1c40f' },
  { emoji: '\u26FD', label: 'Gas/Fuel', filter: { category: 'Gas' }, color: '#e67e22' },
  { emoji: '\uD83C\uDF10', label: 'Internet', filter: { category: 'Utilities', subCategory: 'Internet' }, color: '#3498db' },
  { emoji: '\uD83D\uDCF1', label: 'Phone', filter: { category: 'Utilities', subCategory: 'Phone/Mobile' }, color: '#9b59b6' },
  { emoji: '\uD83C\uDFE0', label: 'Rent', filter: { category: 'Housing/Rent' }, color: '#1abc9c' },
  { emoji: '\uD83D\uDEAC', label: 'Smoking/Vape', filter: { category: 'Shopping', subCategory: 'Vape' }, color: '#95a5a6' },
  { emoji: '\uD83D\uDCFA', label: 'Subscriptions', filter: { category: 'Subscriptions' }, color: '#e74c3c' },
  { emoji: '\uD83C\uDF77', label: 'Alcohol', filter: { category: 'Entertainment', subCategory: 'Wine/Liquor' }, color: '#8e44ad' },
  { emoji: '\uD83D\uDED2', label: 'Costco', filter: { category: 'Groceries', subCategory: 'Costco' }, color: '#2c3e50' },
];

function CategoryDetailTab({ dateParams }) {
  const [cardData, setCardData] = useState({});
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    // Fetch summary data for all tracked categories
    TRACKED_CATEGORIES.forEach((cat) => {
      setLoading((prev) => ({ ...prev, [cat.label]: true }));
      getCategoryDetailReport({ ...dateParams, ...cat.filter })
        .then((res) => {
          setCardData((prev) => ({ ...prev, [cat.label]: res.data }));
          setLoading((prev) => ({ ...prev, [cat.label]: false }));
        })
        .catch(() => {
          setCardData((prev) => ({ ...prev, [cat.label]: { transactions: [], monthlyTotals: [], total: 0, count: 0, average: 0 } }));
          setLoading((prev) => ({ ...prev, [cat.label]: false }));
        });
    });
  }, [dateParams.startDate, dateParams.endDate, dateParams.owner]);

  const toggleExpand = (label) => {
    setExpanded((prev) => (prev === label ? null : label));
  };

  return (
    <div>
      <div className="catdetail-grid">
        {TRACKED_CATEGORIES.map((cat) => {
          const data = cardData[cat.label];
          const isLoading = loading[cat.label];
          const isExpanded = expanded === cat.label;

          return (
            <div key={cat.label} className={`catdetail-card ${isExpanded ? 'catdetail-card-expanded' : ''}`}>
              <div className="catdetail-card-header" onClick={() => toggleExpand(cat.label)} style={{ borderLeft: `4px solid ${cat.color}` }}>
                <div className="catdetail-card-title">
                  <span className="catdetail-emoji">{cat.emoji}</span>
                  <span className="catdetail-name">{cat.label}</span>
                </div>
                {isLoading ? (
                  <div className="catdetail-loading">Loading...</div>
                ) : data ? (
                  <div className="catdetail-card-stats">
                    <div className="catdetail-total">${data.total.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="catdetail-meta">
                      <span>{data.count.toLocaleString()} txn</span>
                      <span>Avg ${data.average.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
                    </div>
                  </div>
                ) : null}
                {/* Mini sparkline */}
                {data && data.monthlyTotals.length > 1 && !isExpanded && (
                  <div className="catdetail-sparkline">
                    <ResponsiveContainer width={120} height={32}>
                      <BarChart data={data.monthlyTotals}>
                        <Bar dataKey="total" fill={cat.color} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <span className="catdetail-chevron">{isExpanded ? '\u25B2' : '\u25BC'}</span>
              </div>

              {isExpanded && data && (
                <div className="catdetail-card-body">
                  {/* Monthly bar chart */}
                  {data.monthlyTotals.length > 0 && (
                    <div className="catdetail-chart">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={data.monthlyTotals}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip formatter={(v) => `$${Number(v).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} />
                          <Bar dataKey="total" name="Amount" fill={cat.color} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Transaction list */}
                  <div className="catdetail-txn-wrap">
                    <table className="data-table compact">
                      <thead>
                        <tr>
                          <th>Date</th><th>Description</th><th>Amount</th><th>Card</th><th>Paid To</th><th>Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.transactions.map((t) => (
                          <tr key={t._id}>
                            <td>{new Date(t.date).toLocaleDateString()}</td>
                            <td className="desc-cell" title={t.description}>{t.description}</td>
                            <td className="amount-expense">${t.amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>{cardLabel(t.bank, t.cardType)}</td>
                            <td className="merchant-cell">{extractMerchant(t.description) || '--'}</td>
                            <td>{t.owner?.name || '-'}</td>
                          </tr>
                        ))}
                        {data.transactions.length === 0 && (
                          <tr><td colSpan={6} className="no-data">No transactions found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
