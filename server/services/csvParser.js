const { parse } = require('csv-parse/sync');

const CATEGORY_KEYWORDS = {
  // Salary/payroll first (high priority)
  Salary: ['payroll', 'pay ', 'salary', 'notify me! pay', 'notify me|', 'dueck on marine'],
  // Food delivery before restaurants (more specific)
  'Food Delivery': ['uber canada/ubereats', 'ubereats', 'doordash', 'skip the dish', 'skipthedishes'],
  Groceries: ['grocery', 'superstore', 'save-on', 'save on', 'no frills', 'loblaws', 'sobeys', 'metro grocery',
    'freshco', 'walmart', 'wal-mart', 'costco wholesal', 'real cdn', 'www costco ca', 'www.costco', 'costco warehouse',
    'costco online', 'the meat shop', 'persia foods', 't&t supermarket', 'jasmine halal', 'vicinity mart'],
  Restaurants: ['restaurant', 'pizza', 'burger', 'sushi', 'cafe', 'bakery', 'coffee', 'starbucks', 'tim hortons',
    'mcdonalds', 'subway', 'opa!', 'breka', 'cream pony', 'king eddy', 'pita bar', 'bin 4', 'fig face',
    'local river', 'skewers', 'nando', 'a&w', 'wendys', 'popeyes', 'white spot', 'earls', 'cactus club',
    'joeys', 'moxies', 'the keg', 'denny', 'ihop', 'boston pizza', 'red robin', 'grill'],
  Travel: ['booking.com', 'airbnb', 'hotel', 'hostel', 'flight', 'airline', 'air canada', 'westjet', 'expedia',
    'trip.com', 'agoda', 'kayak', 'trivago'],
  Furniture: ['accents at home', 'furniture', 'structube', 'eq3', 'article.com', 'wayfair', 'cb2', 'crate & barrel'],
  Transportation: ['uber canada/ubertrip', 'lyft', 'transit', 'parking', 'compass account', 'translink',
    'gm financial', 'carter chevrolet', 'autopark', 'impark', 'easypark', 'compass autoload',
    'chevron', 'bridgepoint', 'marine drive', 'alamo canada', 'rusty', 'towing'],
  'Housing/Rent': ['rent', 'mortgage', 'property tax', 'strata'],
  Utilities: ['hydro', 'b.c. hydro', 'bc hydro', 'electric', 'water', 'phone', 'rogers', 'bell',
    'telus', 'fido', 'koodo', 'shaw', 'freedom mobile', 'chatr', 'virgin mobile', 'novus'],
  Entertainment: ['netflix', 'spotify', 'disney', 'apple music', 'cinema', 'theatre', 'game', 'playstation',
    'xbox', 'nintendo', 'steam', 'twitch', 'youtube premium', 'crave', 'showpass', 'everything wine',
    'wine', 'liquor', 'beer', 'bcf - online'],
  Health: ['pharmacy', 'shoppers drug', 'drug mart', 'dental', 'doctor', 'clinic', 'medical', 'felix health',
    'lifelab', 'optometrist', 'physiotherapy', 'massage', 'wellness'],
  Clothing: ['aritzia', 'h&m', 'zara', 'winners', 'marshalls', 'gap', 'old navy', 'uniqlo',
    'tommy hilfiger', 'jack jones', 'ecco', 'blundstone', 'timberland', 'mountain warehouse',
    'mountainwarehouse', 'herschel', 'shein', 'muji', 'aldo', 'thelatestscoop', 'homesense'],
  'Personal Care': ['sephora', 'lush', 'bath & body', 'salon', 'barber', 'hair', 'nail', 'spa',
    'mosaic training'],
  Shopping: ['amazon', 'amzn', 'temu', 'best buy', 'ikea', 'canadian tire', 'canadiantir', 'home depot',
    'dollarama', 'american eagle', 'pandora', 'zwilling', 'lindt', 'velvet vape', 'city vaper',
    'staples', 'london drugs', 'apple store', 'microsoft store', 'vevor', 'sp fig face',
    'magic box hobbies', 'abadan'],
  Gas: ['petro-canada', 'petro canada', 'shell', 'esso', 'pioneer', 'costco gas', 'gas station', 'chevron', 'husky'],
  Insurance: ['insurance', 'insur', 'manulife', 'sun life', 'great west', 'icbc'],
  Subscriptions: ['subscription', 'membership', 'google *google one', 'apple.com/bill', 'figma',
    'loom', 'catchcorner', 'fetch', 'ai-pro.org', 'gocardless', 'adobe', 'microsoft 365', 'icloud',
    'chatgpt', 'openai', '10web', 'framer.com', 'dominion s', 'wp*dominion'],
  Education: ['immigration can', 'world education', 'wes ', 'tuition', 'course', 'udemy'],
  // Internal transfers (between own accounts or family) — excluded from income/expense
  'Internal Transfer': [
    'cibc visa', 'td visa', 'rbc visa', 'amex card',
    'internet transfer', 'internet deposit',
    'pts to:', 'pts frm:', 'jx360 tfr', 'open account',
    'bonus interest', 'chq offer', 'sav offer',
    'credit memo', 'debit memo', 'eft debit reversal',
    'pre-authorized debit cibc', 'preauthorized debit',
    'atm deposit', 'deposit ibb', 'atm withdrawal',
    'scotiabank payment', 'online banking payment', 'bill payment',
    'payment thank you', 'payment - thank you', 'paiement',
    'payback with points', 'cashback', 'remise en argent',
    'transfer_tf', 'moneymove', 'aft_in',
    'correction uber', 'purchase reversal',
    'td canada trust toronto',
    'laptop', 'gif m',
  ],
  // External transfers (real money in/out) — counted as income/expense
  Transfers: ['e-transfer', 'e-tfr', 'e_trfin', 'e_trfout', 'eft',
    'send e-tfr', 'cancel e-tfr', 'wise  msp',
    'internet banking'],
  'Fees & Charges': ['annual fee', 'service charge', 'monthly account fee', 'acct fee rebate',
    'purchase interest', 'nsf', 'returned payment', 'non-sufficient', 'ret\'d pre-auth',
    'service charge rewards', 'service charge capped'],
  Pets: ["bosley's", 'pet valu', 'pet supplies'],
};

function categorize(description) {
  if (!description) return 'Other';
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'Other';
}

// ========== BANK-SPECIFIC PARSERS ==========

/**
 * CIBC Credit & Debit (no headers)
 * Credit: date,description,debit,credit,card_number
 * Debit:  date,description,debit,credit  (no card number, sometimes 3 cols)
 */
function parseCIBC(csvContent, { ownerId, bank, cardType }) {
  const records = parse(csvContent, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  return records.map((cols) => {
    const date = cols[0];
    const description = cols[1] || '';
    const debit = parseFloat(cols[2]) || 0;
    const credit = parseFloat(cols[3]) || 0;

    const amount = debit > 0 ? debit : credit;
    const type = debit > 0 ? 'expense' : 'income';

    return {
      owner: ownerId,
      date: new Date(date),
      description: description.trim(),
      amount: Math.abs(amount),
      type,
      category: categorize(description),
      bank,
      cardType,
      source: 'csv-import',
    };
  }).filter((t) => !isNaN(t.amount) && t.amount > 0 && !isNaN(t.date.getTime()));
}

/**
 * TD Debit/Credit/Saving (no headers, quoted)
 * Format: "date","description","debit","credit","balance"
 */
function parseTD(csvContent, { ownerId, bank, cardType }) {
  const records = parse(csvContent, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  return records.map((cols) => {
    const date = cols[0];
    const description = cols[1] || '';
    const debit = parseFloat(cols[2]) || 0;
    const credit = parseFloat(cols[3]) || 0;

    const amount = debit > 0 ? debit : credit;
    const type = debit > 0 ? 'expense' : 'income';

    return {
      owner: ownerId,
      date: new Date(date),
      description: description.trim(),
      amount: Math.abs(amount),
      type,
      category: categorize(description),
      bank,
      cardType,
      source: 'csv-import',
    };
  }).filter((t) => !isNaN(t.amount) && t.amount > 0 && !isNaN(t.date.getTime()));
}

/**
 * RBC Credit & Debit (has headers)
 * Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$
 */
function parseRBC(csvContent, { ownerId, bank, cardType }) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row) => {
    const date = row['Transaction Date'];
    const desc1 = row['Description 1'] || '';
    const desc2 = row['Description 2'] || '';
    const description = [desc1, desc2].filter(Boolean).join(' ').trim();
    const cadAmount = parseFloat(row['CAD$']) || 0;

    return {
      owner: ownerId,
      date: new Date(date),
      description,
      amount: Math.abs(cadAmount),
      type: cadAmount < 0 ? 'expense' : 'income',
      category: categorize(description),
      bank,
      cardType,
      source: 'csv-import',
    };
  }).filter((t) => !isNaN(t.amount) && t.amount > 0 && !isNaN(t.date.getTime()));
}

/**
 * Scotia Debit (has headers)
 * Filter,Date,Description,Sub-description,Type of Transaction,Amount,Balance
 */
function parseScotia(csvContent, { ownerId, bank, cardType }) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row) => {
    const date = row['Date'];
    const description = [row['Description'], row['Sub-description']].filter(Boolean).join(' ').trim();
    const amount = parseFloat(row['Amount']) || 0;
    const txType = (row['Type of Transaction'] || '').toLowerCase();

    return {
      owner: ownerId,
      date: new Date(date),
      description,
      amount: Math.abs(amount),
      type: txType === 'credit' || amount > 0 ? 'income' : 'expense',
      category: categorize(description),
      bank,
      cardType,
      source: 'csv-import',
    };
  }).filter((t) => !isNaN(t.amount) && t.amount > 0 && !isNaN(t.date.getTime()));
}

/**
 * Wealthsimple (has headers)
 * transaction_date,settlement_date,account_id,account_type,activity_type,...,net_cash_amount
 */
function parseWealthsimple(csvContent, { ownerId, bank, cardType }) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  return records.map((row) => {
    const date = row['transaction_date'];
    const activityType = row['activity_type'] || '';
    const activitySub = row['activity_sub_type'] || '';
    const description = [activityType, activitySub, row['name'] || ''].filter(Boolean).join(' ').trim();
    const amount = parseFloat(row['net_cash_amount']) || 0;

    return {
      owner: ownerId,
      date: new Date(date),
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      category: categorize(description),
      bank,
      cardType: cardType || 'debit',
      source: 'csv-import',
    };
  }).filter((t) => !isNaN(t.amount) && t.amount > 0 && !isNaN(t.date.getTime()));
}

/**
 * Generic parser (fallback, tries headers)
 */
function parseGeneric(csvContent, { ownerId, bank, cardType }) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row) => {
    const date = row['Date'] || row['Transaction Date'] || row['Posted Date'] || row['date'] || row['transaction_date'];
    const description = row['Description'] || row['Merchant'] || row['Name'] || row['description'] || row['Details'];
    let amount = parseFloat(row['Amount'] || row['amount'] || row['Debit'] || '0');
    const credit = parseFloat(row['Credit'] || '0');

    if (credit > 0) amount = credit;

    const isExpense = amount < 0 || (row['Debit'] && parseFloat(row['Debit']) > 0);

    return {
      owner: ownerId,
      date: new Date(date),
      description: description || 'Unknown',
      amount: Math.abs(amount),
      type: isExpense ? 'expense' : 'income',
      category: categorize(description || ''),
      bank,
      cardType,
      source: 'csv-import',
    };
  }).filter((t) => !isNaN(t.amount) && t.amount > 0 && !isNaN(t.date.getTime()));
}

/**
 * Main parseCSV function - routes to the correct bank parser
 */
function parseCSV(csvContent, options) {
  const { bank } = options;
  const bankLower = (bank || '').toLowerCase();

  if (bankLower === 'cibc') return parseCIBC(csvContent, options);
  if (bankLower === 'td') return parseTD(csvContent, options);
  if (bankLower === 'rbc') return parseRBC(csvContent, options);
  if (bankLower === 'scotia') return parseScotia(csvContent, options);
  if (bankLower === 'wealthsimple') return parseWealthsimple(csvContent, options);

  return parseGeneric(csvContent, options);
}

module.exports = { parseCSV, categorize };
