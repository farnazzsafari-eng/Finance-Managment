const BANK_CONFIG = {
  TD: { abbr: 'TD', color: '#008a4b', textColor: '#fff' },
  CIBC: { abbr: 'CIBC', color: '#c41f3e', textColor: '#fff' },
  RBC: { abbr: 'RBC', color: '#005daa', textColor: '#ffd700' },
  Scotia: { abbr: 'SCO', color: '#ec111a', textColor: '#fff' },
  Wealthsimple: { abbr: 'WS', color: '#222', textColor: '#fff' },
  BMO: { abbr: 'BMO', color: '#0075be', textColor: '#fff' },
  'National Bank': { abbr: 'NB', color: '#e4002b', textColor: '#fff' },
  Desjardins: { abbr: 'DES', color: '#00874e', textColor: '#fff' },
  Tangerine: { abbr: 'TNG', color: '#f58220', textColor: '#fff' },
  Simplii: { abbr: 'SIM', color: '#f47b20', textColor: '#fff' },
  'EQ Bank': { abbr: 'EQ', color: '#6b2fa0', textColor: '#fff' },
  HSBC: { abbr: 'HSBC', color: '#db0011', textColor: '#fff' },
};

const baseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  borderRadius: '6px',
  letterSpacing: '0.02em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

const SIZES = {
  sm: { fontSize: '0.65rem', padding: '3px 6px', minWidth: '28px' },
  md: { fontSize: '0.75rem', padding: '4px 10px', minWidth: '36px' },
  lg: { fontSize: '0.9rem', padding: '6px 14px', minWidth: '44px' },
};

export default function BankLogo({ bank, size = 'md', style: extraStyle }) {
  if (!bank) return <span style={{ color: '#aaa' }}>-</span>;

  const config = BANK_CONFIG[bank] || {
    abbr: bank.substring(0, 3).toUpperCase(),
    color: '#666',
    textColor: '#fff',
  };

  const sizeStyle = SIZES[size] || SIZES.md;

  return (
    <span
      style={{
        ...baseStyle,
        ...sizeStyle,
        background: config.color,
        color: config.textColor,
        ...extraStyle,
      }}
      title={bank}
    >
      {config.abbr}
    </span>
  );
}

export { BANK_CONFIG };
