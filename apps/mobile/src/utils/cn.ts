/**
 * Merge Tailwind CSS classes with proper conflict resolution.
 * Use for conditional classes and overriding default styles.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
