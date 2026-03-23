// Multi-level category hierarchy
// Maps existing flat categories into parent groups for drill-down
// No schema change needed — pure client-side mapping

export const CATEGORY_HIERARCHY = {
  'Food & Dining': {
    color: '#2ecc71',
    icon: '🍽',
    subcategories: ['Groceries', 'Restaurants', 'Food Delivery'],
  },
  'Transportation': {
    color: '#3498db',
    icon: '🚗',
    subcategories: ['Transportation', 'Gas'],
  },
  'Housing & Utilities': {
    color: '#9b59b6',
    icon: '🏠',
    subcategories: ['Housing/Rent', 'Utilities', 'Furniture'],
  },
  'Personal & Health': {
    color: '#e91e63',
    icon: '💊',
    subcategories: ['Health', 'Personal Care', 'Clothing', 'Education'],
  },
  'Entertainment & Lifestyle': {
    color: '#ff5722',
    icon: '🎮',
    subcategories: ['Entertainment', 'Shopping', 'Subscriptions', 'Travel', 'Pets'],
  },
  'Financial': {
    color: '#f39c12',
    icon: '🏦',
    subcategories: ['Insurance', 'Fees & Charges', 'Transfer', 'Transfers', 'Internal Transfer'],
  },
  'Income': {
    color: '#8bc34a',
    icon: '💰',
    subcategories: ['Income', 'Salary'],
  },
  'Other': {
    color: '#9e9e9e',
    icon: '📦',
    subcategories: ['Other'],
  },
};

// Reverse lookup: subcategory → parent
const _reverseMap = {};
for (const [parent, info] of Object.entries(CATEGORY_HIERARCHY)) {
  for (const sub of info.subcategories) {
    _reverseMap[sub] = parent;
  }
}

export function getParentCategory(subCategory) {
  return _reverseMap[subCategory] || 'Other';
}

export function getParentColor(subCategory) {
  const parent = getParentCategory(subCategory);
  return CATEGORY_HIERARCHY[parent]?.color || '#9e9e9e';
}

/**
 * Groups the flat byCategory array from the API into parent category totals
 * Input:  [{ _id: 'Groceries', total: 500 }, { _id: 'Restaurants', total: 200 }, ...]
 * Output: [{ name: 'Food & Dining', total: 700, color: '#2ecc71', subs: [...] }, ...]
 */
export function groupByParentCategory(byCategoryArray) {
  const groups = {};

  for (const item of byCategoryArray) {
    const parent = getParentCategory(item._id);
    if (!groups[parent]) {
      groups[parent] = {
        name: parent,
        total: 0,
        color: CATEGORY_HIERARCHY[parent]?.color || '#9e9e9e',
        icon: CATEGORY_HIERARCHY[parent]?.icon || '',
        subs: [],
      };
    }
    groups[parent].total += item.total;
    groups[parent].subs.push({
      name: item._id,
      total: item.total,
      count: item.count || 0,
    });
  }

  // Sort parent groups by total descending, subs within each group too
  return Object.values(groups)
    .sort((a, b) => b.total - a.total)
    .map((g) => ({
      ...g,
      subs: g.subs.sort((a, b) => b.total - a.total),
    }));
}

// All flat categories for dropdowns
export const ALL_CATEGORIES = [
  'Groceries', 'Restaurants', 'Transportation', 'Housing/Rent',
  'Utilities', 'Entertainment', 'Health', 'Education', 'Clothing',
  'Subscriptions', 'Shopping', 'Gas', 'Insurance', 'Income', 'Transfer',
  'Transfers', 'Fees & Charges', 'Pets', 'Food Delivery',
  'Travel', 'Salary', 'Furniture', 'Personal Care', 'Other',
];

// Subcategory color (uses parent color)
export const SUB_COLORS = {};
for (const [parent, info] of Object.entries(CATEGORY_HIERARCHY)) {
  for (const sub of info.subcategories) {
    SUB_COLORS[sub] = info.color;
  }
}
