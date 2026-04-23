import { useAuth } from "@/contexts/AuthContext";
import {
  mockInvoices,
  mockSubscriptions,
  mockExpenses,
  mockBankAccounts,
  mockAccountsReceivable,
  mockAccountsPayable,
  mockTransactions,
  mockCashFlow,
} from "@/types/financial";

/**
 * Returns mock financial data for agency users; empty arrays for client users.
 * Clients should start with a clean slate and fill their own data.
 */
export const useFinancialData = () => {
  const { profile } = useAuth();
  const isClient = profile?.tenant_type === "client";

  if (isClient) {
    return {
      invoices: [],
      subscriptions: [],
      expenses: [],
      bankAccounts: [],
      accountsReceivable: [],
      accountsPayable: [],
      transactions: [],
      cashFlow: [],
      isClient: true,
    };
  }

  return {
    invoices: mockInvoices,
    subscriptions: mockSubscriptions,
    expenses: mockExpenses,
    bankAccounts: mockBankAccounts,
    accountsReceivable: mockAccountsReceivable,
    accountsPayable: mockAccountsPayable,
    transactions: mockTransactions,
    cashFlow: mockCashFlow,
    isClient: false,
  };
};
