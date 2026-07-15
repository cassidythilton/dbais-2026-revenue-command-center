#!/bin/bash
set -e
cd "$(dirname "$0")"
SRC=src
MEDIA="../media"
SEG=segments
mkdir -p "$SEG"

enc=(-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -an)

# ---- content segment: clean footage, no text overlay ----
seg() {
  local out=$1 f=$2 ss=$3 to=$4 D=$5
  local win ratio
  win=$(python3 -c "print($to-$ss)")
  ratio=$(python3 -c "print($D/$win)")
  echo ">> $out  win=${win}s ratio=${ratio} target=${D}s"
  ffmpeg -y -loglevel error \
    -ss "$ss" -to "$to" -i "$SRC/$f" \
    -filter_complex "\
[0:v]setpts=PTS*${ratio},fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,format=yuv420p[v]" \
    -map "[v]" -t "$D" "${enc[@]}" "$SEG/$out"
}

# ---- card from a slide still with a gentle zoom ----
card() {
  local out=$1 png=$2 D=$3 zdir=$4   # zdir: in|out
  local frames
  frames=$(python3 -c "print(int($D*30))")
  local zexpr
  if [ "$zdir" = "out" ]; then
    zexpr="z='if(eq(on,0),1.05,max(zoom-0.00045,1.0))'"
  else
    zexpr="z='min(zoom+0.00045,1.05)'"
  fi
  echo ">> card $out  ${D}s ($frames f) zoom=$zdir  <= $png"
  ffmpeg -y -loglevel error -loop 1 -t "$D" -i "$png" \
    -filter_complex "[0:v]scale=3840:2160,zoompan=${zexpr}:d=${frames}:s=1920x1080:fps=30,setsar=1,format=yuv420p[v]" \
    -map "[v]" -t "$D" "${enc[@]}" "$SEG/$out"
}

card 0_intro.mp4  "$MEDIA/Slide 1 - Cover.png"  3.0 in
seg  1_predict.mp4 dais_demo_vignette_01_final.mp4  3.5  14.5 3.5
seg  2_explain.mp4 dais_demo_vignette_04_final.mp4  58   82   3.7
seg  3_score.mp4   dais_demo_vignette_05_final.mp4  58   80   3.5
seg  4_agent.mp4   dais_demo_vignette_06_final.mp4  182  205  4.2
seg  5_approve.mp4 dais_demo_vignette_06_final.mp4  252  276  4.3
seg  6_govern.mp4  dais_demo_vignette_07_final.mp4  52   80   3.5
seg  7_prove.mp4   dais_demo_vignette_03_final.mp4  27   41   3.2
card 8_outro.mp4  "$MEDIA/Slide 8 - Integrate → Generate → Explain → Act.png"  3.5 out

echo "=== segments built ==="
ls -la "$SEG"
