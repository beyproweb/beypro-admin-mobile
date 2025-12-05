import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { getItem } from "../utils/storage";

export interface StockItem {
  stock_id?: string;
  id?: string;
  name: string;
  unit: string;
  quantity: number;
  price_per_unit: number;
  supplier_name?: string;
  supplier?: string;
  critical_quantity?: number;
  reorder_quantity?: number;
  expiry_date?: string;
}

export interface StockContextType {
  groupedData: StockItem[];
  setGroupedData: (s: StockItem[]) => void;
  loading: boolean;
  error: string | null;
  fetchStock: () => Promise<void>;
  handleAddToCart: (item: StockItem) => Promise<void>;
  handleDeleteStock: (item: StockItem) => Promise<void>;
  handleCriticalChange: (index: number, value: number) => Promise<void>;
  handleReorderChange: (index: number, value: number) => Promise<void>;
}

const StockContext = createContext<StockContextType | null>(null);

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStock must be inside StockProvider");
  return ctx;
}

export function StockProvider({ children }: { children: ReactNode }) {
  const [groupedData, setGroupedData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  const { user } = useAuth();
  
  // Get base URL from environment or constants
  const expoConfig = Constants.expoConfig ?? (Constants as any).manifest;
  const baseUrl = expoConfig?.extra?.EXPO_PUBLIC_API_URL ?? 
    process.env.EXPO_PUBLIC_API_URL ?? 
    "https://hurrypos-backend.onrender.com/api";

  // Load token from SecureStore on mount
  useEffect(() => {
    (async () => {
      try {
        try {
          const storedToken = await getItem("token");
          setToken(storedToken);
        } catch (secureStoreErr) {
          // SecureStore might not be available in web/simulator environments
          console.warn("SecureStore not available, trying alternative:", secureStoreErr);
        }
      } catch (err) {
        console.error("Error loading token:", err);
      }
    })();
  }, []);

  const fetchStock = useCallback(async () => {
      if (!token || !baseUrl) {
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${baseUrl}/stock`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stock: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setGroupedData(Array.isArray(data) ? data : data.data || []);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }, [token, baseUrl]);  const handleAddToCart = useCallback(async (item: StockItem) => {
    if (!token || !baseUrl) return;
    
    try {
      const response = await fetch(`${baseUrl}/supplier-cart`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock_id: item.stock_id || item.id,
          quantity: 1,
          supplier_name: item.supplier_name || item.supplier,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to add to cart");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
    }
  }, [token, baseUrl]);

  const handleDeleteStock = useCallback(async (item: StockItem) => {
    if (!token || !baseUrl) return;
    
    try {
      const stockId = item.stock_id || item.id;
      if (!stockId) throw new Error("No stock ID provided");
      
      const response = await fetch(`${baseUrl}/stock/${stockId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error("Failed to delete stock");
      
      setGroupedData(prev => prev.filter(s => (s.stock_id || s.id) !== stockId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete stock");
    }
  }, [token, baseUrl]);

  const handleCriticalChange = useCallback(async (index: number, value: number) => {
    const updated = [...groupedData];
    const item = updated[index];
    if (!item) return;
    
    item.critical_quantity = value;
    setGroupedData(updated);
    
    if (!token || !baseUrl) return;
    
    try {
      const stockId = item.stock_id || item.id;
      if (!stockId) throw new Error("No stock ID");
      
      const response = await fetch(`${baseUrl}/stock/${stockId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: item.quantity,
          critical_quantity: value,
          reorder_quantity: item.reorder_quantity,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to update critical quantity");
    } catch (err) {
      // Error silently handled
    }
  }, [groupedData, token, baseUrl]);

  const handleReorderChange = useCallback(async (index: number, value: number) => {
    const updated = [...groupedData];
    const item = updated[index];
    if (!item) return;
    
    const parsedValue = parseFloat(String(value)) || 0;
    item.reorder_quantity = parsedValue;
    setGroupedData(updated);
    
    if (!token || !baseUrl) return;
    
    try {
      const stockId = item.stock_id || item.id;
      if (!stockId) throw new Error("No stock ID");
      
      const response = await fetch(`${baseUrl}/stock/${stockId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          critical_quantity: item.critical_quantity,
          reorder_quantity: parsedValue,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to update reorder quantity");
    } catch (err) {
      // Error silently handled
    }
  }, [groupedData, token, baseUrl]);

  return (
    <StockContext.Provider
      value={{
        groupedData,
        setGroupedData,
        loading,
        error,
        fetchStock,
        handleAddToCart,
        handleDeleteStock,
        handleCriticalChange,
        handleReorderChange,
      }}
    >
      {children}
    </StockContext.Provider>
  );
}
