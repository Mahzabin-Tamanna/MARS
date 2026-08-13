import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must match your GitHub repo name exactly, wrapped in slashes.
// If your repo is github.com/yourname/model-advisor, keep this as "/model-advisor/".
// If you rename the repo, update this to match, or the page will load with broken asset paths.
export default defineConfig({
  plugins: [react()],
  base: "/agent-advisor/",
});
