// Starter categories every new account gets. After that, users own their categories (Setup tab).
export const DEFAULT_CATS = [
  { name: 'Food', type: 'expense', emoji: '🍜', color: '#F0604D', budget: 9000 },
  { name: 'Transport', type: 'expense', emoji: '🚕', color: '#F2A93B', budget: 4000 },
  { name: 'Shopping', type: 'expense', emoji: '🛍️', color: '#8E6CEF', budget: 8000 },
  { name: 'Bills', type: 'expense', emoji: '💡', color: '#2E86DE', budget: 7000 },
  { name: 'Fun', type: 'expense', emoji: '🎬', color: '#E455A0', budget: 3500 },
  { name: 'Health', type: 'expense', emoji: '💊', color: '#1E9E6A', budget: 2500 },
  { name: 'Other', type: 'expense', emoji: '📦', color: '#8A9A94', budget: 0 },
  { name: 'Salary', type: 'income', emoji: '💼', color: '#1E9E6A', budget: 0 },
  { name: 'Freelance', type: 'income', emoji: '💻', color: '#12B5A6', budget: 0 },
];

// Built-in labels used by saving and transfer transactions (not user-editable)
export const SPECIAL = {
  Savings: { emoji: '🎯', color: '#12B5A6' },
  Transfer: { emoji: '🔁', color: '#8A9A94' },
};
export const RESERVED = ['savings', 'transfer'];

// No dots or $ so a name is always safe to use as a MongoDB field key (budget limits are keyed by name)
export const CATEGORY_NAME_RE = /^[\p{L}\p{N} &'\-/()]{1,24}$/u;

export const ACCOUNT_TYPES = { bank: '🏦', cash: '💵', card: '💳', wallet: '📱', other: '👛' };

export const DEFAULT_SETTINGS = { savingsTarget: 20, rollover: false, emergencyMonths: 6 };
