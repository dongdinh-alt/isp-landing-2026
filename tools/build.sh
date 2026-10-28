#!/bin/sh
# Minify CSS/JS for production and stamp cache-busting versions into index.html.
# Edit the readable sources (main.css, main.js), then run:
#     sh tools/build.sh
# Needs Node (esbuild is fetched by npx on first run).
set -e
cd "$(dirname "$0")/.."
ESBUILD="npx --yes esbuild@0.25.10"

$ESBUILD assets/css/main.css      --minify --log-level=warning --outfile=assets/css/main.min.css
$ESBUILD assets/js/main.js        --minify --log-level=warning --outfile=assets/js/main.min.js

# version = first 8 chars of each file's hash, so browsers refetch only what changed
v() { shasum "$1" | cut -c1-8; }
CSS_V=$(v assets/css/main.min.css); JS_V=$(v assets/js/main.min.js)
sed -i.bak -E \
  -e "s#assets/css/main(\.min)?\.css(\?v=[^\"]*)?\"#assets/css/main.min.css?v=$CSS_V\"#" \
  -e "s#assets/js/main(\.min)?\.js(\?v=[^\"]*)?\"#assets/js/main.min.js?v=$JS_V\"#" \
  index.html
rm -f index.html.bak

for f in assets/css/main assets/js/main; do
  case $f in *css*) e=css;; *) e=js;; esac
  printf '%-28s %6s → %6s bytes\n' "$f.$e" "$(wc -c < $f.$e | tr -d ' ')" "$(wc -c < $f.min.$e | tr -d ' ')"
done
