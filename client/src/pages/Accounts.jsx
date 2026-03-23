import { useState, useEffect } from 'react';
import { getAccounts, getUsers, createAccount, deleteAccount, updateAccount } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BankLogo from '../components/BankLogo';
import './Accounts.css';

const BANKS = ['Wealthsimple', 'Scotia', 'TD', 'CIBC', 'RBC'];

export default function Accounts() {
  const { canWrite } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterOwner, setFilterOwner] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ owner: '', bank: 'TD', type: 'debit', lastFourDigits: '', nickname: '' });

  const load = () => {
    getAccounts(filterOwner || undefined).then((res) => setAccounts(res.data));
  };

  useEffect(() => {
    getUsers().then((res) => setUsers(res.data));
  }, []);

  useEffect(load, [filterOwner]);

  const handleSave = async (e) => {
    e.preventDefault();
    await createAccount(form);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this account?')) return;
    await deleteAccount(id);
    load();
  };

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h1>Accounts</h1>
        <div className="header-actions">
          <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          {canWrite && (
            <button className="btn-primary" onClick={() => { setForm({ owner: users[0]?._id || '', bank: 'TD', type: 'debit', lastFourDigits: '', nickname: '' }); setShowModal(true); }}>
              + Add Account
            </button>
          )}
        </div>
      </div>

      <div className="accounts-grid">
        {accounts.map((acc) => (
          <div key={acc._id} className={`account-card ${acc.type}`}>
            <div className="account-header">
              <h3><BankLogo bank={acc.bank} size="sm" style={{ marginRight: '6px' }} />{acc.bank}</h3>
              <span className={`card-badge ${acc.type}`}>{acc.type}</span>
            </div>
            <p className="account-owner">{acc.owner?.name}</p>
            {acc.lastFourDigits && <p className="account-digits">**** {acc.lastFourDigits}</p>}
            {acc.nickname && <p className="account-nick">{acc.nickname}</p>}
            {canWrite && <button className="btn-sm btn-danger" onClick={() => handleDelete(acc._id)}>Remove</button>}
          </div>
        ))}
        {accounts.length === 0 && <p className="no-data">No accounts found</p>}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Account</h2>
            <form onSubmit={handleSave}>
              <label>
                Owner
                <select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} required>
                  <option value="">Select</option>
                  {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </label>
              <label>
                Bank
                <select value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}>
                  {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label>
                Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </label>
              <label>
                Last 4 Digits
                <input value={form.lastFourDigits} onChange={(e) => setForm({ ...form, lastFourDigits: e.target.value })} maxLength="4" />
              </label>
              <label>
                Nickname
                <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
              </label>
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
