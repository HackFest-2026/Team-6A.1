/**
 * scripts/seed_dev_data.cjs
 *
 * Development-only seed script for local testing of PneumoScan AI.
 * Creates safe mock verified doctors, test appointments, and sample scans
 * if they do not already exist.
 *
 * Usage:
 *   node --env-file=.env scripts/seed_dev_data.cjs
 */

const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in environment");
  process.exit(1);
}

const supabase = createClient(url, key);

async function seed() {
  console.log("=== Checking development database state ===");

  // 1. Check existing doctors
  const { data: existingDoctors, error: docErr } = await supabase.from("doctors").select("*");
  if (docErr) {
    console.error("Error querying doctors:", docErr.message);
    return;
  }

  console.log(`Current verified/registered doctors in database: ${existingDoctors.length}`);

  // Safe development doctor template
  const devDoctorId = "00000000-0000-0000-0000-000000000001";
  const devUserId = "00000000-0000-0000-0000-000000000002";

  const existingDev = existingDoctors.find((d) => d.id === devDoctorId || d.registration_number === "DEV-PNEUMO-01");

  if (!existingDev) {
    console.log("Creating development-only verified doctor for local testing...");
    const { data: newDoc, error: insertDocErr } = await supabase
      .from("doctors")
      .insert({
        id: devDoctorId,
        user_id: devUserId,
        full_name: "Dr. Arvind Kulkarni",
        qualification: "MBBS, MD (Pulmonology), FCCP",
        specialization: "Senior Pulmonologist & Chest Specialist",
        experience_years: 14,
        registration_number: "DEV-PNEUMO-01",
        council: "Karnataka Medical Council (KMC)",
        clinic: "Apex Pulmonary Center & Chest Clinic",
        fee: 650,
        available_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        available_hours: "09:00 AM - 04:00 PM",
        status: "VERIFIED",
      })
      .select()
      .single();

    if (insertDocErr) {
      console.warn("Could not insert dev doctor (RLS policy may require authenticated session):", insertDocErr.message);
    } else {
      console.log("Successfully created development doctor:", newDoc.full_name);
    }
  } else {
    console.log("Development doctor already exists:", existingDev.full_name, `(${existingDev.status})`);
  }

  console.log("=== Seed check complete ===");
}

seed();
