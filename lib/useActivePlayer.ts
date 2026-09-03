"use client";

import { useEffect, useState } from "react";

const KEY = "pickens:activePlayerId";

/** Trust-based "who's picking" selector, persisted per-browser. Not auth -- anyone can switch it. */
export function useActivePlayer() {
  const [playerId, setPlayerIdState] = useState<string | null>(null);

  useEffect(() => {
    setPlayerIdState(localStorage.getItem(KEY));
  }, []);

  function setPlayerId(id: string) {
    localStorage.setItem(KEY, id);
    setPlayerIdState(id);
  }

  return { playerId, setPlayerId };
}
