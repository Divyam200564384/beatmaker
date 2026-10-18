// Keeps the song in the URL hash so reloading or sharing the link restores it.
import { useEffect, useState } from "react";
import { decodeSong, encodeSong } from "./song/codec.js";
import { createDefaultSong } from "./song/model.js";

export const BAD_LINK_MESSAGE = "Couldn't read that song link, started a new one";

export function loadSongFromHash(hash) {
  const code = hash.replace(/^#/, "");
  if (!code) return { song: createDefaultSong(), error: null };
  try {
    return { song: decodeSong(code), error: null };
  } catch {
    return { song: createDefaultSong(), error: BAD_LINK_MESSAGE };
  }
}

export function useSongUrl() {
  const [initial] = useState(() => loadSongFromHash(location.hash));
  const [song, setSong] = useState(initial.song);
  // seq changes on every failed load, so the same message can be shown again.
  const [error, setError] = useState({ message: initial.error, seq: initial.error ? 1 : 0 });

  useEffect(() => {
    // replaceState doesn't fire hashchange and adds no history entries.
    history.replaceState(null, "", "#" + encodeSong(song));
  }, [song]);

  useEffect(() => {
    const onHashChange = () => {
      const loaded = loadSongFromHash(location.hash);
      setSong(loaded.song);
      setError((prev) => ({ message: loaded.error, seq: loaded.error ? prev.seq + 1 : prev.seq }));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return [song, setSong, error.message, error.seq];
}
