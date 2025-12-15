import { createContext, useContext, useState, ReactNode } from "react";

type Branch = "SEFT Bekasi" | "SEFT Jogja" | "SEFT ALL";

interface BranchContextType {
  selectedBranch: Branch;
  setSelectedBranch: (branch: Branch) => void;
  getBranchFilter: () => string | null;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranch, setSelectedBranch] = useState<Branch>("SEFT Jogja");

  const getBranchFilter = (): string | null => {
    switch (selectedBranch) {
      case "SEFT Bekasi":
        return "SEFT Corp - Bekasi";
      case "SEFT Jogja":
        return "SEFT Corp - Jogja";
      case "SEFT ALL":
        return null; // No filter, show all
    }
  };

  return (
    <BranchContext.Provider value={{ selectedBranch, setSelectedBranch, getBranchFilter }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
