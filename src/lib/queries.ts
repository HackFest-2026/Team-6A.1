import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listScans } from "@/lib/scans";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export const scansQuery = queryOptions({ queryKey: ["scans"], queryFn: () => listScans(supabase) });

export const verifiedDoctorsQuery = queryOptions({
  queryKey: ["doctors", "verified"],
  queryFn: async () => {
    const { data, error } = await supabase.from("doctors").select("*").eq("status", "VERIFIED").order("full_name");
    if (error) throw error;
    return data;
  },
});

export const myAppointmentsQuery = queryOptions({
  queryKey: ["appointments", "mine"],
  queryFn: async () => {
    const id = await uid();
    const { data, error } = await supabase.from("appointments").select("*, doctors(full_name, specialization, clinic)")
      .eq("patient_id", id).order("scheduled_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const myDoctorQuery = queryOptions({
  queryKey: ["doctor", "me"],
  queryFn: async () => {
    const id = await uid();
    const { data, error } = await supabase.from("doctors").select("*").eq("user_id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await uid();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return { id, profile: data };
  },
});
