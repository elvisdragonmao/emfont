-- 填充預設句子
INSERT INTO demo_sentence (sid, content, language)
SELECT
    1,
    '我個人認為義大利麵就應該拌 42 號混泥土',
    'zh-hant'
WHERE NOT EXISTS (
    SELECT 1 FROM demo_sentence WHERE sid = 1
);

INSERT INTO font_family (
    id, name, name_zh, name_en, weights, license, version, description,
    category, family, tags, repo_url, authors, format, languages, demo_content_id
) VALUES (
    'Cubic11',
    '俐方體11號',
    '俐方體11號',
    'Cubic11',
    ARRAY[400]::smallint[],
    'OFL-1.1',
    NULL,
    '俐方體11號是基於 M⁺ gothic 12r 衍生的開源繁體中文點陣字型，可用於像素風格的遊戲以及美術當中。',
    'fantasy',
    'M⁺ gothic 12r',
    ARRAY['像素']::text[],
    'https://github.com/ACh-K/Cubic-11',
    ARRAY['ACh']::text[],
    'ttf',
    '{
      "Common":410,
      "Latin":195,
      "Inherited":10,
      "Greek":48,
      "Cyrillic":66,
      "Han":9237,
      "Hiragana":86,
      "Katakana":159,
      "Bopomofo":37,
      "private_area":1
    }'::json,
    1
)
ON CONFLICT (id) DO NOTHING;
