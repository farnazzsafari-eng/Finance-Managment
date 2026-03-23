import { useState, useEffect } from 'react';
import { getUsers, importCSV, getImportStatus, getSubscriptionStatus } from '../services/api';
import BankLogo from '../components/BankLogo';
import './Import.css';

const BANKS = ['CIBC', 'TD', 'RBC', 'Scotia', 'Wealthsimple'];

function fmt(n) {
  return n.toLocaleString('en-CA');
}

export default function Import() {
  const [users, setUsers] = useState([]);
  const [owner, setOwner] = useState('');
  const [bank, setBank] = useState('');
  const [cardType, setCardType] = useState('debit');
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    getUsers().then((r) => setUsers(r.data));
    getSubscriptionStatus()
      .then((r) => setSubscription(r.data))
      .catch(() => {});
  }, []);

  // When owner+bank+cardType changes, check existing data
  useEffect(() => {
    if (owner && bank) {
      getImportStatus({ ownerId: owner, bank, cardType })
        .then((r) => setStatus(r.data))
        .catch(() => setStatus(null));
    } else {
      setStatus(null);
    }
  }, [owner, bank, cardType]);

  const handleFiles = (e) => {
    setFiles(Array.from(e.target.files));
    setResults([]);
  };

  const handleImport = async () => {
    if (!owner || !bank || files.length === 0) return;

    setImporting(true);
    const importResults = [];

    for (const file of files) {
      try {
        const content = await file.text();
        const res = await importCSV({
          csvContent: content,
          ownerId: owner,
          bank,
          cardType,
        });
        importResults.push({
          file: file.name,
          success: true,
          ...res.data,
        });
      } catch (err) {
        importResults.push({
          file: file.name,
          success: false,
          error: err.response?.data?.error || err.message,
        });
      }
    }

    setResults(importResults);
    setImporting(false);

    // Refresh status
    if (owner && bank) {
      getImportStatus({ ownerId: owner, bank, cardType })
        .then((r) => setStatus(r.data));
    }
  };

  const ownerName = users.find((u) => u._id === owner)?.name || '';

  // Gate behind subscription (allow if active or if status not loaded yet for backwards compat)
  if (subscription && subscription.status !== 'active' && subscription.status !== 'free') {
    return (
      <div className="import-page">
        <h1>Import CSV</h1>
        <div className="subscription-gate">
          <h2>Pro Feature</h2>
          <p>CSV Import is available on the Pro plan ($49.90/month).</p>
          <a href="/pricing" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            View Pricing
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="import-page">
      <h1>Import CSV</h1>
      <p className="subtitle">Upload bank statement CSV files. The system automatically detects existing data and only imports new transactions.</p>

      <div className="import-form">
        <div className="form-row">
          <label>
            <span className="label-text">Person</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Select person</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </label>

          <label>
            <span className="label-text">Bank</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select value={bank} onChange={(e) => setBank(e.target.value)} style={{ flex: 1 }}>
                <option value="">Select bank</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              {bank && <BankLogo bank={bank} size="md" />}
            </div>
          </label>

          <label>
            <span className="label-text">Card Type</span>
            <select value={cardType} onChange={(e) => setCardType(e.target.value)}>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </label>
        </div>

        {/* Status indicator */}
        {status && (
          <div className="status-box">
            {status.count > 0 ? (
              <>
                <span className="status-icon">📊</span>
                <div>
                  <strong>{ownerName} — {bank} {cardType}</strong>
                  <p>Currently have <strong>{fmt(status.count)} transactions</strong> from <strong>{status.dateRange?.from}</strong> to <strong>{status.dateRange?.to}</strong></p>
                  <p className="hint">Upload a new CSV and only transactions outside this range (or new ones within it) will be added.</p>
                </div>
              </>
            ) : (
              <>
                <span className="status-icon">📭</span>
                <div>
                  <strong>{ownerName} — {bank} {cardType}</strong>
                  <p>No existing data. All transactions from the CSV will be imported.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* File upload */}
        <div className="upload-area">
          <label className="file-drop">
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFiles}
              className="file-input"
            />
            {files.length > 0 ? (
              <div className="file-list">
                {files.map((f, i) => (
                  <span key={i} className="file-tag">📄 {f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                ))}
              </div>
            ) : (
              <div className="drop-text">
                <span className="drop-icon">📁</span>
                <span>Click to select CSV files or drag & drop</span>
                <span className="drop-hint">Supports multiple files at once</span>
              </div>
            )}
          </label>
        </div>

        <button
          className="btn-import"
          disabled={!owner || !bank || files.length === 0 || importing}
          onClick={handleImport}
        >
          {importing ? '⏳ Importing...' : `📥 Import ${files.length} file${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="results-section">
          <h2>Import Results</h2>
          {results.map((r, i) => (
            <div key={i} className={`result-card ${r.success ? 'success' : 'error'}`}>
              <div className="result-header">
                <span className="result-icon">{r.success ? '✅' : '❌'}</span>
                <strong>{r.file}</strong>
              </div>
              {r.success ? (
                <div className="result-body">
                  <div className="result-stats">
                    <div className="stat">
                      <span className="stat-num">{r.imported}</span>
                      <span className="stat-label">Imported</span>
                    </div>
                    <div className="stat">
                      <span className="stat-num">{r.skipped}</span>
                      <span className="stat-label">Skipped (duplicate)</span>
                    </div>
                    <div className="stat">
                      <span className="stat-num">{r.totalInCSV}</span>
                      <span className="stat-label">Total in CSV</span>
                    </div>
                  </div>
                  {r.csvDateRange && (
                    <p className="date-info">
                      CSV: {r.csvDateRange.from} → {r.csvDateRange.to}
                      {r.existingDateRange && (
                        <> | DB: {r.existingDateRange.from} → {r.existingDateRange.to}</>
                      )}
                    </p>
                  )}
                  <p className="result-msg">{r.message}</p>
                </div>
              ) : (
                <p className="error-msg">{r.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
