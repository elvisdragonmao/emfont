# put this script in /static/fonts. it will alter file name  {normal/mono}-{number}.ttf to {number}.ttf
for dir in */; do
    # 進入子目錄
    cd "$dir"
    echo "Processing directory: $dir"
    
    # 遍歷當前子目錄的所有檔案
    for file in *; do
        # 檢查檔案是否為檔案而非目錄
        if [[ -f "$file" ]]; then
            # 進行檔案名稱處理
            # 如果檔案名稱是 normal-{number}.ttf，則修改名稱為 {number}.ttf
            new_name=$(echo "$file" | sed "s/normal-//g")
            
            if [[ "$file" != "$new_name" ]]; then
                mv "$file" "$new_name"
                echo "Renamed normal file: $new_name"
            fi
            
            # 如果檔案名稱是 mono-{number}.ttf，則創建新資料夾並移動檔案
            if [[ "$file" =~ ^mono-([0-9]+)\.ttf$ ]]; then
                # 提取數字部分
                number="${BASH_REMATCH[1]}"
                # 創建新的資料夾，名稱為原資料夾名稱 + "-mono"
                new_dir="../${dir%/}-mono"
                mkdir -p "$new_dir"
                # 移動檔案並更改檔案名稱為數字
                mv "$file" "$new_dir/$number.ttf"
                echo "Moved and renamed mono file: $number.ttf"
            fi
        fi
    done
    cd ..
done
