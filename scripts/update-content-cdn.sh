#!/usr/bin/env bash
# ينشر شجرة `content/` إلى فرع `gh-pages` فتخدمها شبكة توزيع
# GitHub Pages من `marwan13579.github.io` بدل نشرها مع كل صفحة —
# فينزل حجم النشر من ثلاثمئة ميغابايت إلى نحو خمسة عشر.
#
# الاستعمال: bash scripts/update-content-cdn.sh
set -euo pipefail

git fetch -q origin gh-pages
OLD_TREE="$(git rev-parse gh-pages^{tree})"

INDEX="$(mktemp)"
trap 'rm -f "$INDEX"' EXIT
export GIT_INDEX_FILE="$INDEX"

git read-tree --empty
git read-tree --prefix=content/ main:content
EMPTY_BLOB="$(git hash-object -w --stdin < /dev/null)"
git update-index --add --cacheinfo "100644,${EMPTY_BLOB},.nojekyll"

NEW_TREE="$(git write-tree)"
if [ "$NEW_TREE" = "$OLD_TREE" ]; then
  echo "المحتوى دون تغيير — لا نشر"
  exit 0
fi

COMMIT="$(git commit-tree "$NEW_TREE" -m "Update content CDN" -p gh-pages)"
git update-ref refs/heads/gh-pages "$COMMIT"
git push -q origin gh-pages
echo "نُشر المحتوى إلى gh-pages"
