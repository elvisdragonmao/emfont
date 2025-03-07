/*從舊檔複製過來的參考檔案，新的版本放在 gen_font.jsq */

//列出所有字型
app.get("/list", (req, res) => {
    const fonts = require("./Database/fonts.json");
    res.json(fonts);
});

// Route to handle font downloads
//後端產生字型檔
app.get("/f/:fileName/:fontName", (req, res) => {
    const { fileName, fontName } = req.params;
    logAccess(fontName, req, "download");
    res.download(
        path.join(__dirname, "fonts", "generated", fileName, fontName)
    );
});

// Route to handle font generate
app.post("/g/:font", async (req, res) => {
    try {
        const words = req.body.words;
        if (!words) {
            return res.status(400).send("Words are required");
        }
        console.log(words);
        var fontID = req.params.font;

        let generated = require("./Database/generated.json");
        if (generated[words] && generated[words][fontID]) {
            const fontData = require("./Database/fonts.json")[fontID];
            return res.json({
                url: `https://font.emtech.cc/f/${generated[words][fontID]}/${fontData.output}`,
                font: fontData.name,
                style: fontData.style,
                weight: fontData.weight,
            });
        }

        // load Database/font.json
        const fontList = require("./Database/fonts.json");
        // check if font is in the list
        if (!fontList[fontID]) {
            return res.status(400).send("Font not found");
        }

        const fontData = fontList[fontID];
        const fontFile = fontData.file;
        const fontName = fontData.name;
        // Check if words are provided

        // generate random file name
        let outputID = generateID(10);
        console.log(outputID);
        while (
            fs.existsSync(path.join(__dirname, "fonts", "generated", outputID))
        ) {
            outputID = generateID();
        }

        // Generate font file
        await generateFont(fontFile, words, outputID);
        logAccess(fontFile, req, "generate");
        generated = require("./Database/generated.json");
        if (!generated[words]) {
            generated[words] = {};
        }
        generated[words][fontID] = outputID;
        fs.writeFileSync(
            path.join(__dirname, "Database", "generated.json"),
            JSON.stringify(generated)
        );

        res.json({
            url: `https://font.emtech.cc/f/${outputID}/${fontData.output}`,
            font: fontName,
            style: fontData.style,
            weight: fontData.weight,
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

// Function to generate font file with specified words
async function generateFont(originalFontPath, words, fileName) {
    const fontmin = new Fontmin()
        .src(path.join(__dirname, "fonts", "original", originalFontPath))
        .use(
            Fontmin.glyph({
                text: words,
                hinting: false, // keep ttf hint info (fpgm, prep, cvt). default = true
            })
        )
        .use(
            Fontmin.ttf2woff({
                deflate: true, // deflate woff. default = false
            })
        )
        .dest(path.join(__dirname, "fonts", "generated", fileName));

    return new Promise((resolve, reject) => {
        fontmin.run(function (err, files) {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}