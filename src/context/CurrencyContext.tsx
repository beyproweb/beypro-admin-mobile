import React, { createContext, useContext, useState, ReactNode } from "react";

export interface CurrencyContextType {
  currency: string;
  setCurrency: (c: string) => void;
  formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be inside CurrencyProvider");
  return ctx;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<string>("₺");

  const formatCurrency = (amount: number) =>
    `${currency}${amount.toFixed(2)}`;

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, formatCurrency }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}
