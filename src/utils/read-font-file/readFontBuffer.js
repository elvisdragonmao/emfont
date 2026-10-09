//讀字型檔案，放入緩衝區
import path from "path";
import * as fontkit from "fontkit";
import fs from "fs";
const __dirname = import.meta.dirname;
const __Font_storge_path_base = path.join(__dirname, "../../", "_data", "original-fonts"); //projectroot/src/_data/original-fonts/

// A weight may span several files because one sfnt holds at most 65535 glyphs (e.g. 全字庫 TW-Kai + Ext-B + Plus).
// Primary file is `<weight>.<ext>`, extra parts are `<weight>-<n>.<ext>` with n >= 1.
const FONT_FILE_RE = /^(\d+)(?:-([1-9]\d*))?\.(ttf|otf)$/i;
const FONT_EXTENSIONS = ["ttf", "otf"];

function fontFileName(weight, part = 0, extension = "ttf") {
    return part > 0 ? `${weight}-${part}.${extension}` : `${weight}.${extension}`;
}

function parseFontFileName(fileName) {
    const match = fileName.match(FONT_FILE_RE);
    if (!match) return null;
    return {
        weight: Number(match[1]),
        part: match[2] ? Number(match[2]) : 0,
        extension: match[3].toLowerCase(),
    };
}

// Every file of a weight ordered by part index; ttf wins over otf when both exist for one part.
function listFontPartFiles(originalFontFamily, font_weight) {
    const dir = path.join(__Font_storge_path_base, originalFontFamily);
    if (!fs.existsSync(dir)) return [];
    const byPart = new Map();
    for (const name of fs.readdirSync(dir)) {
        const parsed = parseFontFileName(name);
        if (!parsed || parsed.weight !== Number(font_weight)) continue;
        const existing = byPart.get(parsed.part);
        if (existing && FONT_EXTENSIONS.indexOf(existing.type) <= FONT_EXTENSIONS.indexOf(parsed.extension)) continue;
        byPart.set(parsed.part, { part: parsed.part, type: parsed.extension, fullPath: path.join(dir, name) });
    }
    return Array.from(byPart.values()).sort((a, b) => a.part - b.part);
}

// Per-part code point sets, keyed by family/weight and invalidated when any part changes on disk.
const partCharSetCache = new Map();

function partsSignature(files) {
    return files
        .map(({ fullPath }) => {
            const stat = fs.statSync(fullPath);
            return `${fullPath}:${stat.size}:${stat.mtimeMs}`;
        })
        .join("|");
}

// Returns [] when the weight has no files or a file vanished mid-read (admin replacement in progress).
function getFontPartCharSets(originalFontFamily, font_weight) {
    try {
        const files = listFontPartFiles(originalFontFamily, font_weight);
        if (files.length === 0) return [];
        const cacheKey = `${originalFontFamily}/${font_weight}`;
        const signature = partsSignature(files);
        const cached = partCharSetCache.get(cacheKey);
        if (cached && cached.signature === signature) return cached.parts;
        const parts = files.map(file => ({
            ...file,
            codePoints: new Set(fontkit.openSync(file.fullPath).characterSet),
        }));
        partCharSetCache.set(cacheKey, { signature, parts });
        return parts;
    } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
    }
}

// Union of every char supported by all parts of a weight; null when the weight has no files.
function getSupportedChars(originalFontFamily, font_weight) {
    const parts = getFontPartCharSets(originalFontFamily, font_weight);
    if (parts.length === 0) return null;
    const seen = new Set();
    const chars = [];
    for (const { codePoints } of parts) {
        for (const cp of codePoints) {
            if (cp === 0 || seen.has(cp)) continue;
            seen.add(cp);
            chars.push(String.fromCodePoint(cp));
        }
    }
    return chars;
}

export {
    listFontPartFiles,
    getFontPartCharSets,
    getSupportedChars,
    fontFileName,
    parseFontFileName,
};
