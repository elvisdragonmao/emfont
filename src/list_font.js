// font-reader.mjs
// import * as fontkit from 'fontkit';
// import { writeFile } from 'fs/promises';

const fontPath = 'src/_data/original-fonts/ChenYuLuoYan/100.ttf';

// const font = await fontkit.open(fontPath);
// const supportedCodePoints = Array.from(font.characterSet);
// const characters = supportedCodePoints.map(cp => String.fromCodePoint(cp));

// console.log(`字元總數: ${characters.length}`);
// console.log('前 200 個字元：');
// console.log(characters);

// await writeFile('output.txt', characters.join(''), 'utf8');
// console.log('所有字元已寫入 output.txt');



import {Font} from 'fonteditor-core';
import fs from 'fs';

const buffer = fs.readFileSync(fontPath);

const font = Font.create(buffer, {
    type: 'ttf',
    hinting: true,
    kerning: true,
});

const fontObject = font.get();

// cmap: maps Unicode code points to glyph index
const cmap = fontObject.cmap;

const supportedChars = Object.keys(cmap)
    .map(code => String.fromCodePoint(parseInt(code)))
    .join('');

console.log(supportedChars);
const charArray = Object.keys(cmap).map(code => String.fromCodePoint(parseInt(code)));
console.log(charArray);