-- 創建表格
-- 收錄字型
CREATE TABLE IF NOT EXISTS font_family (
    id SERIAL PRIMARY KEY,
    font_name VARCHAR(255) UNIQUE NOT NULL,
    font_name_zh VARCHAR(255) DEFAULT NULL,
    license VARCHAR(255) DEFAULT NULL,
    version VARCHAR(255),
    font_weight VARCHAR(255),
    repo_url VARCHAR(255),
    author VARCHAR(255)
);
-- 
-- INSERT INTO font_family VALUES (1, 'ZhuQueFangSong');
-- 動態字型對應表格
CREATE TABLE IF NOT EXISTS dynamic_fonts(
    hash_index CHAR(10) PRIMARY KEY,  -- 原始hash的前10碼
    font_family_id INT NOT NULL, -- 字型id，對應到另一張表格
    weight INT, -- font weight
    referer VARCHAR(255) NOT NULL,
    use_count INT NOT NULL DEFAULT 1,
    last_us TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (font_family_id) REFERENCES font_family(id)
);

CREATE TABLE IF NOT EXISTS static_fonts(
    word VARCHAR(2) PRIMARY KEY,
    pack INT NOT NULL
    -- popularity INT NOT NULL DEFAULT 0-- 熱門程度，後續作為調整字型打包的依據
)

