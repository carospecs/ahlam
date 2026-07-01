"use client";

// Persistent scan session — a module-level store so an in-progress AI scan (and
// its results) survive navigating away from "Add vehicle" and back. The AddVehicle
// view unmounts when you switch sections, which used to kill the scan and lose the
// results; keeping the session here (outside the React tree) means the scan keeps
// running in the background and the results are still there when you return. The
// session is cleared explicitly on post / save-draft / cancel.

import { useSyncExternalStore } from "react";

export interface ScanVehicleInfo {
  label: string; sub: string; make?: string; model?: string; year?: string; body?: string;
  trim?: string | null; engine?: string | null; drivetrain?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vinInfo?: any | null; // full VIN decode (VinInfo); kept loose to avoid a circular import
}

export interface ScanSession {
  mode: null | "ai" | "manualCar" | "manualPart";
  phase: string;                 // "upload" | "analyzing" | "results" | "error"
  // Complex shapes (UploadedPhoto[], AIPart[]) live in AddVehicle; kept loose here
  // to avoid a circular import. AddVehicle casts them back to their real types.
  photos: any[];                 // eslint-disable-line @typescript-eslint/no-explicit-any
  parts: any[];                  // eslint-disable-line @typescript-eslint/no-explicit-any
  vehicle: ScanVehicleInfo | null;
  photoColors: string[];         // body color each photo reported — for the same-vehicle QA check
  mileage: string | null;
  vin: string;
  vinStatus: "idle" | "checking" | "confirmed" | "bad";
  suggestedCarPrice: number | null;
  carPrice: string;
  mainPhoto: string | null;
  error: string | null;
  sellMode: string;
  vehicleTrim: string;
  vehicleColor: string;
  vehicleTitle: string;
  vehicleDesc: string;
  stockNumber: string;
}

function makeDefaults(): ScanSession {
  return {
    mode: null, phase: "upload", photos: [], parts: [], vehicle: null, photoColors: [],
    mileage: null, vin: "", vinStatus: "idle", suggestedCarPrice: null,
    carPrice: "", mainPhoto: null, error: null, sellMode: "parts",
    vehicleTrim: "", vehicleColor: "", vehicleTitle: "", vehicleDesc: "", stockNumber: "",
  };
}

let session: ScanSession = makeDefaults();
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

// Run token: invalidates an in-flight scan when the session is reset (cancelled)
// or a new scan starts, so a stale background scan can't resurrect a cleared
// session by writing its results in late.
let runToken = 0;
export function beginScanRun(): number { return ++runToken; }
export function isScanRun(token: number): boolean { return token === runToken; }

export function getScanSession(): ScanSession { return session; }

export function setScanSession(patch: Partial<ScanSession>): void {
  session = { ...session, ...patch };
  emit();
}

export function resetScanSession(): void {
  runToken++;                 // invalidate any in-flight scan
  session = makeDefaults();
  emit();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useScanSession(): ScanSession {
  return useSyncExternalStore(subscribe, getScanSession, getScanSession);
}
