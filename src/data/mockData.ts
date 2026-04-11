/** Shared row shapes for API-backed tables (mock arrays removed). */

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  createdAt: string;
  allottedBudget?: number;
  walletBalance?: number;
  avatar?: string;
}

export interface BudgetRecord {
  userId: string;
  userName: string;
  budgetAvailable: number;
  budgetAllotted: number;
  spent: number;
  utilizationPct: number;
}

export interface SpendingReceipt {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  reason: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  attachment?: string;
  category: string;
}

export interface MonthlyPoint {
  month: string;
  spending: number;
  budget: number;
}
