import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFixedUrl(url?: string): string {
  if (!url) return '';
  return url.replace('https://wr-music-app.onrender.com', '');
}
export function maskPhone(value: string) {
  let clean = value.replace(/\D/g, "");
  if (!clean) return "";
  
  let prefix = "";
  if (clean.startsWith("55") && clean.length > 11) {
    prefix = "+55 ";
    clean = clean.substring(2);
  }
  
  if (clean.length <= 2) {
    return prefix + clean;
  }
  
  if (clean.length <= 6) {
    return prefix + `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  }
  
  if (clean.length <= 10) {
    return prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  
  return prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
}
