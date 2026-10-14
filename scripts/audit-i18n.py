#!/usr/bin/env python3
"""Rà soát chuỗi giao diện bị cứng tiếng Việt và độ lệch giữa vi.json / en.json.
Chạy trong thư mục gốc của repo:  python3 audit-i18n.py
Tùy chọn:  python3 audit-i18n.py --all   (in cả các dòng chỉ nằm trong chú thích)
"""
import json, os, re, sys

VN = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
                r"ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]")
SHOW_ALL = "--all" in sys.argv
SRC = "src"
LOC = os.path.join(SRC, "locales")

def strip_comments(text):
    """Bỏ chú thích /* */ và // (xấp xỉ, đủ dùng để lọc nhiễu)."""
    text = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    out = []
    for line in text.split("\n"):
        m = re.search(r"(?<!:)//", line)
        if m and line[:m.start()].count("'") % 2 == 0 and line[:m.start()].count('"') % 2 == 0 and line[:m.start()].count("`") % 2 == 0:
            line = line[:m.start()]
        out.append(line)
    return "\n".join(out)

print("=" * 70)
print("1) CHUỖI TIẾNG VIỆT CỨNG TRONG MÃ (không tính chú thích)")
print("=" * 70)
total = 0
per_file = []
for root, _, files in os.walk(SRC):
    if root.startswith(LOC):
        continue
    for f in files:
        if not f.endswith((".ts", ".tsx")):
            continue
        p = os.path.join(root, f)
        raw = open(p, encoding="utf-8").read()
        body = raw if SHOW_ALL else strip_comments(raw)
        hits = [(i + 1, l.strip()) for i, l in enumerate(body.split("\n")) if VN.search(l)]
        if hits:
            per_file.append((p, hits))
            total += len(hits)
per_file.sort(key=lambda x: -len(x[1]))
for p, hits in per_file:
    print(f"\n{p}  ({len(hits)} dòng)")
    for ln, text in hits[:6]:
        print(f"  {ln}: {text[:130]}")
    if len(hits) > 6:
        print(f"  ... và {len(hits) - 6} dòng nữa")
print(f"\nTổng: {total} dòng ở {len(per_file)} file")

print("\n" + "=" * 70)
print("2) KHÓA i18n: vi.json so với en.json")
print("=" * 70)
def flat(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flat(v, key + "."))
        else:
            out[key] = v
    return out
vi = flat(json.load(open(os.path.join(LOC, "vi.json"), encoding="utf-8")))
en = flat(json.load(open(os.path.join(LOC, "en.json"), encoding="utf-8")))
miss_en = sorted(set(vi) - set(en))
miss_vi = sorted(set(en) - set(vi))
vn_in_en = sorted(k for k, v in en.items() if isinstance(v, str) and VN.search(v))
same = sorted(k for k in set(vi) & set(en)
              if isinstance(en[k], str) and en[k] == vi[k] and len(en[k]) > 12 and re.search(r"[A-Za-zÀ-ỹ]{4}", en[k]))
print(f"Khóa có trong vi nhưng thiếu trong en: {len(miss_en)}")
for k in miss_en[:25]: print("  -", k)
print(f"Khóa có trong en nhưng thiếu trong vi: {len(miss_vi)}")
for k in miss_vi[:15]: print("  -", k)
print(f"Giá trị en vẫn chứa tiếng Việt (có dấu): {len(vn_in_en)}")
for k in vn_in_en[:40]: print(f"  - {k}: {str(en[k])[:90]}")
print(f"Giá trị en giống hệt vi (nghi chưa dịch): {len(same)}")
for k in same[:25]: print(f"  - {k}: {str(en[k])[:80]}")

print("\n" + "=" * 70)
print("3) KHÓA được gọi bằng t('...') nhưng không có trong locale")
print("=" * 70)
used = {}
pat = re.compile(r"\bt\(\s*['\"]([A-Za-z0-9_.\-]+)['\"]")
for root, _, files in os.walk(SRC):
    if root.startswith(LOC): continue
    for f in files:
        if f.endswith((".ts", ".tsx")):
            p = os.path.join(root, f)
            for m in pat.finditer(open(p, encoding="utf-8").read()):
                used.setdefault(m.group(1), p)
no_en = sorted(k for k in used if k not in en)
no_vi = sorted(k for k in used if k not in vi)
print(f"Khóa dùng trong mã: {len(used)}")
print(f"  thiếu trong en.json: {len(no_en)}")
for k in no_en[:25]: print(f"    - {k}   ({used[k]})")
print(f"  thiếu trong vi.json: {len(no_vi)}")
for k in no_vi[:25]: print(f"    - {k}   ({used[k]})")
