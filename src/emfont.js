class Emfont {
    constructor(
        config = {
            caseSensitive: false,
            weight: 400,
            format: "woff2", // woff2, woff, ttf, eot
            autoApply: true,
            cache: true,
            applyAt: document.head
        }
    ) {
        this.config = config;

        // Check browser support
        if (!this._checkBrowserSupport()) {
            console.warn(
                "emfont: Your browser may not support all required features. Some functionality may be limited."
            );
            // Fallback to WOFF if WOFF2 is not supported
            if (this.config.format === "woff2" && !this._hasWoff2Support()) {
                this.config.format = "woff";
            }
        } else {
            console.log(
                "This website uses emfont: a free Chinese webfont service."
            );
        }
    }

    _checkBrowserSupport() {
        return (
            typeof FontFace === "function" &&
            "fonts" in document &&
            typeof Promise === "function" &&
            typeof class {} === "function" &&
            (() => {}).constructor === Function &&
            Object.entries &&
            Array.prototype.includes
        );
    }

    _hasWoff2Support() {
        try {
            const testFont = new FontFace(
                "t",
                'url("data:font/woff2;base64,d09GMgABAAAAAADcAAoAAAAAAggAAACWAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABk4ALAoUNAE2AiQDCAsGAAQgBSAHIBtvAcieB3aD8wURQ+TZazbRE9HvF5vde4KCYGhiCgq/NKPF0i6UIsZynbP+Xi9Ng+XLbNlmNz/xIBBqq61FIQRJhC/+QA/08PJQJ3sK") format("woff2")'
            );
            return testFont
                .load()
                .then(() => true)
                .catch(() => false);
        } catch (e) {
            return false;
        }
    }

    // a object to store fonts already loaded
    fonts = {};

    init() {
        return new Promise((resolve) => {
            const elements = document.querySelectorAll("[class*='emfont']");
            let fonts = {};
            let promises = [];

            elements.forEach((element) => {
                // Get all font names from element class
                const fontNames = element.className
                    .split(" ")
                    .filter(
                        (name) =>
                            name.startsWith("emfont-") || name.startsWith("✏️")
                    )
                    .map((name) => name.replace(/^(emfont-|✏️)/, ""));
                const words = element.textContent.trim(); // Custom words from element text

                fontNames.forEach((fontName) => {
                    if (fontName && words) {
                        // check if there are -500, -500, -900, etc. in class name, must start with -
                        const settedWeight = !!fontName.match(/-(\d+)/);
                        if (!settedWeight)
                            fontName +=
                                "-" +
                                (element.style.fontWeight ||
                                    this.config.weight);

                        console.log("realWeight:", fontName);
                        fonts[fontName] =
                            (fonts[fontName] ? fonts[fontName] : "") + words;
                    }
                });
            });

            const cssElement = document.createElement("style");
            if (this.config.autoApply)
                this.config.applyAt.appendChild(cssElement);

            // Load custom fonts
            const fetchPromises = Object.entries(fonts).map(
                ([fontName, text]) => {
                    const words = Array.from(new Set(text.split("")))
                        .sort()
                        .join("");
                    let postFontName = fontName;
                    // check if fontName contains -min
                    const min = fontName.match(/-min/)?.[0];
                    if (min) postFontName = fontName.replace(min, "");
                    const weight = fontName.match(/-(\d+)/)[1];
                    if (weight)
                        postFontName = fontName.replace("-" + weight, "");
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
                        .then((response) => response.json())
                        .then((data) => {
                            if (data.status === "success") {
                                if (data.message) console.warn(data.message);
                                const fontCSSName = data.name;
                                const font = new FontFace(
                                    fontCSSName,
                                    data.location
                                        .map((url) => `url(${url})`)
                                        .join(", ")
                                );
                                if (this.config.autoApply)
                                    cssElement.innerHTML += `.emfont-${fontName} { font-family: '${fontCSSName}'; } 
                                    .✏️${fontName} { font-family: '${fontCSSName}'; }`;
                                // Add to the document.fonts (FontFaceSet)
                                return font.load().then((loadedFont) => {
                                    document.fonts.add(loadedFont);
                                });
                            } else {
                                console.error(data.message);
                                return Promise.resolve();
                            }
                        });
                }
            );
            // Wait for all fonts to load
            Promise.all(fetchPromises).then(() => {
                resolve();
            });
        });
    }
}

const emfont = new Emfont();
