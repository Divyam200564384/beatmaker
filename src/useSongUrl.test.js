import { afterEach, describe, expect, test } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { BAD_LINK_MESSAGE, loadSongFromHash, useSongUrl } from "./useSongUrl.js";
import { decodeSong, encodeSong } from "./song/codec.js";
import { createDefaultSong, recordNote, setTempo } from "./song/model.js";

afterEach(() => history.replaceState(null, "", "/"));

describe("loadSongFromHash", () => {
  test("empty hash gives the default song and no error", () => {
    expect(loadSongFromHash("")).toEqual({ song: createDefaultSong(), error: null });
  });

  test("a valid hash decodes to its song", () => {
    const s = recordNote(createDefaultSong(), "bass", 2, 4);
    expect(loadSongFromHash("#" + encodeSong(s))).toEqual({ song: s, error: null });
  });

  test("a bad hash falls back with the exact message", () => {
    expect(loadSongFromHash("#garbage")).toEqual({ song: createDefaultSong(), error: BAD_LINK_MESSAGE });
    expect(BAD_LINK_MESSAGE).toBe("Couldn't read that song link, started a new one");
  });
});

describe("useSongUrl", () => {
  test("writes every change to the URL hash", () => {
    const { result } = renderHook(() => useSongUrl());
    act(() => result.current[1]((s) => setTempo(s, 150)));
    expect(decodeSong(location.hash.slice(1)).tempo).toBe(150);
  });

  test("loads a song pasted into the same tab", () => {
    const { result } = renderHook(() => useSongUrl());
    const other = setTempo(createDefaultSong(), 77);
    act(() => {
      history.replaceState(null, "", "#" + encodeSong(other));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current[0].tempo).toBe(77);
  });

  test("reports a bad link from the initial URL", () => {
    history.replaceState(null, "", "#nope");
    const { result } = renderHook(() => useSongUrl());
    expect(result.current[0]).toEqual(createDefaultSong());
    expect(result.current[2]).toBe(BAD_LINK_MESSAGE);
  });
});
