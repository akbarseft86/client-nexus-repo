import { NavLink } from "@/components/NavLink";
import { Database, FileText, Search } from "lucide-react";

export default function Navigation() {
  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto">
        <div className="flex h-16 items-center space-x-8">
          <h1 className="text-xl font-bold text-foreground">CRM System</h1>
          <div className="flex space-x-1">
            <NavLink
              to="/"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            >
              <Database className="h-4 w-4" />
              Data SH2M
            </NavLink>
            <NavLink
              to="/highticket"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            >
              <FileText className="h-4 w-4" />
              Data Highticket
            </NavLink>
            <NavLink
              to="/search"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            >
              <Search className="h-4 w-4" />
              Pencarian Client
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
