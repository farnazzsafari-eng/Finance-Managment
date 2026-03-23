import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getHousehold, createInvite, createAdvisorInvite,
  updateHouseholdSettings, updateProfile, getSubscriptionStatus,
  getAccounts, getUsers, createAccount, deleteAccount,
} from '../services/api';
import BankLogo from '../components/BankLogo';
import './Settings.css';

const BANKS = ['Wealthsimple', 'Scotia', 'TD', 'CIBC', 'RBC'];

export default function Settings() {
  const { user, isAdmin, isAdvisor, canWrite, refreshUser } = useAuth();
  const [household, setHousehold] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteExpires, setInviteExpires] = useState('');
  const [advisorInviteUrl, setAdvisorInviteUrl] = useState('');
  const [advisorInviteExpires, setAdvisorInviteExpires] = useState('');
  const [copied, setCopied] = useState('');
  const [subscription, setSubscription] = useState(null);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Settings toggles
  const [showInternalTransfers, setShowInternalTransfers] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDayOfMonth, setReminderDayOfMonth] = useState(1);
  const [reminderEmail, setReminderEmail] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Accounts management
  const [accounts, setAccounts] = useState([]);
  const [acctUsers, setAcctUsers] = useState([]);
  const [acctFilterOwner, setAcctFilterOwner] = useState('');
  const [showAcctModal, setShowAcctModal] = useState(false);
  const [acctForm, setAcctForm] = useState({ owner: '', bank: 'TD', type: 'debit', lastFourDigits: '', nickname: '' });

  const loadAccounts = () => {
    getAccounts(acctFilterOwner || undefined).then((res) => setAccounts(res.data));
  };

  useEffect(() => {
    getHousehold().then((r) => {
      setHousehold(r.data);
      if (r.data) {
        setShowInternalTransfers(r.data.showInternalTransfers || false);
        setReminderEnabled(r.data.reminderEnabled || false);
        setReminderDayOfMonth(r.data.reminderDayOfMonth || 1);
        setReminderEmail(r.data.reminderEmail || '');
      }
    });
    getSubscriptionStatus()
      .then((r) => setSubscription(r.data))
      .catch(() => {});
    getUsers().then((res) => setAcctUsers(res.data));
  }, []);

  useEffect(() => { loadAccounts(); }, [acctFilterOwner]);

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    await createAccount(acctForm);
    setShowAcctModal(false);
    loadAccounts();
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('Delete this account?')) return;
    await deleteAccount(id);
    loadAccounts();
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setTitle(user.title || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleGenerateInvite = async () => {
    const res = await createInvite({ expiresInHours: 72 });
    const baseUrl = window.location.origin;
    setInviteUrl(`${baseUrl}/join/${res.data.inviteToken}`);
    setInviteExpires(new Date(res.data.expiresAt).toLocaleString());
    setCopied('');
  };

  const handleGenerateAdvisorInvite = async () => {
    const res = await createAdvisorInvite({ expiresInHours: 72 });
    const baseUrl = window.location.origin;
    setAdvisorInviteUrl(`${baseUrl}/join/${res.data.inviteToken}`);
    setAdvisorInviteExpires(new Date(res.data.expiresAt).toLocaleString());
    setCopied('');
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 3000);
  };

  const handleSaveProfile = async () => {
    await updateProfile({ displayName, title, avatarUrl });
    await refreshUser();
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    await updateHouseholdSettings({
      showInternalTransfers,
      reminderEnabled,
      reminderDayOfMonth,
      reminderEmail,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleToggleInternalTransfers = async (val) => {
    setShowInternalTransfers(val);
    await updateHouseholdSettings({ showInternalTransfers: val });
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {/* Profile Section */}
      <div className="section">
        <h2>Profile</h2>
        <div className="profile-form">
          <div className="avatar-section">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="avatar-preview" />
            ) : (
              <div className="avatar-preview avatar-empty">
                {(displayName || user?.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <label className="btn-upload">
              Upload Photo
              <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
            </label>
            {avatarUrl && (
              <button className="btn-text-danger" onClick={() => setAvatarUrl('')}>Remove</button>
            )}
          </div>
          <div className="profile-fields">
            <label>
              <span className="label-text">Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user?.name}
              />
            </label>
            <label>
              <span className="label-text">Title / Role</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Software Engineer"
              />
            </label>
            <button className="btn-primary" onClick={handleSaveProfile}>
              {profileSaved ? 'Saved!' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {household && (
        <div className="section">
          <h2>Household: {household.name}</h2>

          <div className="members-list">
            <h3>Members</h3>
            {household.members?.map((m) => (
              <div key={m._id} className="member-row">
                <div className="member-info">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="member-avatar" />
                  ) : (
                    <span className="member-avatar-placeholder">
                      {(m.displayName || m.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <span className="member-name">{m.displayName || m.name}</span>
                    {m.title && <span className="member-title">{m.title}</span>}
                  </div>
                </div>
                <span className="member-role">
                  {m._id === household.admin?._id ? 'Admin' : m.role === 'advisor' ? 'Advisor' : 'Member'}
                </span>
              </div>
            ))}
          </div>

          {isAdmin && (
            <>
              {/* Internal Transfer Toggle */}
              <div className="setting-row">
                <div className="setting-info">
                  <h3>Show Internal Transfers</h3>
                  <p>When enabled, internal transfer transactions will be included in dashboard calculations and reports.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showInternalTransfers}
                    onChange={(e) => handleToggleInternalTransfers(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Invite Family Member */}
              <div className="invite-section">
                <h3>Invite Family Member</h3>
                <p>Generate a link to invite someone to join your household. They can create their own account and see shared financial data.</p>
                <button className="btn-primary" onClick={handleGenerateInvite}>
                  Generate Invite Link
                </button>
                {inviteUrl && (
                  <div className="invite-result">
                    <div className="invite-url-box">
                      <input type="text" value={inviteUrl} readOnly className="invite-url" />
                      <button className="btn-copy" onClick={() => handleCopy(inviteUrl, 'member')}>
                        {copied === 'member' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="invite-expires">Expires: {inviteExpires} (72 hours)</p>
                    <p className="invite-hint">Share this link with your family member. They'll create a username and password to join.</p>
                  </div>
                )}
              </div>

              {/* Invite Advisor */}
              <div className="invite-section">
                <h3>Invite Financial Advisor</h3>
                <p>Generate a link for a financial advisor. Advisors get read-only access to your household's financial data.</p>
                <button className="btn-secondary" onClick={handleGenerateAdvisorInvite}>
                  Generate Advisor Invite
                </button>
                {advisorInviteUrl && (
                  <div className="invite-result">
                    <div className="invite-url-box">
                      <input type="text" value={advisorInviteUrl} readOnly className="invite-url" />
                      <button className="btn-copy" onClick={() => handleCopy(advisorInviteUrl, 'advisor')}>
                        {copied === 'advisor' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="invite-expires">Expires: {advisorInviteExpires} (72 hours)</p>
                    <p className="invite-hint advisor-hint">Advisors can view data but cannot edit, delete, or import transactions.</p>
                  </div>
                )}
              </div>

              {/* Email Reminders */}
              <div className="invite-section">
                <h3>Monthly Email Reminders</h3>
                <div className="setting-row">
                  <div className="setting-info">
                    <p>Receive a monthly reminder to update your financial records.</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => setReminderEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                {reminderEnabled && (
                  <div className="reminder-settings">
                    <label>
                      <span className="label-text">Reminder Day of Month</span>
                      <select
                        value={reminderDayOfMonth}
                        onChange={(e) => setReminderDayOfMonth(parseInt(e.target.value))}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="label-text">Reminder Email</span>
                      <input
                        type="email"
                        value={reminderEmail}
                        onChange={(e) => setReminderEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </label>
                    <button className="btn-primary" onClick={handleSaveSettings}>
                      {settingsSaved ? 'Saved!' : 'Save Reminder Settings'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Subscription Status */}
      <div className="section">
        <h2>Subscription</h2>
        {subscription ? (
          <div className="subscription-status">
            <div className={`status-badge ${subscription.status}`}>
              {subscription.status === 'active' ? 'Pro Plan - Active' :
               subscription.status === 'cancelled' ? 'Cancelled' : 'Free Plan'}
            </div>
            {subscription.currentPeriodEnd && subscription.status === 'active' && (
              <p className="renewal-date">
                Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {subscription.status !== 'active' && (
              <p className="upgrade-hint">
                <a href="/pricing">Upgrade to Pro</a> to unlock CSV import and email reminders.
              </p>
            )}
          </div>
        ) : (
          <p className="upgrade-hint">
            <a href="/pricing">View pricing plans</a>
          </p>
        )}
      </div>

      {/* Accounts Section */}
      <div className="section">
        <div className="section-header-row">
          <h2>Accounts</h2>
          <div className="header-actions">
            <select value={acctFilterOwner} onChange={(e) => setAcctFilterOwner(e.target.value)}>
              <option value="">All Users</option>
              {acctUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
            {canWrite && (
              <button className="btn-primary" onClick={() => { setAcctForm({ owner: acctUsers[0]?._id || '', bank: 'TD', type: 'debit', lastFourDigits: '', nickname: '' }); setShowAcctModal(true); }}>
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
              {canWrite && <button className="btn-sm btn-danger" onClick={() => handleDeleteAccount(acc._id)}>Remove</button>}
            </div>
          ))}
          {accounts.length === 0 && <p className="no-data">No accounts found</p>}
        </div>
      </div>

      {showAcctModal && (
        <div className="modal-overlay" onClick={() => setShowAcctModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Account</h2>
            <form onSubmit={handleSaveAccount}>
              <label>
                Owner
                <select value={acctForm.owner} onChange={(e) => setAcctForm({ ...acctForm, owner: e.target.value })} required>
                  <option value="">Select</option>
                  {acctUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </label>
              <label>
                Bank
                <select value={acctForm.bank} onChange={(e) => setAcctForm({ ...acctForm, bank: e.target.value })}>
                  {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label>
                Type
                <select value={acctForm.type} onChange={(e) => setAcctForm({ ...acctForm, type: e.target.value })}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </label>
              <label>
                Last 4 Digits
                <input value={acctForm.lastFourDigits} onChange={(e) => setAcctForm({ ...acctForm, lastFourDigits: e.target.value })} maxLength="4" />
              </label>
              <label>
                Nickname
                <input value={acctForm.nickname} onChange={(e) => setAcctForm({ ...acctForm, nickname: e.target.value })} />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAcctModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="section">
        <h2>Security</h2>
        <p className="security-note">
          All transaction data is encrypted with AES-256-GCM. Each household has a unique encryption key.
          Even with database access, your financial data cannot be read without your household's key.
        </p>
      </div>
    </div>
  );
}
