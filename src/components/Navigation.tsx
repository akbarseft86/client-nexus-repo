import { NavLink } from "@/components/NavLink";
import { Database, FileText, Search, Tags, UserCheck, CreditCard, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Navigation() {
  const navigate = useNavigate();

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
          <h1 className="text-xl font-bold text-foreground">SEFT Jogja</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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
