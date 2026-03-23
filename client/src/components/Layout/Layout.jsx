import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const { user, logout, isAdvisor } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.displayName || user?.name;
  const initials = (displayName || '?').charAt(0).toUpperCase();

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Finance</h2>
          <div className="user-info">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="sidebar-avatar" />
            ) : (
              <span className="sidebar-avatar-placeholder">{initials}</span>
            )}
            <div className="user-meta">
              <span className="user-badge">{displayName}</span>
              {user?.title && <span className="user-title">{user.title}</span>}
            </div>
          </div>
          {isAdvisor && (
            <div className="advisor-badge">Advisor View (Read-Only)</div>
          )}
        </div>
        <ul className="nav-links">
          <li><NavLink to="/">Dashboard</NavLink></li>
          <li><NavLink to="/transactions">Transactions</NavLink></li>
          <li><NavLink to="/accounts">Accounts</NavLink></li>
          <li><NavLink to="/reports">Reports</NavLink></li>
          <li><NavLink to="/assets">Assets</NavLink></li>
          {!isAdvisor && <li><NavLink to="/import">Import</NavLink></li>}
          <li><NavLink to="/pricing">Pricing</NavLink></li>
          <li><NavLink to="/settings">Settings</NavLink></li>
        </ul>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </nav>
      <main className="main-content">
        {isAdvisor && (
          <div className="advisor-banner">
            You are viewing this household as a Financial Advisor (read-only access)
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
