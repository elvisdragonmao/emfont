/** @format */

/**
 * @typedef {{
 *   version: number,
 *   payload: any,
 *   expiresAt: string,
 * }} EmfontCacheContent
 */

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
                hideAd: false,
                forceMin: false,
                tofu: false
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

        /**
         * Hash a string to a number
         * @param {string} str
         * @param {number} seed
         * @returns {number}
         */
        _cyrb53(str, seed = 42) {
            let h1 = 0xdeadbeef ^ seed,
                h2 = 0x41c6ce57 ^ seed;
            for (let i = 0, ch; i < str.length; i++) {
                ch = str.charCodeAt(i);
                h1 = Math.imul(h1 ^ ch, 2654435761);
                h2 = Math.imul(h2 ^ ch, 1597334677);
            }
            h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
            h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
            h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
            h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

            return 4294967296 * (2097151 & h2) + (h1 >>> 0);
        }

        /**
         * Cache a value
         * @template T
         * @param {number} ttl The cache TTL in seconds, by default it is 1 day
         * @returns {{get: (key: string) => T | null, set: (key: string, value: T) => void}}
         */
        _createLocalStorageCacher(ttl = 86400) {
            const version = 1;
            const cachePrefix = "emfont-cache:";

            return {
                get(key) {
                    const cacheJson = localStorage.getItem(cachePrefix + key);
                    if (cacheJson) {
                        /**
                         * @type {EmfontCacheContent}
                         */
                        const cache = JSON.parse(cacheJson);
                        if (cache.version === version && new Date(cache.expiresAt) > new Date()) {
                            return cache.payload;
                        }
                    }

                    return null;
                },
                set(key, value) {
                    /**
                     * @type {EmfontCacheContent}
                     */
                    const cache = {
                        version,
                        payload: value,
                        expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
                    };
                    localStorage.setItem(cachePrefix + key, JSON.stringify(cache));
                }
            };
        }

        /**
         * Fetch JSON with cache
         * @template T
         * @param {string} url See {@link fetch}
         * @param {RequestInit} options See {@link fetch}
         * @param {ReturnType<typeof this._createLocalStorageCacher>} cacher
         * See {@link _createLocalStorageCacher}, nothing will be cached if null
         * @returns {Promise<T>}
         */
        async _fetchJson(url, options, cacher) {
            const cacheKey = this._cyrb53(url + JSON.stringify(options));

            const cache = cacher?.get(cacheKey);
            if (cache) {
                return cache;
            }

            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            const responseJson = await response.json();

            // Cache only when "status" is "success"
            if ("status" in responseJson && responseJson.status !== "success") {
                return responseJson;
            }

            cacher?.set(cacheKey, responseJson);
            return responseJson;
        }

        init(newConfig = {}) {
            let newFonts = {};
            this.setConfig(newConfig);
            return new Promise(resolve => {
                // Get all elements with `emfont-*` on them
                let roots = Array.from(this.config.root.querySelectorAll("[class*='emfont']"));
                if (this.config.root.className.includes("emfont")) roots.unshift(this.config.root);

                // To collect all styled sub-elements
                let elements = new Set();

                roots.forEach(root => {
                    elements.add(root); // Add root itself
                    root.querySelectorAll("*").forEach(child => {
                        // Only add children that have text
                        if (child.textContent.trim()) elements.add(child);
                    });
                });

                let originalClasses = [];

                elements.forEach(element => {
                    if (this.config.colorTest) {
                        element.style.color = "red";
                        return;
                    }

                    // Find closest ancestor with emfont-* class
                    let fontName = null;
                    for (let el = element; el; el = el.parentElement) {
                        const match = [...el.classList].find(cls => cls.startsWith("emfont-") || cls.startsWith("✏️"));
                        if (match) {
                            fontName = match.replace(/^(emfont-|✏️)/, "");
                            originalClasses.push(fontName);
                            break;
                        }
                    }

                    if (!fontName) return;

                    // Get transformed text
                    const style = getComputedStyle(element);
                    let words = element.textContent.trim();
                    switch (style.textTransform) {
                        case "uppercase":
                            words = words.toUpperCase();
                            break;
                        case "lowercase":
                            words = words.toLowerCase();
                            break;
                        case "capitalize":
                            words = words.replace(/\b\w/g, c => c.toUpperCase());
                            break;
                    }

                    // Handle font weight
                    let finalFontName = fontName;
                    const hasWeight = fontName.match(/-(\d+)/);
                    if (!hasWeight) {
                        const weight = style.fontWeight || this.config.weight || "";
                        if (weight && weight !== "normal") finalFontName += `-${weight}`;
                    }

                    if (finalFontName && words) {
                        const text = (newFonts[finalFontName] || "") + words;
                        newFonts[finalFontName] = Array.from(new Set(text.split("")))
                            .sort()
                            .join("");
                    }
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
                    willAddCSS.push(fontName);
                    if (this.fonts[fontName]) {
                        this.fonts[fontName] = Array.from(new Set((this.fonts[fontName] + newFonts[fontName]).split("")))
                            .sort()
                            .join("");
                    } else {
                        this.fonts[fontName] = newFonts[fontName];
                    }
                });

                const fetchPromises = Object.entries(newFonts).map(([fontName, words]) => {
                    let postFontName = fontName;
                    const min = this.config.forceMin || fontName.includes("-min");
                    if (min) postFontName = fontName.replace("-min", "");
                    let weight = fontName.match(/-(\d+)/);
                    if (weight) {
                        postFontName = postFontName.replace("-" + weight[1], "");
                        weight = weight[1];
                    }
                    const tofu = this.config.tofu ? ", 'Tofu'" : "";

                    const cacher = !min && this.config.cache ? this._createLocalStorageCacher(86400) : null;

                    return this._fetchJson(
                        "{{BASE_URL}}/g/" + postFontName,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                words: words + " ",
                                min,
                                weight,
                                format: this.config.format
                            })
                        },
                        cacher
                    )
                        .then(async data => {
                            if (data.status === "success") {
                                if (data.message) console.warn("✏️ " + data.message);
                                const fontCSSName = data.name;

                                if (this.config.autoApply && willAddCSS.includes(fontName)) {
                                    const baseFontName = fontName.split("-")[0];
                                    const matchedVariants = originalClasses.filter(cls => cls.startsWith(baseFontName));
                                    if (matchedVariants.length === 0) matchedVariants.push(baseFontName);
                                    const uniqueVariants = [...new Set(matchedVariants)];
                                    this._styleElement.innerHTML +=
                                        "\n" +
                                        uniqueVariants
                                            .map(variant => {
                                                const weight = variant.match(/-(\d+)/) ? variant.match(/-(\d+)/)[1] : "normal";
                                                return `.emfont-${variant},.✏️${variant}{font-family:'${fontCSSName}'${tofu};font-weight:${weight}}`;
                                            })
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

                    let allCSS = this._styleElement.innerHTML.split("\n").filter((css, index, self) => self.indexOf(css) === index);
                    this._styleElement.innerHTML = allCSS.join("\n");

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
