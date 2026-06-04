import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// İlanın "requirements" metnindeki "Cinsiyet: X" satırından cinsiyeti çeker.
// Bulunamazsa "Belirtilmemiş" döner.
export function extractGender(requirements?: string | null): string {
  if (requirements) {
    const line = requirements
      .split("\n")
      .find((l) => l.trim().toLocaleLowerCase("tr-TR").startsWith("cinsiyet:"));
    if (line) {
      const val = line.split(":").slice(1).join(":").trim();
      if (val) return val;
    }
  }
  return "Belirtilmemiş";
}
