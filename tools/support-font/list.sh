mc find emfont/zeabur/original-fonts --name "*.otf" | awk -F/ '{print $(NF-1)}' | sort -u > otf_dirs.txt
mc find emfont/zeabur/original-fonts --name "*.ttf" | awk -F/ '{print $(NF-1)}' | sort -u > ttf_dirs.txt
# 查詢只包含 otf 的資料夾，這些子資料存在的字重只會存在 otf 或 ttf 其中一種格式，都會相同
comm -23 otf_dirs.txt ttf_dirs.txt

