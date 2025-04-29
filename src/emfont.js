/** @format */

(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module
        define([], factory);
    } else if (typeof module === "object" && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.emfont = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    class Emfont {
        constructor(
            config = {
                caseSensitive: false,
                weight: null,
                format: "woff2", // woff2, woff, ttf, eot
                autoApply: true,
                cache: true,
                applyAt: document.head,
                colorTest: false,
                root: document.documentElement,
                log: false,
                hideAd: false
            }
        ) {
            this.config = config;
            // if (!this.config.colorTest && !this._checkBrowserSupport()) {
            //     if (this.config.log) console.warn("✏️ Your browser may not support all required features for emfont. Some functionality may be limited.");
            //     if (this.config.format === "woff2" && !this._hasWoff2Support()) {
            //         this.config.format = "woff";
            //     }
            // } else
            if (!this.config.hideAd) console.log("✏️ This website uses emfont: a free Chinese webfont service.");
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
            this.config = {
                ...this.config,
                root: document.documentElement,
                ...newConfig
            };
        }

        init(newConfig = {}) {
            let newFonts = {};
            this.setConfig(newConfig);
            return new Promise(resolve => {
                let elements = this.config.root.querySelectorAll("[class*='emfont']");
                // if root element has class add it too
                if (this.config.root.className.includes("emfont")) elements = [this.config.root, ...elements];
                let originalClasses = [];
                elements.forEach(element => {
                    if (this.config.colorTest) {
                        element.style.color = "red";
                        return;
                    }
                    const fontNames = element.className
                        .split(" ")
                        .filter(name => name.startsWith("emfont-") || name.startsWith("✏️"))
                        .map(name => name.replace(/^(emfont-|✏️)/, ""));
                    originalClasses.push(...fontNames);
                    const words = element.textContent.trim();

                    fontNames.forEach(fontName => {
                        if (fontName && words) {
                            const settedWeight = !!fontName.match(/-(\d+)/);
                            if (!settedWeight) fontName += element.style.fontWeight ? "-" + element.style.fontWeight : this.config.weight ? "-" + this.config.weight : "";
                            const text = (newFonts[fontName] ? newFonts[fontName] : "") + words;
                            newFonts[fontName] = Array.from(new Set(text.split("")))
                                .sort()
                                .join("");
                        }
                    });
                });

                if (!this._styleElement) {
                    this._styleElement = document.createElement("style");
                    if (this.config.autoApply) this.config.applyAt.appendChild(this._styleElement);
                }
                let skippedList = [];
                if (this.config.cache) {
                    Object.keys(this.fonts).forEach(fontName => {
                        if (newFonts[fontName]) {
                            delete newFonts[fontName];
                            skippedList.push({
                                name: fontName,
                                status: "skipped",
                                reason: "Already loaded"
                            });
                        }
                    });
                }
                let willAddCSS = [];
                Object.keys(newFonts).forEach(fontName => {
                    if (this.fonts[fontName]) {
                        this.fonts[fontName] = Array.from(new Set((this.fonts[fontName] + newFonts[fontName]).split("")))
                            .sort()
                            .join("");
                    } else {
                        this.fonts[fontName] = newFonts[fontName];
                        willAddCSS.push(fontName);
                    }
                });

                const fetchPromises = Object.entries(newFonts).map(([fontName, words]) => {
                    let postFontName = fontName;
                    const min = fontName.includes("-min");
                    if (min) postFontName = fontName.replace("-min", "");
                    let weight = fontName.match(/-(\d+)/);
                    if (weight) {
                        postFontName = postFontName.replace("-" + weight[1], "");
                        weight = weight[1];
                    }

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
                        .then(response => {
                            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                            return response.json();
                        })
                        .then(async data => {
                            if (data.status === "success") {
                                if (data.message) console.warn("✏️ " + data.message);
                                const fontCSSName = data.name;

                                if (this.config.autoApply && willAddCSS.includes(fontName)) {
                                    const baseFontName = fontName.split("-")[0];
                                    const matchedVariants = originalClasses.filter(cls => cls.startsWith(baseFontName));
                                    if (matchedVariants.length === 0) matchedVariants.push(baseFontName);
                                    const uniqueVariants = [...new Set(matchedVariants)];
                                    this._styleElement.innerHTML += uniqueVariants
                                        .map(
                                            variant => `
                                        .emfont-${variant}, .✏️${variant} { font-family: '${fontCSSName}'; }`
                                        )
                                        .join("\n");
                                }

                                for (const url of data.location) {
                                    const font = new FontFace(fontCSSName, `url(${url})`, {
                                        weight: weight || this.config.weight || "normal"
                                    });
                                    try {
                                        const loadedFont = await font.load();
                                        document.fonts.add(loadedFont);
                                    } catch (err) {
                                        console.warn(`✏️ Failed to load font from: ${url}`, err);
                                    }
                                }
                                return {
                                    name: fontName,
                                    status: "fulfilled"
                                };
                            } else {
                                return {
                                    name: fontName,
                                    status: "rejected",
                                    reason: data.message
                                };
                            }
                        })
                        .catch(err => {
                            // Catch network or fetch errors like no internet
                            return {
                                name: fontName,
                                status: "rejected",
                                reason: err.message
                            };
                        });
                });

                Promise.all(fetchPromises).then(results => {
                    results = [...results, ...skippedList];
                    if (this.config.log)
                        results.forEach(result => {
                            if (result.status === "fulfilled") {
                                console.log(`✅ ${result.name} loaded successfully`);
                            } else {
                                console.warn(`❌ ${result.name} failed: ${result.reason}`);
                            }
                        });
                    resolve(results);
                });
            });
        }
    }

    const emfont = new Emfont();
    emfont.Emfont = Emfont;
    return emfont;
});
