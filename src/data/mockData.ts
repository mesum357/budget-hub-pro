export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface BudgetRecord {
  userId: string;
  userName: string;
  budgetAvailable: number;
  budgetAllotted: number;
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

export const initialUsers: User[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah@company.com", role: "Manager", status: "active", createdAt: "2024-01-15" },
  { id: "2", name: "Michael Chen", email: "michael@company.com", role: "Analyst", status: "active", createdAt: "2024-02-20" },
  { id: "3", name: "Emily Davis", email: "emily@company.com", role: "Developer", status: "active", createdAt: "2024-03-10" },
  { id: "4", name: "James Wilson", email: "james@company.com", role: "Designer", status: "inactive", createdAt: "2024-04-05" },
  { id: "5", name: "Olivia Martinez", email: "olivia@company.com", role: "Manager", status: "active", createdAt: "2024-05-12" },
  { id: "6", name: "Daniel Brown", email: "daniel@company.com", role: "Analyst", status: "active", createdAt: "2024-06-18" },
];

export const initialBudgets: BudgetRecord[] = [
  { userId: "1", userName: "Sarah Johnson", budgetAvailable: 4500, budgetAllotted: 8000 },
  { userId: "2", userName: "Michael Chen", budgetAvailable: 3200, budgetAllotted: 5000 },
  { userId: "3", userName: "Emily Davis", budgetAvailable: 6100, budgetAllotted: 7000 },
  { userId: "4", userName: "James Wilson", budgetAvailable: 1800, budgetAllotted: 4000 },
  { userId: "5", userName: "Olivia Martinez", budgetAvailable: 5400, budgetAllotted: 9000 },
  { userId: "6", userName: "Daniel Brown", budgetAvailable: 2900, budgetAllotted: 6000 },
];

export const initialSpendings: SpendingReceipt[] = [
  { id: "r1", userId: "1", userName: "Sarah Johnson", amount: 1250, reason: "Team offsite catering", date: "2026-04-08", status: "approved", category: "Events", attachment: "receipt_001.pdf" },
  { id: "r2", userId: "2", userName: "Michael Chen", amount: 89.99, reason: "Software license renewal", date: "2026-04-07", status: "pending", category: "Software" },
  { id: "r3", userId: "3", userName: "Emily Davis", amount: 340, reason: "Cloud hosting upgrade", date: "2026-04-06", status: "approved", category: "Infrastructure", attachment: "invoice_003.pdf" },
  { id: "r4", userId: "1", userName: "Sarah Johnson", amount: 560, reason: "Client dinner meeting", date: "2026-04-05", status: "pending", category: "Meals" },
  { id: "r5", userId: "5", userName: "Olivia Martinez", amount: 2100, reason: "Conference tickets (2x)", date: "2026-04-04", status: "approved", category: "Events", attachment: "conf_tickets.pdf" },
  { id: "r6", userId: "6", userName: "Daniel Brown", amount: 175, reason: "Office supplies", date: "2026-04-03", status: "rejected", category: "Supplies" },
  { id: "r7", userId: "2", userName: "Michael Chen", amount: 450, reason: "Travel expense - client visit", date: "2026-04-02", status: "approved", category: "Travel", attachment: "travel_receipt.pdf" },
  { id: "r8", userId: "4", userName: "James Wilson", amount: 95, reason: "Design tool subscription", date: "2026-04-01", status: "pending", category: "Software" },
];

export const monthlySpendingData = [
  { month: "Nov", spending: 18500, budget: 39000 },
  { month: "Dec", spending: 22300, budget: 39000 },
  { month: "Jan", spending: 19800, budget: 39000 },
  { month: "Feb", spending: 24100, budget: 39000 },
  { month: "Mar", spending: 21600, budget: 39000 },
  { month: "Apr", spending: 16400, budget: 39000 },
];

export const spendingByUser = [
  { name: "Sarah J.", spent: 3500 },
  { name: "Michael C.", spent: 1800 },
  { name: "Emily D.", spent: 900 },
  { name: "James W.", spent: 2200 },
  { name: "Olivia M.", spent: 3600 },
  { name: "Daniel B.", spent: 3100 },
];

export const categoryData = [
  { name: "Events", value: 3350 },
  { name: "Software", value: 1850 },
  { name: "Infrastructure", value: 2400 },
  { name: "Meals", value: 1200 },
  { name: "Travel", value: 1800 },
  { name: "Supplies", value: 800 },
];
