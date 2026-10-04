#!/usr/bin/env bash
# يبني كتالوج PDF التعريفي أو يفحصه.
#
#   bash scripts/catalog.sh            # يبني catalog.pdf
#   bash scripts/catalog.sh --check    # يفشل إن كان الملف لا يطابق الموقع
#
# الكتالوج يُولَّد بـ Python لا بـ Node، فهو يحتاج بيئةReportLab وخطوط
# Noto العربية. فإن لم تتوفّر البيئة تُتخطى الخطوة برسالة، ولا يُفشل
# فحوص الموقع: الملف نصّ تسويقيّ يُرفع مع الموقع، لا شرط في بنائه.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
python="$root/.catalog-venv/bin/python"
[ -x "$python" ] || python="$(command -v python3 || true)"

if [ -z "$python" ] || ! "$python" -c "import reportlab" >/dev/null 2>&1; then
  echo "تخطّي الكتالوج: بيئة Python مع reportlab غير متوفّرة." >&2
  echo "لإعدادها: python3 -m venv .catalog-venv && \\" >&2
  echo "  .catalog-venv/bin/pip install -r scripts/requirements-catalog.txt" >&2
  exit 0
fi

exec "$python" "$root/scripts/make-catalog.py" "$@"