class Emfont {
    constructor(
        config = {
            caseSensitive: false,
            weight: 400,
            format: "woff2", // woff2, woff, ttf, eot
            autoApply: true,
            cache: true,
            applyAt: document.head,
            colorTest: false,
            root: document.documentElement
        }
    ) {
        this.config = config;

        if (!this.config.colorTest && !this._checkBrowserSupport()) {
            console.warn("✏️ Your browser may not support all required features for emfont. Some functionality may be limited.");
            if (this.config.format === "woff2" && !this._hasWoff2Support()) {
                this.config.format = "woff";
            }
        } else console.log("✏️ This website uses emfont: a free Chinese webfont service.");
    }

    _checkBrowserSupport() {
        return typeof FontFace === "function" && "fonts" in document && typeof Promise === "function" && typeof class {} === "function" && (() => {}).constructor === Function && Object.entries && Array.prototype.includes;
    }

    _hasWoff2Support() {
        try {
            const testFont = new FontFace("t", 'url("data:font/woff2;base64,d09GMgABAAAAAADcAAoAAAAAAggAAACWAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABk4ALAoUNAE2AiQDCAsGAAQgBSAHIBtvAcieB3aD8wURQ+TZazbRE9HvF5vde4KCYGhiCgq/NKPF0i6UIsZynbP+Xi9Ng+XLbNlmNz/xIBBqq61FIQRJhC/+QA/08PJQJ3sK") format("woff2")');
            return testFont
                .load()
                .then(() => true)
                .catch(() => false);
        } catch (e) {
            return false;
        }
    }

    fonts = {};

    setConfig(newConfig = {}) {
        this.config = { ...this.config, root: document.documentElement, ...newConfig }; // Merge the new config with the existing one
    }

    init(newConfig = {}) {
        this.setConfig(newConfig); // Apply new config before initializing
        return new Promise(resolve => {
            const elements = this.config.root.querySelectorAll("[class*='emfont']");
            let fonts = {};
            let originalClasses = [];
            elements.forEach(element => {
                if (this.config.colorTest) {
                    element.style.color = "red";
                    return;
                }
                // Get all font names from element class
                const fontNames = element.className
                    .split(" ")
                    .filter(name => name.startsWith("emfont-") || name.startsWith("✏️"))
                    .map(name => name.replace(/^(emfont-|✏️)/, ""));
                originalClasses.push(...fontNames);
                const words = element.textContent.trim(); // Custom words from element text

                fontNames.forEach(fontName => {
                    if (fontName && words) {
                        // check if there are -500, -500, -900, etc. in class name, must start with -
                        const settedWeight = !!fontName.match(/-(\d+)/);
                        if (!settedWeight) fontName += "-" + (element.style.fontWeight || this.config.weight);
                        fonts[fontName] = (fonts[fontName] ? fonts[fontName] : "") + words;
                    }
                });
            });

            const cssElement = document.createElement("style");
            if (this.config.autoApply) this.config.applyAt.appendChild(cssElement);

            // Load custom fonts
            const fetchPromises = Object.entries(fonts).map(([fontName, text]) => {
                const words = Array.from(new Set(text.split("")))
                    .sort()
                    .join("");
                let postFontName = fontName;
                // check if fontName contains -min
                const min = fontName.includes("-min");
                if (min) postFontName = fontName.replace("-min", "");
                const weight = fontName.match(/-(\d+)/)[1];
                if (weight) postFontName = postFontName.replace("-" + weight, "");
                return fetch("{{BASE_URL}}/g/" + postFontName, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        words,
                        min,
                        weight,
                        format: this.config.format
                    })
                })
                    .then(response => response.json())
                    .then(async data => {
                        if (data.status === "success") {
                            if (data.message) console.warn("✏️ " + data.message);
                            const fontCSSName = data.name;
                            if (this.config.autoApply) {
                                // Filter matching variants based on base name
                                const baseFontName = fontName.split("-")[0];
                                const matchedVariants = originalClasses.filter(cls => cls.startsWith(baseFontName));
                                if (matchedVariants.length === 0) matchedVariants.push(baseFontName);
                                // Generate CSS for each matched variant
                                for (const variant of matchedVariants) {
                                    cssElement.innerHTML += `
                                    .emfont-${variant} { font-family: '${fontCSSName}'; }
                                    .✏️${variant} { font-family: '${fontCSSName}'; }
                                `;
                                }
                            }
                            for (const url of data.location) {
                                const font = new FontFace(fontCSSName, `url(${url})`);
                                try {
                                    const loadedFont = await font.load();
                                    document.fonts.add(loadedFont);
                                } catch (err) {
                                    console.warn(`✏️ Failed to load font from: ${url}`, err);
                                }
                            }
                        } else {
                            console.error("✏️ " + data.message);
                            return Promise.resolve();
                        }
                    });
            });
            // Wait for all fonts to load
            Promise.all(fetchPromises).then(() => {
                resolve();
            });
        });
    }
}

const emfont = new Emfont();
