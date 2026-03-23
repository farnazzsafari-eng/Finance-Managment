import { useState, useMemo } from 'react';
import './DateRangeFilter.css';

function getPresetDates(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'thisMonth': {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case 'lastMonth': {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case 'last3Months': {
      const start = new Date(y, m - 2, 1);
      const end = new Date(y, m + 1, 0);
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case 'thisYear': {
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
    }
    case 'lastYear': {
      return { startDate: `${y - 1}-01-01`, endDate: `${y - 1}-12-31` };
    }
    case 'allTime': {
      return { startDate: '2024-01-01', endDate: fmt(now) };
    }
    default:
      return { startDate: fmt(new Date(y, m, 1)), endDate: fmt(now) };
  }
}

function fmt(d) {
  return d.toISOString().split('T')[0];
}

const PRESETS = [
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'last3Months', label: 'Last 3M' },
  { key: 'thisYear', label: 'This Year' },
  { key: 'lastYear', label: 'Last Year' },
  { key: 'allTime', label: 'All Time' },
];

export default function DateRangeFilter({ users, owner, onOwnerChange, startDate, endDate, onDateChange }) {
  const [activePreset, setActivePreset] = useState('thisMonth');

  const handlePreset = (preset) => {
    setActivePreset(preset);
    const dates = getPresetDates(preset);
    onDateChange(dates.startDate, dates.endDate);
  };

  const handleCustomDate = (field, value) => {
    setActivePreset('custom');
    if (field === 'start') onDateChange(value, endDate);
    else onDateChange(startDate, value);
  };

  return (
    <div className="date-range-filter">
      <div className="filter-row">
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`preset-btn ${activePreset === p.key ? 'active' : ''}`}
              onClick={() => handlePreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="custom-dates">
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleCustomDate('start', e.target.value)}
          />
          <span className="date-sep">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleCustomDate('end', e.target.value)}
          />
        </div>
        {users && (
          <select className="owner-select" value={owner} onChange={(e) => onOwnerChange(e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export { getPresetDates };
