import React, { createContext, useContext, useState, ReactNode } from "react";

export interface UserContextType {
  profile: any;
  setProfile: (p: any) => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be inside UserProvider");
  return ctx;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<any>(null);

  return (
    <UserContext.Provider value={{ profile, setProfile }}>
      {children}
    </UserContext.Provider>
  );
}
