import React, { createContext, useContext, useState, ReactNode } from "react";

export interface StockContextType {
  stock: any[];
  setStock: (s: any[]) => void;
}

const StockContext = createContext<StockContextType | null>(null);

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStock must be inside StockProvider");
  return ctx;
}

export function StockProvider({ children }: { children: ReactNode }) {
  const [stock, setStock] = useState<any[]>([]);

  return (
    <StockContext.Provider value={{ stock, setStock }}>
      {children}
    </StockContext.Provider>
  );
}
