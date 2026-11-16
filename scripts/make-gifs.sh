#!/usr/bin/env bash
# Gera os GIFs de docs/aula1/gifs/ a partir do vídeo gravado por
# e2e/capture-docs.spec.ts (CAPTURE_SET=main). Requer ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
VIDEO=test-results/capture-video/main.webm
MARKS=docs/aula1/gifs/marks.json
OUT=docs/aula1/gifs
m() { node -e "console.log(require('./$MARKS')['$1'])"; }

# gif <nome> <início> <fim> <velocidade> <largura> [fps]
# Gera também um .mp4 (bem mais leve, bom para slides).
gif() {
  local name=$1 start=$2 end=$3 speed=$4 width=$5 fps=${6:-12}
  local dur; dur=$(node -e "console.log(Math.max(0.5, $end - $start))")
  ffmpeg -loglevel error -y -ss "$start" -t "$dur" -i "$VIDEO" \
    -vf "setpts=PTS/$speed,fps=$fps,scale=$width:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
    "$OUT/$name.gif"
  ffmpeg -loglevel error -y -ss "$start" -t "$dur" -i "$VIDEO" -an \
    -vf "setpts=PTS/$speed,fps=30,scale=1440:-2" -c:v libx264 -pix_fmt yuv420p -crf 26 -movflags +faststart \
    "$OUT/$name.mp4"
  echo "$name: gif $(du -h "$OUT/$name.gif" | cut -f1) · mp4 $(du -h "$OUT/$name.mp4" | cut -f1)"
}

S=$(m send); ST=$(m streaming); T=$(m first-tool); D=$(m done); R=$(m review-click); RD=$(m review-done); E=$(m end)

gif 01-streaming      "$(node -e "console.log($S-0.3)")" "$(node -e "console.log($T+2.5)")" 1   960
gif 02-timeline-loop  "$(node -e "console.log($S-0.3)")" "$(node -e "console.log($D+3)")"   7   720 10
gif 03-review         "$(node -e "console.log($R-0.3)")" "$(node -e "console.log($RD+3)")"  2   800 10
gif 00-fluxo-completo 0 "$E" 10 640 8

# Frame legível do streaming para o print 03 (o screenshot pega tokens no meio do fade)
ffmpeg -loglevel error -y -ss "$(node -e "console.log($ST+0.45)")" -i "$VIDEO" -frames:v 1 docs/aula1/screens/03-streaming.png
echo "frame 03-streaming.png atualizado"
