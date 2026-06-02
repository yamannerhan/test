import React from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";

// Admin dashboard placeholder for now, to enable the basic structure
export default function AdminDashboard() {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user || !isAdmin) return <Redirect to="/" />;

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6 text-destructive">Admin Paneli</h1>
        <div className="grid grid-cols-2 gap-4">
           {/* Placeholders for actual admin stats components */}
           <div className="glass-card p-4 rounded-xl">
             <div className="text-sm text-muted-foreground">Toplam Üye</div>
             <div className="text-2xl font-bold">Yükleniyor...</div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
