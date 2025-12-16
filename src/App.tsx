import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BranchProvider } from "@/contexts/BranchContext";
import Navigation from "@/components/Navigation";
import Dashboard from "@/pages/Dashboard";
import SH2MData from "@/pages/SH2MData";
import HighticketData from "@/pages/HighticketData";
import CicilanData from "@/pages/CicilanData";
import SearchClient from "@/pages/SearchClient";
import SourceIklanCategories from "@/pages/SourceIklanCategories";
import LeadsEC from "@/pages/LeadsEC";
import DataDuplikat from "@/pages/DataDuplikat";
import DataTrust from "@/pages/DataTrust";
import ClientsCRM from "@/pages/ClientsCRM";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BranchProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto py-6">
              <Routes>
                <Route path="/" element={<SH2MData />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/highticket" element={<HighticketData />} />
                <Route path="/cicilan" element={<CicilanData />} />
                <Route path="/search" element={<SearchClient />} />
                <Route path="/source-categories" element={<SourceIklanCategories />} />
                <Route path="/leads-ec" element={<LeadsEC />} />
                <Route path="/data-duplikat" element={<DataDuplikat />} />
                <Route path="/data-trust" element={<DataTrust />} />
                <Route path="/clients" element={<ClientsCRM />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </BranchProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
