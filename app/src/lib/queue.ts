import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Offline submission queue. Salvage yards often have poor signal, so a captured
 * photo is queued locally and processed when connectivity returns — it never
 * fails silently. This is a minimal AsyncStorage-backed queue; swap for a more
 * robust store (e.g. expo-sqlite) as volume grows.
 */
export interface QueuedCapture {
  id: string;
  imageBase64: string;
  vin?: { make?: string; model?: string; year?: number };
  createdAt: string;
}

const KEY = "carospecs:capture-queue";

export async function enqueueCapture(
  item: Omit<QueuedCapture, "id" | "createdAt">
): Promise<QueuedCapture> {
  const queue = await getQueue();
  const entry: QueuedCapture = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  queue.push(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  return entry;
}

export async function getQueue(): Promise<QueuedCapture[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedCapture[];
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = (await getQueue()).filter((q) => q.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function queueCount(): Promise<number> {
  return (await getQueue()).length;
}
