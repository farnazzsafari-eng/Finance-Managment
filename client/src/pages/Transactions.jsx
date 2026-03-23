import { useState, useEffect, useCallback } from 'react';
import { getTransactions, getUsers, createTransaction, deleteTransaction, updateTransaction } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BankLogo from '../components/BankLogo';
import './Transactions.css';

// Category → SubCategory mapping
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

function fmt(n) {
  return n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Transactions() {
  const { canWrite } = useAuth();
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
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineCategory, setInlineCategory] = useState('');
  const [inlineSubCategory, setInlineSubCategory] = useState('');
  const [form, setForm] = useState({
    owner: '', date: '', description: '', amount: '', type: 'expense',
    category: 'Other', subCategory: '', bank: '', cardType: 'debit',
  });

  useEffect(() => {
    getUsers().then((res) => setUsers(res.data));
  }, []);

  const fetchTransactions = useCallback(() => {
    const cleanFilters = { page, limit: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) cleanFilters[k] = v; });
    getTransactions(cleanFilters).then((res) => {
      const data = res.data;
      setTransactions(data.transactions || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
      setServerTotals(data.totals || { income: 0, expense: 0, net: 0 });
    });
  }, [filters, page]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleFilter = (key, value) => {
    setPage(1); // Reset to first page on filter change
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'category') next.subCategory = '';
      return next;
    });
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

  const cancelInlineEdit = () => {
    setInlineEditId(null);
  };

  // Modal for adding new transaction
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

  // Totals from server (across ALL matching transactions, not just current page)
  const totalIncome = serverTotals.income;
  const totalExpense = serverTotals.expense;

  // Unique sub-categories
  const availableSubCategories = filters.category
    ? (CATEGORY_MAP[filters.category] || [])
    : [...new Set(transactions.map(t => t.subCategory).filter(Boolean))].sort();

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h1>Transactions</h1>
        {canWrite && <button className="btn-primary" onClick={openAdd}>+ Add Transaction</button>}
      </div>

      <div className="filter-bar">
        <select value={filters.owner} onChange={(e) => handleFilter('owner', e.target.value)}>
          <option value="">All Users</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </select>
        <select value={filters.bank} onChange={(e) => handleFilter('bank', e.target.value)}>
          <option value="">All Banks</option>
          {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
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
        <input type="date" value={filters.startDate} onChange={(e) => handleFilter('startDate', e.target.value)} />
        <input type="date" value={filters.endDate} onChange={(e) => handleFilter('endDate', e.target.value)} />
      </div>

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
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Category</th>
              <th>Sub-Category</th>
              <th>Bank</th>
              <th>Card</th>
              <th>Owner</th>
              {canWrite && <th></th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t._id} className={t.category === 'Internal Transfer' ? 'row-transfer' : ''}>
                <td>{new Date(t.date).toLocaleDateString()}</td>
                <td className="desc-cell" title={t.description}>{t.description}</td>
                <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                  ${fmt(t.amount)}
                </td>
                <td><span className={`badge ${t.type}`}>{t.type}</span></td>

                {/* Inline category editing */}
                {canWrite && inlineEditId === t._id ? (
                  <>
                    <td>
                      <select
                        className="inline-select"
                        value={inlineCategory}
                        onChange={(e) => { setInlineCategory(e.target.value); setInlineSubCategory(''); }}
                        autoFocus
                      >
                        {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className="inline-select"
                        value={inlineSubCategory}
                        onChange={(e) => setInlineSubCategory(e.target.value)}
                      >
                        <option value="">—</option>
                        {(CATEGORY_MAP[inlineCategory] || []).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <span className="inline-actions">
                        <button className="btn-xs btn-save" onClick={() => saveInlineEdit(t._id)}>✓</button>
                        <button className="btn-xs btn-cancel" onClick={cancelInlineEdit}>✗</button>
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

                <td>{t.bank ? <BankLogo bank={t.bank} size="sm" /> : '-'}</td>
                <td>{t.cardType || '-'}</td>
                <td>{t.owner?.name || '-'}</td>
                {canWrite && (
                  <td>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(t._id)} title="Delete">X</button>
                  </td>
                )}
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan="10" className="no-data">No transactions found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(1)}>«</button>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      )}

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
                    <option value="">—</option>
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
