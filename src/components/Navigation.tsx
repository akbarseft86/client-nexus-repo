import { Database, FileText, Search, Tags, UserCheck, CreditCard, Menu, ChevronDown, Building2, LayoutDashboard, AlertTriangle, Shield, Users, BarChart3, FolderInput, FileType } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useBranch } from "@/contexts/BranchContext";

export default function Navigation() {
  const navigate = useNavigate();
  const { selectedBranch, setSelectedBranch } = useBranch();

  const branches = [
    { id: "bekasi", label: "SEFT Bekasi" as const },
    { id: "jogja", label: "SEFT Jogja" as const },
    { id: "all", label: "SEFT ALL" as const },
  ];

  const isPreviewMode = selectedBranch === "SEFT ALL";

  const menuItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", hideInPreview: false },
    { to: "/ceo-dashboard", icon: BarChart3, label: "CEO Command Center", showOnlyInPreview: true },
    { to: "/", icon: Database, label: "Data SH2M", hideInPreview: false },
    { to: "/highticket", icon: FileText, label: "Data Highticket", hideInPreview: false },
    { to: "/data-staging", icon: FolderInput, label: "Data Staging", showOnlyInPreview: true },
    { to: "/cicilan", icon: CreditCard, label: "Data Cicilan", hideInPreview: true },
    { to: "/search", icon: Search, label: "Pencarian Client", hideInPreview: false },
    { to: "/source-categories", icon: Tags, label: "Kategori Source Iklan", hideInPreview: true },
    { to: "/program-standardization", icon: FileType, label: "Standarisasi Nama Program", hideInPreview: true },
    { to: "/leads-ec", icon: UserCheck, label: "Leads EC", hideInPreview: false },
    { to: "/clients", icon: Users, label: "Clients CRM", showOnlyInPreview: true },
    { to: "/data-duplikat", icon: AlertTriangle, label: "Data Duplikat", showOnlyInPreview: true },
    { to: "/data-trust", icon: Shield, label: "Data Trust", showOnlyInPreview: true },
  ];
  const visibleMenuItems = menuItems.filter(item => {
    // Hide items marked hideInPreview when in preview mode
    if (isPreviewMode && item.hideInPreview) return false;
    // Show items marked showOnlyInPreview only in preview mode
    if (!isPreviewMode && (item as any).showOnlyInPreview) return false;
    return true;
  });

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
              {visibleMenuItems.map((item) => (
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
