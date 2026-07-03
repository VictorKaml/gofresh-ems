// 🥩 DEPARTMENTS GRAPHIC & THEMING CONFIGURATION DICTIONARY
export const WORKSPACE_DEPARTMENTS_CONFIG = {
  "BEEF": {
    label: "Beef Production",
    localJpg: "/assets/departments/beef.webp",
    borderColor: "hover:border-red-500",
    activeBg: "bg-red-50 border-red-500 text-red-700",
    badgeTheme: "bg-red-100 text-red-800"
  },
  "CHICKEN": {
    label: "Poultry Processing",
    localJpg: "/assets/departments/beef.webp",
    borderColor: "hover:border-amber-500",
    activeBg: "bg-amber-50 border-amber-500 text-amber-700",
    badgeTheme: "bg-amber-100 text-amber-800"
  },
  "FISH": {
    label: "Seafood Packaging",
    localJpg: "/assets/departments/beef.webp",
    borderColor: "hover:border-blue-500",
    activeBg: "bg-blue-50 border-blue-500 text-blue-700",
    badgeTheme: "bg-blue-100 text-blue-800"
  },
  "PORK": {
    label: "Pork Processing",
    localJpg: "/assets/departments/pork.jpg",
    borderColor: "hover:border-pink-500",
    activeBg: "bg-pink-50 border-pink-500 text-pink-700",
    badgeTheme: "bg-pink-100 text-pink-800"
  },
  "COLD CUTS": {
    label: "Deli & Cold Cuts",
    localJpg: "/assets/departments/cold_cuts.jpg",
    borderColor: "hover:border-orange-500",
    activeBg: "bg-orange-50 border-orange-500 text-orange-700",
    badgeTheme: "bg-orange-100 text-orange-800"
  }
} as const;