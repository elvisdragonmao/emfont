
# put this script in /static/fonts. it will blenk in file name.
find . -type f -name "* *" | while read file; do
  # 替換檔案名稱中的空格為底線
  new_file="${file// /_}"
  
  # 移動檔案
  mv "$file" "$new_file"
done
# 遍歷當前目錄
for dir in */; do
    # 進入子目錄
    cd "$dir"
    echo "Processing directory: $dir"
    # 遍歷當前子目錄的所有檔案
    for file in *; do
        # echo "Processing file: $file"
        # 檢查檔案是否為檔案而非目錄
        if [[ -f "$file" ]]; then
            # 使用正則表達式提取檔案名稱並移除目錄名稱
            dir=$(echo "$dir" | sed 's/\//X-/g')
            new_name=$(echo "$file" | sed "s/$dir//g")
            # 如果新名稱與舊名稱不同，進行重命名
            if [[ "$file" != "$new_name" ]]; then
                mv "$file" "$new_name"
                echo "new_name: $new_name"
            fi
        fi
    done
    
    # 回到父目錄
    cd ..
done