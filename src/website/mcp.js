import { db } from "../database.js";

// Font category mappings and descriptions
const CATEGORIES = {
    serif: "襯線字體 - 適合正式文檔、書籍、長文閱讀",
    "sans-serif": "無襯線字體 - 適合網頁、標題、現代設計",
    handwriting: "手寫字體 - 適合個性化、溫馨感、創意內容",
    monospace: "等寬字體 - 適合程式碼、表格、技術文檔",
    display: "展示字體 - 適合標題、海報、視覺焦點",
    other: "其他特殊字體"
};

// Mood to category/tag mapping for recommendations
const MOOD_MAPPING = {
    formal: { categories: ["serif"], tags: ["traditional", "classic"] },
    casual: { categories: ["sans-serif", "handwriting"], tags: ["modern", "friendly"] },
    elegant: { categories: ["serif"], tags: ["elegant", "refined"] },
    playful: { categories: ["handwriting", "display"], tags: ["cute", "fun", "creative"] },
    modern: { categories: ["sans-serif"], tags: ["modern", "clean", "minimal"] },
    traditional: { categories: ["serif"], tags: ["traditional", "classic"] }
};

// Helper function to analyze text and determine language
function analyzeText(text) {
    const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const japaneseCount = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const koreanCount = (text.match(/[\uac00-\ud7af]/g) || []).length;
    
    const total = chineseCount + japaneseCount + koreanCount;
    
    if (total === 0) return "latin";
    if (japaneseCount / total > 0.3) return "ja";
    if (koreanCount / total > 0.3) return "ko";
    return "zh";
}

// Search fonts with various criteria
async function searchFonts(query = "", category = null, language = null) {
    const values = [];
    let whereClause = "";
    let conditions = [];

    if (query) {
        values.push(`%${query}%`);
        conditions.push(`(
            id ILIKE $${values.length}
            OR name ILIKE $${values.length}
            OR name_zh ILIKE $${values.length}
            OR name_en ILIKE $${values.length}
            OR description ILIKE $${values.length}
            OR EXISTS (
                SELECT 1 FROM unnest(authors) AS author WHERE author ILIKE $${values.length}
            )
            OR EXISTS (
                SELECT 1 FROM unnest(tags) AS tag WHERE tag ILIKE $${values.length}
            )
        )`);
    }

    if (category) {
        values.push(category);
        conditions.push(`category = $${values.length}`);
    }

    if (conditions.length > 0) {
        whereClause = "WHERE " + conditions.join(" AND ");
    }

    const { rows } = await db.query(
        `
        SELECT id, name, name_zh, name_en, weights, category, tags, 
               authors, description, license, demo_content_id, family
        FROM font_family
        ${whereClause}
        ORDER BY id
        LIMIT 20
        `,
        values
    );

    return rows.map(row => ({
        id: row.id,
        name: row.name,
        name_zh: row.name_zh,
        name_en: row.name_en,
        weights: row.weights || [],
        category: row.category,
        tags: row.tags || [],
        authors: row.authors || [],
        description: row.description,
        license: row.license,
        family: row.family,
        demo_content_id: row.demo_content_id
    }));
}

// Recommend fonts based on use case and mood
async function recommendFont(text, purpose = "body", mood = "neutral", language = null) {
    // Analyze text if language not specified
    if (!language) {
        language = analyzeText(text);
    }

    // Build recommendation criteria based on purpose and mood
    let recommendedCategories = [];
    let recommendedTags = [];

    // Purpose-based recommendations
    if (purpose === "heading" || purpose === "title") {
        recommendedCategories = ["display", "sans-serif", "serif"];
    } else if (purpose === "body" || purpose === "paragraph") {
        recommendedCategories = ["serif", "sans-serif"];
    } else if (purpose === "logo" || purpose === "brand") {
        recommendedCategories = ["display", "handwriting"];
    } else if (purpose === "quote") {
        recommendedCategories = ["serif", "handwriting"];
    } else if (purpose === "code") {
        recommendedCategories = ["monospace"];
    }

    // Mood-based recommendations
    if (mood && MOOD_MAPPING[mood.toLowerCase()]) {
        const moodData = MOOD_MAPPING[mood.toLowerCase()];
        recommendedCategories = [...new Set([...recommendedCategories, ...moodData.categories])];
        recommendedTags = moodData.tags;
    }

    // Get fonts matching criteria
    const values = [];
    let whereConditions = [];

    if (recommendedCategories.length > 0) {
        values.push(recommendedCategories);
        whereConditions.push(`category = ANY($${values.length})`);
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

    const { rows } = await db.query(
        `
        SELECT id, name, name_zh, name_en, weights, category, tags,
               authors, description, license, demo_content_id, family
        FROM font_family
        ${whereClause}
        ORDER BY 
            CASE 
                WHEN category = 'sans-serif' THEN 1
                WHEN category = 'serif' THEN 2
                ELSE 3
            END,
            id
        LIMIT 10
        `,
        values
    );

    return rows.map(row => {
        let reason = `適合${purpose}使用`;
        if (mood) reason += `，風格${mood}`;
        if (row.category) reason += `，${CATEGORIES[row.category] || row.category}`;

        return {
            id: row.id,
            name: row.name,
            name_zh: row.name_zh,
            name_en: row.name_en,
            weights: row.weights || [],
            category: row.category,
            tags: row.tags || [],
            description: row.description,
            reason: reason,
            match_score: calculateMatchScore(row, purpose, mood, recommendedTags)
        };
    }).sort((a, b) => b.match_score - a.match_score);
}

// Calculate match score for ranking
function calculateMatchScore(font, purpose, mood, recommendedTags) {
    let score = 50; // Base score

    // Category match
    if (purpose === "heading" && font.category === "display") score += 30;
    if (purpose === "body" && (font.category === "serif" || font.category === "sans-serif")) score += 30;
    if (purpose === "code" && font.category === "monospace") score += 50;

    // Tag matches
    if (font.tags && recommendedTags) {
        const matchingTags = font.tags.filter(tag => 
            recommendedTags.some(recTag => tag.toLowerCase().includes(recTag.toLowerCase()))
        );
        score += matchingTags.length * 10;
    }

    return score;
}

// Get detailed font information
async function getFontInfo(fontId, state) {
    const { rows } = await db.query(
        `
        SELECT id, name, name_zh, name_en, weights, category, tags,
               authors, description, license, repo_url, version,
               format, demo_content_id, family
        FROM font_family
        WHERE id = $1
        `,
        [fontId]
    );

    if (rows.length === 0) {
        return null;
    }

    const font = rows[0];
    return {
        id: font.id,
        name: {
            original: font.name,
            zh: font.name_zh,
            en: font.name_en
        },
        weights: font.weights || [],
        category: font.category,
        tags: font.tags || [],
        authors: font.authors || [],
        description: font.description,
        license: font.license,
        source: font.repo_url,
        version: font.version,
        format: font.format,
        family: font.family,
        demo_content_id: font.demo_content_id,
        usage_url: `${state.baseURL}/fonts/${font.id}/`
    };
}

// Generate implementation code (CSS and/or JS)
function generateImplementation(fontId, text, weight = "400", method = "both", state) {
    const cssImplementation = `<!-- CSS 實現方式 -->
<style>
  .my-text {
    font-family: 'emfont-${fontId}';
  }
</style>
<link rel="stylesheet" href="${state.baseURL}/css/${fontId}?words=${encodeURIComponent(text)}${weight ? `&weight=${weight}` : ''}">
<p class="my-text">${text}</p>`;

    const jsImplementation = `<!-- JavaScript 實現方式 -->
<p class="emfont-${fontId}">${text}</p>
<script src="${state.baseURL}/emfont.js"></script>
<script>
  emfont.init();
</script>`;

    const bothImplementation = `<!-- 推薦使用 JavaScript 方式（更靈活） -->
${jsImplementation}

<!-- 或使用 CSS 方式（更簡單） -->
${cssImplementation}`;

    const implementations = {
        css: cssImplementation,
        js: jsImplementation,
        both: bothImplementation
    };

    return {
        font_id: fontId,
        text: text,
        weight: weight,
        method: method,
        code: implementations[method] || implementations.both,
        preview_url: `${state.baseURL}/fonts/${fontId}/`,
        documentation_url: `${state.baseURL}/docs`
    };
}

// Register MCP routes
export const registerMcpApi = async (app, state) => {
    // MCP configuration endpoint
    app.get("/mcp", async (req, res) => {
        const mcpConfig = {
            version: "1.0",
            name: "emfont",
            description: "emfont MCP server - Find and apply suitable CJK fonts for your text",
            capabilities: {
                tools: true,
                resources: true
            },
            endpoints: {
                search: `${state.baseURL}/mcp/search`,
                recommend: `${state.baseURL}/mcp/recommend`,
                info: `${state.baseURL}/mcp/info/:font_id`,
                implement: `${state.baseURL}/mcp/implement`,
                categories: `${state.baseURL}/mcp/categories`
            }
        };
        res.send(mcpConfig);
    });

    // Search fonts
    app.get("/mcp/search", async (req, res) => {
        try {
            const query = req.query.q || req.query.query || "";
            const category = req.query.category || null;
            const language = req.query.language || null;

            const fonts = await searchFonts(query, category, language);
            
            res.send({
                status: "success",
                query: query,
                filters: { category, language },
                count: fonts.length,
                fonts: fonts
            });
        } catch (err) {
            console.error("MCP search error:", err);
            res.status(500).send({
                status: "error",
                message: "Failed to search fonts",
                error: err.message
            });
        }
    });

    // Recommend fonts
    app.post("/mcp/recommend", async (req, res) => {
        try {
            const { text, purpose, mood, language } = req.body;

            if (!text) {
                return res.status(400).send({
                    status: "error",
                    message: "Text parameter is required"
                });
            }

            const recommendations = await recommendFont(text, purpose, mood, language);

            res.send({
                status: "success",
                text: text,
                criteria: { purpose, mood, language },
                count: recommendations.length,
                recommendations: recommendations
            });
        } catch (err) {
            console.error("MCP recommend error:", err);
            res.status(500).send({
                status: "error",
                message: "Failed to generate recommendations",
                error: err.message
            });
        }
    });

    // Get font info
    app.get("/mcp/info/:font_id", async (req, res) => {
        try {
            const fontId = req.params.font_id;
            const fontInfo = await getFontInfo(fontId, state);

            if (!fontInfo) {
                return res.status(404).send({
                    status: "error",
                    message: "Font not found"
                });
            }

            res.send({
                status: "success",
                font: fontInfo
            });
        } catch (err) {
            console.error("MCP info error:", err);
            res.status(500).send({
                status: "error",
                message: "Failed to get font info",
                error: err.message
            });
        }
    });

    // Generate implementation code
    app.post("/mcp/implement", async (req, res) => {
        try {
            const { font_id, text, weight, method } = req.body;

            if (!font_id || !text) {
                return res.status(400).send({
                    status: "error",
                    message: "font_id and text parameters are required"
                });
            }

            const implementation = generateImplementation(
                font_id,
                text,
                weight,
                method || "both",
                state
            );

            res.send({
                status: "success",
                implementation: implementation
            });
        } catch (err) {
            console.error("MCP implement error:", err);
            res.status(500).send({
                status: "error",
                message: "Failed to generate implementation code",
                error: err.message
            });
        }
    });

    // Get categories
    app.get("/mcp/categories", async (req, res) => {
        res.send({
            status: "success",
            categories: CATEGORIES
        });
    });
};
