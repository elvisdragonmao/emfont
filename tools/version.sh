# get font version
# 進入字體目錄
cd ~/testfont/fonts || exit

for fontfile in ./**/*.ttf; do
    foldername=$(basename "$(dirname "$fontfile")")

    # 取得字體版本
    version=$(fc-query -f '%{fontversion}\n' "$fontfile" | perl -E 'printf "%.3f\n", <>/65536.0')

    # 輸出結果
    echo "$foldername - $version"
done
