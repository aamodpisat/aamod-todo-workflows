import { getStore } from "./store";
import type { BoardData } from "./types";

export async function loadBoard(): Promise<BoardData> {
  const store = await getStore();
  return store.getBoard();
}
