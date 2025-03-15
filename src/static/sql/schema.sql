CREATE TABLE IF NOT EXISTS font_types ( -- 收錄字型類型
    id SERIAL PRIMARY KEY,
    font_name VARCHAR(255) UNIQUE NOT NULL
);
INSERT INTO font_types VALUES (1, 'ZhuQueFangSong');
-- 創建表格
CREATE TABLE IF NOT EXISTS font_requests(
    hash_index CHAR(10) PRIMARY KEY,  -- 原始hash的前10碼
    original_hash CHAR(64) NOT NULL, -- 原始hash也會存，但通常會用hash_index查詢
    font_type_id INT NOT NULL, -- 字型id，對應到另一張表格
    weight INT, -- font weight
    creat_dpmain VARCHAR(255) NOT NULL,
    use_count INT NOT NULL DEFAULT 0,
    FOREIGN KEY (font_type_id) REFERENCES font_types(id)
);

