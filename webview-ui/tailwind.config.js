/** @type {import('tailwindcss').Config} */
// NOTE: Tailwind CSS v4 uses CSS-first configuration via @theme directive.
// Colors/theme are defined in webview-ui/src/styles/index.css — NOT here.
// This file only exists for content path configuration (legacy compatibility).
// Reference: https://tailwindcss.com/docs/theme
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
}
