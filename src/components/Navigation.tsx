import { Database, FileText, Search, Tags, UserCheck, CreditCard, Menu, ChevronDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Navigation() {
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState("SEFT Jogja");

  const branches = [
    { id: "bekasi", label: "SEFT Bekasi" },
    { id: "jogja", label: "SEFT Jogja" },
    { id: "all", label: "SEFT ALL" },
  ];

  const menuItems = [
    { to: "/", icon: Database, label: "Data SH2M" },
    { to: "/highticket", icon: FileText, label: "Data Highticket" },
    { to: "/cicilan", icon: CreditCard, label: "Data Cicilan" },
    { to: "/search", icon: Search, label: "Pencarian Client" },
    { to: "/source-categories", icon: Tags, label: "Kategori Source Iklan" },
    { to: "/leads-ec", icon: UserCheck, label: "Leads EC" },
  ];

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-xl font-bold">
                  <Building2 className="h-5 w-5" />
                  SEFT CORP
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
                {branches.map((branch) => (
                  <DropdownMenuItem
                    key={branch.id}
                    onClick={() => setSelectedBranch(branch.label)}
                    className={`cursor-pointer ${selectedBranch === branch.label ? "bg-accent" : ""}`}
                  >
                    {branch.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-sm text-muted-foreground">|</span>
            <span className="text-sm font-medium text-foreground">{selectedBranch}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
              {menuItems.map((item) => (
                <DropdownMenuItem
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
