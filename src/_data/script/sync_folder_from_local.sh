
# 找到腳本自己的所在路徑
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 推算出專案根目錄
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
cd "$PROJECT_ROOT/src/_data/_generated"
for dir in */
do
	  echo "正在傳送目錄: $dir"
	  # --overwrite:覆蓋已存在檔案
	  # -- remove :移除本地有但遠端沒有的
	    mc mirror --overwrite --remove "$dir" "emfont/zeabur/original/$dir" #make sure your minio alias buket nickname is emfont/
    done