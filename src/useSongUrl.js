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
  const [error, setError] = useState(initial.error);

  useEffect(() => {
    // replaceState doesn't fire hashchange and adds no history entries.
    history.replaceState(null, "", "#" + encodeSong(song));
  }, [song]);

  useEffect(() => {
    const onHashChange = () => {
      const loaded = loadSongFromHash(location.hash);
      setSong(loaded.song);
      setError(loaded.error);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return [song, setSong, error];
}
