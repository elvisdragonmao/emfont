import { readFileSync } from "fs";
import path from "path";

const defaultLocale = "zh-Hant";
const supportedLocales = new Set([defaultLocale, "en-US"]);
const localeCache = new Map();

function normalizeLocale(locale = defaultLocale) {
	const rawLocale = String(locale || defaultLocale).trim();
	if (supportedLocales.has(rawLocale)) return rawLocale;
	const lowerLocale = rawLocale.toLowerCase();
	if (lowerLocale === "en" || lowerLocale.startsWith("en-")) return "en-US";
	if (
		lowerLocale === "zh" ||
		lowerLocale === "zh-tw" ||
		lowerLocale === "zh-hant"
	) {
		return "zh-Hant";
	}
	return defaultLocale;
}

function readLocale(locale = defaultLocale) {
	const normalizedLocale = normalizeLocale(locale);
	if (localeCache.has(normalizedLocale))
		return localeCache.get(normalizedLocale);
	const filePath = path.join(
		import.meta.dirname,
		"locales",
		`${normalizedLocale}.json`,
	);
	const messages = JSON.parse(readFileSync(filePath, "utf8"));
	localeCache.set(normalizedLocale, messages);
	return messages;
}

function resolveMessage(messages, key) {
	return key
		.split(".")
		.reduce(
			(value, segment) =>
				value && Object.prototype.hasOwnProperty.call(value, segment)
					? value[segment]
					: undefined,
			messages,
		);
}

function interpolate(message, params = {}) {
	return String(message).replace(/\{([^{}]+)\}/g, (_, key) => {
		return params[key] ?? "";
	});
}

function createTranslator(locale = defaultLocale) {
	const normalizedLocale = normalizeLocale(locale);
	const messages = readLocale(normalizedLocale);
	const fallbackMessages =
		normalizedLocale === defaultLocale ? messages : readLocale(defaultLocale);
	return (key, params) => {
		const message =
			resolveMessage(messages, key) ?? resolveMessage(fallbackMessages, key);
		if (message === undefined) return key;
		return interpolate(message, params);
	};
}

function getLocaleMessages(locale = defaultLocale) {
	return readLocale(locale);
}

export {
	createTranslator,
	defaultLocale,
	getLocaleMessages,
	normalizeLocale,
	supportedLocales,
};
