import os
# credit: https://robvanderg.github.io/scripts/scripts/
class ScriptFinder():
    def __init__(self):
        """
        Class that loads the scripts definitions from Unicode; it automatically
        downloads them to a text file, and loads them to a list, where every index
        of valid unicode is represented by a string that contains the script name.
        Note that this is not very RAM efficient, but very fast for lookups.
        """
        self.ranges = [None] * 0x110000
        if not os.path.isfile('static/Scripts.txt'):
            os.system('mkdir -p static')
            os.system('wget https://www.unicode.org/Public/16.0.0/ucd/Scripts.txt --no-check-certificate -O static/Scripts.txt')
        for line in open('static/Scripts.txt'):
            tok = line.split(';')
            # 對 scripts.txt 做一點字串處理，拿出 code block 的定義
            if line[0]!='#' and len(tok) == 2:
                char_range_hex = tok[0].strip().split('..')
                char_range_int = [int(x, 16) for x in char_range_hex]
                script_name = tok[1].strip().split()[0]
                if len(char_range_int) == 1:
                    self.ranges[char_range_int[0]] = script_name
                    # print(self.ranges[:100])
                else:
                    for ind in range(char_range_int[0], char_range_int[1]+1):
                        self.ranges[ind] = script_name
                # Note that we include the first and the last character of the
                # range in the indices, so the first range for Latin is 65-90
                # for example, character 65 (A) and 90 (Z) are both included in
                # the Latin set.  
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
        if len(char) > 1:
            char = char[0]
        char_idx = ord(char)
        if char_idx >= len(self.ranges):
            return None
        return self.ranges[char_idx]

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
