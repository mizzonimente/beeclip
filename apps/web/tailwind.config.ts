import type { Config } from "tailwindcss";

/**
 * Palette e token centralizzati qui invece che sparsi nei componenti: la
 * specifica prodotto (docs/01-product-spec.md) chiede un'estetica
 * "professionale, moderna, da SaaS" — un solo punto in cui aggiustare colori
 * di brand mantiene l'interfaccia coerente man mano che crescono le pagine
 * (step J, docs/01-product-spec.md §UI/UX).
 *
 * Identità BeeClip: nero + giallo miele. "brand" è la scala giallo/oro usata
 * per CTA, accenti e stato attivo; "surface" resta un nero quasi puro (con
 * una punta di calore per accompagnare l'oro) invece del nero-blu di prima.
 * Essendo l'unico punto di definizione, il cambio di palette si propaga da
 * solo a tutti i componenti che già usano i token bg-brand-*/text-brand-*/
 * bg-surface-* senza dover toccare ogni file.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fffbea",
          100: "#fff3c4",
          200: "#fce588",
          300: "#fadb5f",
          400: "#f7c948",
          500: "#f2b705",
          600: "#d99e00",
          700: "#b07f00",
          800: "#855f00",
          900: "#5c4200",
        },
        surface: {
          DEFAULT: "#0a0a08",
          raised: "#171712",
          border: "#2e2c22",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(242,183,5,0.3), 0 8px 24px -8px rgba(242,183,5,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
