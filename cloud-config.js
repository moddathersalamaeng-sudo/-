/* Accounts and cloud save — fill both values from Supabase: Project Settings → API (or Data API).
   url: the Project URL, like https://abcdefghijkl.supabase.co
   key: the anon / publishable key (safe to publish: the database rules decide what each user can read and write).
   code: set to true only after the sign-in email template includes {{ .Token }} (needs custom SMTP in Supabase);
   the sign-in window then also accepts the 6-digit code, which iPhone users of the installed app need.
   gate: true opens only the tools listed in free without an account; every other tool asks for a free sign-in first.
   free: the tool keys open to everyone, e.g. ["iso9001"] (the keys are those of URLS in index.html).
   Leave url and key empty to keep the platform as it is, with everything in the browser. Never put the service_role key here. */
window.CIA_CLOUD = {
  url: "https://lafjjoqgzfvrnvgyyzgb.supabase.co",
  key: "sb_publishable_01Ki_UZn_M_cwU_GS-VcTg_ncvHBsOn",
  code: false,
  gate: true,
  free: ["iso9001"]
};
