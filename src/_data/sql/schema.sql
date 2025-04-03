-- 創建表格

-- 收錄字型
CREATE TABLE IF NOT EXISTS font_family (
    id TEXT PRIMARY KEY, -- 無空格英文簡寫
    name TEXT UNIQUE NOT NULL,-- 通用名稱（英文）
    name_zh TEXT DEFAULT NULL,-- 中文名稱（繁體中文）
    weights SMALLINT[] NOT NULL,
    license TEXT DEFAULT NULL,
    version TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    category TEXT DEFAULT NULL,
    family TEXT DEFAULT NULL,
    tags TEXT[] DEFAULT ARRAY['normal'],
    repo_url TEXT DEFAULT NULL,
    author TEXT DEFAULT NULL,
    CONSTRAINT valid_category CHECK (category IN ('serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'))
);
delete from dynamic_fonts;
-- 動態字型對應表格
CREATE TABLE IF NOT EXISTS dynamic_fonts(
    id SERIAL PRIMARY KEY, -- 聯合主鍵基本上需要有每一個屬性，那還不如直接生成一個 ID，正好也是 R2 File Name
    family_id text NOT NULL, -- 字型id，對應到另一張表格
    weight SMALLINT, -- font weight
    use_count INT NOT NULL DEFAULT 1,
    last_use TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- text TEXT NOT NULL,這應該放在流水紀錄裡面
    hash CHAR(10) NOT NULL,
    FOREIGN KEY (family_id) REFERENCES font_family(id)
);

-- 文字對應表格 (每周更新一次)
CREATE TABLE IF NOT EXISTS static_fonts(
    char VARCHAR(2) PRIMARY KEY,
    pack SMALLINT NOT NULL,
    use_count INT NOT NULL DEFAULT 0
);

-- 流水紀錄
CREATE TABLE IF NOT EXISTS usage_log (
    id SERIAL PRIMARY KEY,
    family_id text NOT NULL,
    weight SMALLINT DEFAULT 400,
    referer TEXT,
    text TEXT NOT NULL,
    min BOOLEAN DEFAULT FALSE,
    request_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES font_family(id)
);

-- -- 字型使用總統計 (每周統計一次)
-- CREATE TABLE IF NOT EXISTS usage_summary (
--     char VARCHAR(2) PRIMARY KEY,
    
--     FOREIGN KEY (char) REFERENCES static_fonts(char)
-- );


