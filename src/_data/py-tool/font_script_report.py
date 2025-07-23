import fontforge
import sys
from  _finder import ScriptFinder

Finder = ScriptFinder()
###############################3

if len(sys.argv) < 2:
    print("Argument count error! Pls Usage: fontforge -script font_unicode_report.py fontfile.ttf")
    sys.exit(1)

font_path = sys.argv[1]
font = fontforge.open(font_path)

# 收集所有有效碼位
codepoints = sorted([chr(g.unicode) for g in font.glyphs() if g.unicode != -1])
class_count_pair = Finder.char_Classify(codepoints)

for (name,count) in class_count_pair.items():
    print(f"{name:20s}: {count:5d}")
