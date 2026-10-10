import { formatPaise } from "../finance/money";
import { en, type Strings } from "./i18n.en";
import { hi } from "./i18n.hi";

export type Lang = "en" | "hi";
export const STRINGS: Record<Lang, Strings> = { en, hi };

/** Numbers shown come only from server-calculated or user-entered integer paise. */
export const money = (paise: number | undefined): string => (paise === undefined ? "—" : formatPaise(paise));
