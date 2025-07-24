import fontforge
import sys
import json
from  _finder import ScriptFinder

Finder = ScriptFinder()
###############################3

if len(sys.argv) < 2:
    print("Argument count error! Pls Usage: fontforge -script font_unicode_report.py fontfile.ttf")
    sys.exit(1)

results = {}

for arg in sys.argv[1:]:
    font_name, font_path = arg.split("=", 1)
    try:
        font = fontforge.open(font_path)
        codepoints = [chr(g.unicode) for g in font.glyphs() if g.unicode != -1]
        class_count_pair = Finder.char_Classify(codepoints)
        results[font_name] = class_count_pair
    except Exception as e:
        results[font_name] = {"error": str(e)}

# 將結果以 JSON 格式輸出，讓 Node.js 讀緩衝區解析
print(json.dumps(results, ensure_ascii=False))