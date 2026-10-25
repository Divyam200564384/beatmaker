#!/usr/bin/env bash
# Web encodes for the tutorial: silent H.264 at 30fps, plus a poster frame.
# Usage: film/encode.sh <round>   (reads film/out/beatmaker-<format>-<round>.mp4)
set -euo pipefail
round="$1"
here="$(cd "$(dirname "$0")" && pwd)"
dest="$here/../public/tutorial"
mkdir -p "$dest"
encode() {
  local format="$1" size="$2"
  local src="$here/out/beatmaker-$format-$round.mp4"
  ffmpeg -loglevel error -y -i "$src" -an -vf "fps=30,scale=$size:flags=lanczos" \
    -c:v libx264 -preset veryslow -crf 27 -profile:v high -pix_fmt yuv420p -movflags +faststart \
    "$dest/demo-$format.mp4"
  # Poster: the call to action, so a paused or loading video still says what to do.
  ffmpeg -loglevel error -y -ss 23.7 -i "$src" -frames:v 1 -vf "scale=$size:flags=lanczos" -q:v 4 \
    "$dest/demo-$format.jpg"
}
encode wide 1280:720
encode square 720:720
ls -la "$dest"
