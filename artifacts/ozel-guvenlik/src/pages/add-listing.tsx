import React, { useEffect, useState } from "react";
import { useCreateListing } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, Infinity } from "lucide-react";

const listingSchema = z.object({
  title: z.string().min(5, "Başlık en az 5 karakter olmalıdır."),
  company: z.string().optional(),
  city: z.string().min(2, "Şehir zorunludur."),
  workType: z.string().min(1, "Çalışma şekli seçiniz."),
  salary: z.string().optional(),
  description: z.string().min(20, "Açıklama en az 20 karakter olmalıdır."),
  requirements: z.string().optional(),
  applyUrl: z.string().url("Geçerli bir başvuru linki (URL) girin.").optional().or(z.literal('')),
  companyLogoUrl: z.string().optional(),
});

type ListingFormValues = z.infer<typeof listingSchema>;

export default function AddListing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateListing();
  const { user } = useAuth();
  const [isTimed, setIsTimed] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: "", company: "", city: "", workType: "", salary: "", description: "", requirements: "", applyUrl: ""
    },
  });

  useEffect(() => {
    if (!user) setLocation("/giris");
  }, [user, setLocation]);

  if (!user) return null;

  const onSubmit = async (values: ListingFormValues) => {
    try {
      const payload: Record<string, unknown> = {
        ...values,
        company: values.company?.trim() || "Belirtilmedi",
        salary: values.salary || null,
        requirements: values.requirements || null,
        applyUrl: values.applyUrl || null,
        companyLogoUrl: values.companyLogoUrl || null,
      };
      if (isTimed && expiresAt) {
        payload.expiresAt = new Date(expiresAt).toISOString();
      }
      await createMutation.mutateAsync({ data: payload as any });
      toast({ title: "İlan başarıyla eklendi", description: "Admin onayından sonra yayına alınacaktır." });
      setLocation("/ilanlar");
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error?.message || "İlan eklenirken bir hata oluştu.",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-5">
        <h1 className="text-xl font-bold">İlan Ekle</h1>
        <div className="glass-card rounded-2xl p-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İlan Başlığı</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn: Silahlı Özel Güvenlik" className="glass-card border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şirket Adı</FormLabel>
                      <FormControl>
                        <Input placeholder="Şirket A.Ş." className="glass-card border-white/10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şehir</FormLabel>
                      <FormControl>
                        <Input placeholder="İstanbul" className="glass-card border-white/10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="workType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Çalışma Şekli</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="glass-card border-white/10">
                            <SelectValue placeholder="Seçiniz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Tam Zamanlı">Tam Zamanlı</SelectItem>
                          <SelectItem value="Yarı Zamanlı">Yarı Zamanlı</SelectItem>
                          <SelectItem value="Vardiyalı">Vardiyalı</SelectItem>
                          <SelectItem value="Proje Bazlı">Proje Bazlı</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maaş (Opsiyonel)</FormLabel>
                      <FormControl>
                        <Input placeholder="25.000 TL" className="glass-card border-white/10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">İlan Süresi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTimed(false)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isTimed ? "border-primary bg-primary/20 text-primary-foreground" : "border-white/10 text-muted-foreground hover:border-white/20"}`}
                  >
                    <Infinity className="w-4 h-4" />
                    Süresiz
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTimed(true)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${isTimed ? "border-accent bg-accent/20 text-accent" : "border-white/10 text-muted-foreground hover:border-white/20"}`}
                  >
                    <Clock className="w-4 h-4" />
                    Süreli
                  </button>
                </div>
                {isTimed && (
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Bitiş Tarihi
                    </label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={e => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full glass-card border border-white/10 rounded-xl px-3 py-2 text-sm bg-transparent text-foreground"
                    />
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="applyUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Başvuru Linki (Opsiyonel)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." className="glass-card border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İş Tanımı</FormLabel>
                    <FormControl>
                      <Textarea placeholder="İş detaylarını buraya yazın..." className="glass-card border-white/10 min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aranan Nitelikler (Opsiyonel)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Adaylarda aranan özellikler..." className="glass-card border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyLogoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İlan Görseli (URL, Opsiyonel)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://resim.com/foto.jpg" className="glass-card border-white/10" {...field} />
                    </FormControl>
                    <p className="text-[10px] text-muted-foreground mt-1">Boş bırakırsanız ilan başlığına göre otomatik resim atanır.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full bg-gradient-to-r from-primary to-secondary text-white shadow-lg mt-2"
              >
                {createMutation.isPending ? "Ekleniyor..." : "İlanı Gönder"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </Layout>
  );
}
