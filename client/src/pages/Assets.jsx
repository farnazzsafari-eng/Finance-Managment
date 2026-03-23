import { useState, useEffect } from 'react';
import { getBalances, saveBalances } from '../services/api';
import './Assets.css';

const USD_RATE = 1.40;

function fmt(n) {
  return n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n) {
  return n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Assets() {
  const [balances, setBalances] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    label: '', owner: 'Hamidreza', amount: '', currency: 'CAD', type: 'asset', note: '',
  });

  useEffect(() => {
    getBalances().then((r) => setBalances(r.data));
  }, []);

  if (!balances?.accounts) return <div className="loading">Loading...</div>;

  const accounts = balances.accounts;
  const bankAccounts = accounts.filter((a) => a.type === 'bank');
  const assets = accounts.filter((a) => a.type === 'asset');
  const liabilities = accounts.filter((a) => a.type === 'liability');

  const toCAD = (a) => a.currency === 'USD' ? a.amount * USD_RATE : a.amount;
  const bankTotal = bankAccounts.reduce((s, a) => s + toCAD(a), 0);
  const assetTotal = assets.reduce((s, a) => s + toCAD(a), 0);
  const liabTotal = liabilities.reduce((s, a) => s + toCAD(a), 0);
  const netWorth = bankTotal + assetTotal - liabTotal;

  // Group bank accounts by owner
  const byOwner = {};
  bankAccounts.forEach((a) => {
    if (!byOwner[a.owner]) byOwner[a.owner] = [];
    byOwner[a.owner].push(a);
  });

  const startEdit = (idx) => {
    setEditing(idx);
    setEditAmount(accounts[idx].amount.toString());
  };

  const saveEdit = async (idx) => {
    const updated = [...accounts];
    updated[idx] = { ...updated[idx], amount: parseFloat(editAmount) || 0 };
    await saveBalances(updated);
    setBalances({ accounts: updated });
    setEditing(null);
  };

  const handleDelete = async (idx) => {
    if (!confirm('Remove this item?')) return;
    const updated = accounts.filter((_, i) => i !== idx);
    await saveBalances(updated);
    setBalances({ accounts: updated });
  };

  const handleAdd = async () => {
    const item = { ...newItem, amount: parseFloat(newItem.amount) || 0 };
    const updated = [...accounts, item];
    await saveBalances(updated);
    setBalances({ accounts: updated });
    setShowAdd(false);
    setNewItem({ label: '', owner: 'Hamidreza', amount: '', currency: 'CAD', type: 'asset', note: '' });
  };

  const renderRow = (a, globalIdx) => {
    const cadVal = toCAD(a);
    const isEditing = editing === globalIdx;

    return (
      <tr key={globalIdx} className={a.type === 'liability' ? 'row-liability' : ''}>
        <td className="label-cell">
          <span className="item-label">{a.label}</span>
          {a.note && <span className="item-note">{a.note}</span>}
        </td>
        <td className="owner-cell">{a.owner}</td>
        <td className="currency-cell">{a.currency}</td>
        <td className="amount-cell">
          {isEditing ? (
            <div className="edit-inline">
              <input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                autoFocus
                className="edit-input"
              />
              <button className="btn-xs btn-save" onClick={() => saveEdit(globalIdx)}>✓</button>
              <button className="btn-xs btn-cancel" onClick={() => setEditing(null)}>✗</button>
            </div>
          ) : (
            <span
              className={`amount-value ${a.type === 'liability' ? 'negative' : 'positive'} clickable`}
              onClick={() => startEdit(globalIdx)}
            >
              {a.currency === 'USD' ? 'US' : ''}${fmt(a.amount)}
            </span>
          )}
        </td>
        <td className="cad-cell">
          <span className="cad-value">${fmt(cadVal)}</span>
        </td>
        <td>
          <button className="btn-sm btn-danger" onClick={() => handleDelete(globalIdx)} title="Remove">🗑</button>
        </td>
      </tr>
    );
  };

  return (
    <div className="assets-page">
      <div className="page-header">
        <h1>Assets & Balance</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Item</button>
      </div>

      {/* Net Worth Summary */}
      <div className="net-worth-banner">
        <div className="nw-main">
          <span className="nw-label">Net Worth</span>
          <span className={`nw-amount ${netWorth >= 0 ? 'positive' : 'negative'}`}>
            ${fmtInt(netWorth)} <span className="nw-cad">CAD</span>
          </span>
        </div>
        <div className="nw-breakdown">
          <div className="nw-item">
            <span className="nw-item-label">Bank Balances</span>
            <span className="positive">${fmtInt(bankTotal)}</span>
          </div>
          <div className="nw-item">
            <span className="nw-item-label">Other Assets</span>
            <span className="positive">${fmtInt(assetTotal)}</span>
          </div>
          {liabTotal > 0 && (
            <div className="nw-item">
              <span className="nw-item-label">Liabilities</span>
              <span className="negative">-${fmtInt(liabTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bank Accounts by Owner */}
      <div className="section">
        <h2>🏦 Bank Accounts</h2>
        {Object.entries(byOwner).map(([owner, ownerAccounts]) => {
          const ownerTotal = ownerAccounts.reduce((s, a) => s + toCAD(a), 0);
          return (
            <div key={owner} className="owner-section">
              <h3>{owner} <span className="owner-total">${fmtInt(ownerTotal)}</span></h3>
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Owner</th>
                    <th>Currency</th>
                    <th>Amount</th>
                    <th>CAD Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ownerAccounts.map((a) => {
                    const globalIdx = accounts.indexOf(a);
                    return renderRow(a, globalIdx);
                  })}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan="4"><strong>Total</strong></td>
                    <td className="amount-cell"><strong className="positive">${fmt(ownerTotal)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}
      </div>

      {/* Other Assets */}
      {assets.length > 0 && (
        <div className="section">
          <h2>💰 Assets & Receivables</h2>
          <table className="assets-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Owner</th>
                <th>Currency</th>
                <th>Amount</th>
                <th>CAD Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const globalIdx = accounts.indexOf(a);
                return renderRow(a, globalIdx);
              })}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan="4"><strong>Total</strong></td>
                <td className="amount-cell"><strong className="positive">${fmt(assetTotal)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Liabilities */}
      {liabilities.length > 0 && (
        <div className="section">
          <h2>📉 Liabilities</h2>
          <table className="assets-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Owner</th>
                <th>Currency</th>
                <th>Amount</th>
                <th>CAD Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liabilities.map((a) => {
                const globalIdx = accounts.indexOf(a);
                return renderRow(a, globalIdx);
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Asset / Liability</h2>
            <div className="form-grid">
              <label>
                Label
                <input value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} placeholder="e.g. Cash, Brother's debt" />
              </label>
              <label>
                Owner
                <select value={newItem.owner} onChange={(e) => setNewItem({ ...newItem, owner: e.target.value })}>
                  <option value="Hamidreza">Hamidreza</option>
                  <option value="Farnaz">Farnaz</option>
                </select>
              </label>
              <label>
                Amount
                <input type="number" step="0.01" value={newItem.amount} onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })} />
              </label>
              <label>
                Currency
                <select value={newItem.currency} onChange={(e) => setNewItem({ ...newItem, currency: e.target.value })}>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label>
                Type
                <select value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}>
                  <option value="bank">Bank Account</option>
                  <option value="asset">Asset / Receivable</option>
                  <option value="liability">Liability / Debt</option>
                </select>
              </label>
              <label>
                Note
                <input value={newItem.note} onChange={(e) => setNewItem({ ...newItem, note: e.target.value })} placeholder="Optional note" />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAdd}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
