import pickle,os
import bisect
# credit: https://robvanderg.github.io/scripts/scripts/
class ScriptFinder():
    def __init__(self):
        """
        Class that loads the scripts definitions from Unicode; it automatically
        downloads them to a text file, and loads them to a list, where every index
        of valid unicode is represented by a string that contains the script name.
        Note that this is not very RAM efficient, but very fast for lookups.
        """
        this_py_dir = os.path.dirname(os.path.abspath(__file__))  # 找到當前 Python 檔案的資料夾
        static_dir = os.path.join(this_py_dir, "static")
        os.makedirs(static_dir, exist_ok=True)

        cache_path = os.path.join(this_py_dir, "static", "Scripts.pkl")
        text_path = os.path.join(static_dir, "Scripts.txt")
        if os.path.isfile(cache_path):
            with open(cache_path, "rb") as f:
                self.ranges, self.starts = pickle.load(f)
        else:
            self.ranges = []
            if not os.path.isfile(text_path):
                os.system(f'wget https://www.unicode.org/Public/16.0.0/ucd/Scripts.txt --no-check-certificate -O {this_py_dir}')
            for line in open(text_path, encoding='utf-8'):
                if line.startswith('#') or ';' not in line:
                    continue
                # 對 scripts.txt 做一點字串處理，拿出 code block 的定義
                tok = line.split(';')
                char_range_hex = tok[0].strip().split('..')
                script_name = tok[1].strip().split()[0]
                if len(char_range_hex) == 1:
                    start = end = int(char_range_hex[0], 16)
                else:
                    start = int(char_range_hex[0], 16)
                    end = int(char_range_hex[1], 16)
                # Note that we include the first and the last character of the
                # range in the indices, so the first range for Latin is 65-90
                # for example, character 65 (A) and 90 (Z) are both included in
                # the Latin set.  
            # 建立一個節點
            self.ranges.append((start, end, script_name))
            # 排序節點
            self.ranges.sort(key=lambda x: x[0])
            # 紀錄每個節點的開始位置
            self.starts = [start for start, _, _ in self.ranges]
            with open(cache_path, "wb") as f:
                pickle.dump((self.ranges, self.starts), f)
    def find_char(self, char):
        """
        Return the script of a single character, if a string
        is passed, it returns the script of the first character.

        Parameters
        ----------
        char: char
            The character to find the script of, if this is a string
            the first character is used.
    
        Returns
        -------
        script: str
            The name of the script, or None if not found
        """
        idx = bisect.bisect_right(self.starts, codepoint) - 1
        if idx >= 0:
            start, end, script = self.ranges[idx]
            if start <= codepoint <= end:
                return script
        return None


    def char_Classify(self, text):
        """
        Parameters
        ----------
        text: str
            The input text

        Returns
        -------
        script: dict
            出現的文字所屬分類和字數量

        """
        classes = {}
        for char in text:
            cat = self.find_char(char)
            if cat == None:
                continue
            if cat not in classes:
                classes[cat] = 0
            classes[cat] += 1
        if len(classes) == 0:
            return None
        return classes