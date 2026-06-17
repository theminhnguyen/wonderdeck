/* ===================================================================
   layouts.js — Folien-Layout-Vorlagen für "+ Folie".
   Jede Vorlage liefert style, bg und vordefinierte Text-Blöcke
   (Bilder fügst du danach per Drag-and-drop hinzu).
   =================================================================== */
import { createText } from "./state.js";

const T = (role, text, x, y, w, align = "left") => Object.assign(createText(role), { text, x, y, w, align });

export const LAYOUTS = [
  {
    key: "hero", name: "Hero · Titel links", style: "wonder", bg: "#0e1320",
    texts: () => [T("kicker", "KAPITEL", 8, 26, 50), T("title", "Deine Überschrift", 8, 36, 64), T("subtitle", "Ein kurzer, beschreibender Untertitel.", 8, 70, 42)],
  },
  {
    key: "centered", name: "Titel zentriert", style: "snap", bg: "#10141c",
    texts: () => [T("title", "Deine Überschrift", 20, 40, 60, "center"), T("subtitle", "Untertitel", 20, 60, 60, "center")],
  },
  {
    key: "chapter", name: "Kapitel-Trenner", style: "snap", bg: "#141019",
    texts: () => [T("kicker", "KAPITEL 01", 8, 30, 50), T("title", "Thema der\nSektion", 8, 40, 64)],
  },
  {
    key: "statement", name: "Aussage / Zitat", style: "snap", bg: "#0d1116",
    texts: () => [T("title", "Eine starke\nAussage.", 16, 36, 68, "center")],
  },
  {
    key: "split", name: "Titel + Text", style: "snap", bg: "#101820",
    texts: () => [T("title", "Überschrift", 8, 28, 52), T("body", "Dein Fließtext beschreibt die Folie\nin ein, zwei kurzen Sätzen.", 8, 64, 46)],
  },
  {
    key: "number", name: "Große Zahl", style: "snap", bg: "#120f1c",
    texts: () => [T("kicker", "KENNZAHL", 8, 28, 50), T("title", "100 %", 8, 36, 60), T("body", "Worauf sich die Zahl bezieht.", 8, 66, 44)],
  },
  {
    key: "right", name: "Titel rechts", style: "snap", bg: "#0c1622",
    texts: () => [T("kicker", "ABSCHNITT", 50, 24, 44, "right"), T("title", "Überschrift\nrechts", 40, 32, 54, "right"), T("body", "Text rechtsbündig — ideal mit Motiv links.", 48, 74, 46, "right")],
  },
  {
    key: "blank", name: "Leer", style: "snap", bg: "#0a0d12",
    texts: () => [],
  },
];
