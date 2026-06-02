import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Listings from "@/pages/listings";
import ListingDetail from "@/pages/listing-detail";
import Chat from "@/pages/chat";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Profile from "@/pages/profile";
import AdminDashboard from "@/pages/admin";
import AddListing from "@/pages/add-listing";
import Notifications from "@/pages/notifications";
import Favorites from "@/pages/favorites";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/ilanlar" component={Listings} />
      <Route path="/ilan/:id" component={ListingDetail} />
      <Route path="/sohbet" component={Chat} />
      <Route path="/giris" component={Login} />
      <Route path="/kayit" component={Register} />
      <Route path="/profil/:username" component={Profile} />
      <Route path="/ilan-ekle" component={AddListing} />
      <Route path="/bildirimler" component={Notifications} />
      <Route path="/favoriler" component={Favorites} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
