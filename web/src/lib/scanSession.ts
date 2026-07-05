"use client";

// Persistent scan sessions — a module-level store so in-progress AI scans (and
// their results) survive navigating away from "Add vehicle" and back. The AddVehicle
// view unmounts when you switch sections, which used to kill the scan and lose the
// results; keeping the sessions here (outside the React tree) means scans keep
// running in the background and the results are still there when you return.
//
// MULTI-SLOT (scan queue): the store keys sessions by a slot id so high-volume
// yards can stack scanners — upload car #2 while car #1 is still analyzing. Slot
// "0" is the permanent primary scanner (it also owns the AI/manual mode gate);
// queue slots ("q1", "q2", …) are added and removed as cars enter and leave the
// queue. Every legacy call site keeps working: the slot argument defaults to "0".

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

export const PRIMARY_SLOT = "0";

type SlotState = { session: ScanSession; runToken: number };

const slots = new Map<string, SlotState>([[PRIMARY_SLOT, { session: makeDefaults(), runToken: 0 }]]);
let slotOrder: string[] = [PRIMARY_SLOT];
let slotSeq = 0;

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

function slotState(slot: string): SlotState {
  let st = slots.get(slot);
  if (!st) { st = { session: makeDefaults(), runToken: 0 }; slots.set(slot, st); }
  return st;
}

// Run tokens: invalidate an in-flight scan when its slot is reset (cancelled),
// removed, or a new scan starts in it, so a stale background scan can't
// resurrect a cleared session by writing its results in late.
export function beginScanRun(slot: string = PRIMARY_SLOT): number { return ++slotState(slot).runToken; }
export function isScanRun(token: number, slot: string = PRIMARY_SLOT): boolean { return token === slotState(slot).runToken; }

export function getScanSession(slot: string = PRIMARY_SLOT): ScanSession { return slotState(slot).session; }

export function setScanSession(patch: Partial<ScanSession>, slot: string = PRIMARY_SLOT): void {
  const st = slotState(slot);
  st.session = { ...st.session, ...patch };
  emit();
}

/** Full reset: cancel every in-flight scan, drop the queue, fresh primary slot. */
export function resetScanSession(): void {
  for (const st of slots.values()) st.runToken++; // invalidate all in-flight scans
  slots.clear();
  slots.set(PRIMARY_SLOT, { session: makeDefaults(), runToken: 0 });
  slotOrder = [PRIMARY_SLOT];
  emit();
}

/** Add a scanner to the queue (already in AI mode, ready for photos). */
export function addScanSlot(): string {
  const key = `q${++slotSeq}`;
  slots.set(key, { session: { ...makeDefaults(), mode: "ai" }, runToken: 0 });
  slotOrder = [...slotOrder, key];
  emit();
  return key;
}

/** Remove a queue slot (cancels its in-flight scan). The primary slot can't be
 * removed — it resets to a fresh AI scanner instead. */
export function removeScanSlot(slot: string): void {
  if (slot === PRIMARY_SLOT) {
    const st = slotState(slot);
    st.runToken++;
    st.session = { ...makeDefaults(), mode: "ai" };
  } else {
    const st = slots.get(slot);
    if (st) st.runToken++;
    slots.delete(slot);
    slotOrder = slotOrder.filter((k) => k !== slot);
  }
  emit();
}

/** A slot's car was saved/posted: queue slots leave the queue; the primary slot
 * resets (staying in AI mode if a queue is still running, else back to the
 * mode picker). */
export function finishScanSlot(slot: string): void {
  if (slot !== PRIMARY_SLOT) { removeScanSlot(slot); return; }
  if (slotOrder.length > 1) removeScanSlot(PRIMARY_SLOT); // fresh AI scanner, queue stays
  else resetScanSession();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// Stable fallback so a just-removed slot's final render doesn't loop.
const EMPTY_SESSION: ScanSession = makeDefaults();

export function useScanSession(slot: string = PRIMARY_SLOT): ScanSession {
  const get = () => slots.get(slot)?.session ?? EMPTY_SESSION;
  return useSyncExternalStore(subscribe, get, get);
}

/** The ordered list of scanner slots (primary first, then the queue). */
export function useScanSlots(): string[] {
  const get = () => slotOrder;
  return useSyncExternalStore(subscribe, get, get);
}

/** Every slot's phase as one string — a cheap value-stable snapshot for effects
 * that should fire when any scan starts/finishes (e.g. the credits ticker). */
export function useScanPhases(): string {
  const get = () => slotOrder.map((k) => `${k}:${slots.get(k)?.session.phase ?? ""}`).join("|");
  return useSyncExternalStore(subscribe, get, get);
}
