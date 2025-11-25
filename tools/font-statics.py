#!/usr/bin/env python3
# fontforge --script font-statics.py ../original-fonts/
import fontforge
import sys
import unicodedata
from collections import defaultdict

if len(sys.argv) < 2:
    print("Usage: fontforge -script font_unicode_report.py fontfile.ttf")
    sys.exit(1)

font_path = sys.argv[1]
font = fontforge.open(font_path)

# 收集所有有效碼位
codepoints = sorted([g.unicode for g in font.glyphs() if g.unicode != -1])

# 定義 Unicode 區塊
blocks = {
    "Basic Latin": (0x0020, 0x007E), # 不可視字元不算在裡面，rela range is 0000–007F
    "Latin extend": (0x0080, 0x24F), # include Latin-1 Supplement,Latin Extended-A and Latin Extended-B
    "IPA Extensopms": (0x250,0x02AF),# 國際音標
    "CJK Symbols and Punctuation": (0x3000, 0x303F), # 中日韓符號標點
    "Hiragana": (0x3040, 0x309F), # 日文平假名
    "Katakana": (0x30A0, 0x30FF), # 日文片假名
    "Bopomofo": (0x3105, 0x312F), #注音|準確來說是 3100–312F，但前五個沒有被定義
    "enclosed CJK letters":(0x3200,0x32FF), # 帶圈中日韓文字
    "Enclosed Alphanumerics":(0x2460,0x24FF), #帶圈字母
    "CJK unified ideographs extension":(0x3400,0x4DBF),# 中日韓表意文字擴展區
    "YiJing":(0x4DC0,0x4DFF),
    "CJK Unified Ideographs": (0x4E00, 0x9FFF), # 中日韓統一表意文字
    "CJK Compatibility Ideographs": (0xF900, 0xFAFF),
    "Hangul Syllables": (0xAC00, 0xD7AF), # 朝顯字母
    "Private Use Area (PUA)": (0xE000, 0xF8FF), # 私用區
    "supplementary Private Use": (0xF0000, 0x10FFFD), # 保留私人用區，包括 F0000~0xFFFD 和 0x100000~0x10FFFD ，兩區段相隔不遠，中間字型無特殊用途，算在一起
    "Halfwidth and Fullwidth":(0xFF00 , 0xFFEF),
    "Specials": (0xFFF0, 0xFFFF)
}

# 依區塊統計
block_stats = {}
block_glyphs = defaultdict(list)

for name, (start, end) in blocks.items():
    in_block = [cp for cp in codepoints if start <= cp <= end]
    total = end - start + 1
    block_stats[name] = (len(in_block), total)
    block_glyphs[name].extend(in_block)

# 未知區塊收集
others = []
for cp in codepoints:
    if not any(start <= cp <= end for start, end in blocks.values()):
        others.append(cp)

if others:
    block_stats["Other letter"] = (len(others), len(others))
    block_glyphs["Other letter"].extend(others)

# ======== 輸出報表 ========
print(f"Font: {font_path}")
print("=" * 60)
for name, (count, total) in block_stats.items():
    percent = (count / len(codepoints)) * 100
    print(f"{name:40s}: {count:5d}/{total:<6d} ({percent:5.1f}%)")
# print("\n=== 詳細清單 (每個區塊用 U+XXXX 表示) ===")
# for name, cps in block_glyphs.items():
#     if not cps:
#         continue
#     print(f"\n{name} ({len(cps)} glyphs):")
#     print(", ".join(f"U+{cp:04X}" for cp in cps))

# main end


# 找連續區段，開發用，擴充字典，把 Other 裡面太多獨立成新的分類
def find_runs(cps):
    if not cps:
        return []
    cps = sorted(set(cps))
    runs = []
    start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
        else:
            runs.append((start, prev, prev - start + 1))
            start = prev = cp
    runs.append((start, prev, prev - start + 1))
    return runs

print("\n=== 每個區塊最大的連續區段 ===")
for name, cps in block_glyphs.items():
    if not cps:
        continue
    runs = find_runs(cps)
    max_len = max(r[2] for r in runs)
    biggest = [r for r in runs if r[2] == max_len]
    for s, e, l in biggest:
        print(f"{name:40s}  U+{s:04X}–U+{e:04X}  ({l} glyphs)")