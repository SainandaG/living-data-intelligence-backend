import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind classes with clsx and tailwind-merge.
 * This prevents class conflicts and handles conditional merging efficiently.
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
