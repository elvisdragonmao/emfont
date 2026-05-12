const searchInput = document.getElementById("font-search");
const categoryFilter = document.getElementById("category-filter");
const fontListEl = document.getElementById("font-list");
const editForm = document.getElementById("font-edit-form");
const statusEl = document.getElementById("edit-status");
const sentenceStatusEl = document.getElementById("sentence-status");
const previewLink = document.getElementById("font-preview-link");
const demoSentenceSelect = document.getElementById("demo-sentence-select");
const sentenceCreateForm = document.getElementById("sentence-create-form");
const logoutButton = document.getElementById("admin-logout");
const deleteButton = document.getElementById("font-delete-button");
const i18n = (key, values) =>
	typeof window.t === "function" ? window.t(key, values) : key;

let fontList = [];
let demoSentences = [];
let selectedFontId = "";
let currentAdmin = null;

function setStatus(message, className = "") {
	statusEl.textContent = message;
	statusEl.className = className;
}

function setSentenceStatus(message, className = "") {
	sentenceStatusEl.textContent = message;
	sentenceStatusEl.className = className;
}

function headers() {
	return { "content-type": "application/json" };
}

function isSuperAdmin() {
	return currentAdmin?.role === "super_admin";
}

function applyRoleVisibility() {
	document.querySelectorAll("[data-super-admin-only]").forEach(element => {
		element.hidden = !isSuperAdmin();
	});
	deleteButton.hidden = !isSuperAdmin();
	if (!isSuperAdmin()) deleteButton.disabled = true;
}

function redirectIfUnauthorized(res) {
	if (res.status === 401) {
		window.location.href = "/admin/login";
		return true;
	}
	return false;
}

function arrayToText(value) {
	return Array.isArray(value) ? value.join(", ") : value || "";
}

function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(",")[1]);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

async function pollJob(jobId) {
	while (true) {
		const res = await fetch(`/api/admin/font-upload-jobs/${jobId}`);
		if (redirectIfUnauthorized(res)) return null;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Job polling failed");
		setStatus(data.message || data.status, data.status);
		if (data.status === "completed" || data.status === "failed") return data;
		await new Promise(resolve => setTimeout(resolve, 1800));
	}
}

function escapeHtml(value) {
	return String(value ?? "").replace(
		/[&<>"']/g,
		char =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[char],
	);
}

function optionText(sentence) {
	const language = sentence.language ? ` ${sentence.language}` : "";
	return `#${sentence.id}${language} ${sentence.content}`;
}

function renderDemoSentences(selectedId = 1) {
	demoSentenceSelect.innerHTML = demoSentences
		.map(
			sentence =>
				`<option value="${sentence.id}" ${Number(sentence.id) === Number(selectedId) ? "selected" : ""}>${escapeHtml(optionText(sentence))}</option>`,
		)
		.join("");
}

function fillForm(font) {
	selectedFontId = font.id;
	editForm.elements.id.value = font.id;
	editForm.elements.name.value = font.name || "";
	editForm.elements.nameZh.value = font.nameZh || "";
	editForm.elements.nameEn.value = font.nameEn || "";
	editForm.elements.weights.value = arrayToText(font.weights);
	editForm.elements.license.value = font.license || "";
	editForm.elements.version.value = font.version || "";
	editForm.elements.description.value = font.description || "";
	editForm.elements.category.value = font.category || "sans-serif";
	editForm.elements.family.value = font.family || "";
	editForm.elements.tags.value = arrayToText(font.tags);
	editForm.elements.repoUrl.value = font.repoUrl || "";
	editForm.elements.authors.value = arrayToText(font.authors);
	editForm.elements.format.value = font.format || "ttf";
	editForm.elements.replacementWeight.value = font.weights?.[0] || "";
	editForm.elements.fontFile.value = "";
	renderDemoSentences(font.demoContentId || 1);
	previewLink.href = font.fontUrl;
	editForm.hidden = false;
	deleteButton.disabled = !isSuperAdmin();
	renderFontList();
}

function renderCategoryFilter() {
	const categories = Array.from(
		new Set(fontList.map(font => font.category).filter(Boolean)),
	).sort();
	categoryFilter.innerHTML = [
		`<option value="all">${escapeHtml(i18n("admin.allCategories"))}</option>`,
		...categories.map(
			category =>
				`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`,
		),
	].join("");
}

function fontMatchesQuery(font, query) {
	const searchTarget = [
		font.id,
		font.name,
		font.name_zh,
		font.name_en,
		font.author,
		font.family,
		...(font.tags || []),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return searchTarget.includes(query);
}

function renderFontList() {
	const query = searchInput.value.trim().toLowerCase();
	const category = categoryFilter.value;
	const filtered = fontList.filter(font => {
		const matchCategory = category === "all" || font.category === category;
		const matchQuery = !query || fontMatchesQuery(font, query);
		return matchCategory && matchQuery;
	});

	fontListEl.innerHTML = filtered
		.map(font => {
			const weights = Array.isArray(font.weight) ? font.weight.join(" / ") : "";
			const author = font.author || i18n("admin.js.unknownAuthor");
			const selected = font.id === selectedFontId ? " selected" : "";
			return `<button class="admin-font-item${selected}" type="button" data-font-id="${escapeHtml(font.id)}">
				<span class="admin-font-name">${escapeHtml(font.name || font.id)}</span>
				<span class="admin-font-meta">${escapeHtml(font.id)} | ${escapeHtml(weights || i18n("admin.js.noWeights"))} | ${escapeHtml(author)}</span>
			</button>`;
		})
		.join("");

	if (!fontListEl.innerHTML) {
		fontListEl.innerHTML = `<p class="empty-state">${escapeHtml(i18n("admin.js.emptyFonts"))}</p>`;
	}
}

async function loadFontList() {
	const res = await fetch("/list");
	fontList = await res.json();
	fontList.sort((a, b) => a.id.localeCompare(b.id));
	renderCategoryFilter();
	renderFontList();
}

async function loadAdminConfig() {
	const res = await fetch("/api/admin/config", { headers: headers() });
	if (redirectIfUnauthorized(res)) return;
	const data = await res.json();
	if (!res.ok) throw new Error(data.message || "Failed to load admin config");
	currentAdmin = data.user;
	applyRoleVisibility();
}

async function refreshAfterDelete(fontId) {
	selectedFontId = "";
	editForm.hidden = true;
	deleteButton.disabled = true;
	previewLink.href = "#";
	await loadFontList();
	setStatus(i18n("admin.js.deleted", { fontId }), "completed");
}

async function loadDemoSentences(selectedId = 1) {
	const res = await fetch("/api/admin/demo-sentences", {
		headers: headers(),
	});
	if (redirectIfUnauthorized(res)) return [];
	const data = await res.json();
	if (!res.ok) throw new Error(data.message || "Failed to load demo sentences");
	demoSentences = data;
	renderDemoSentences(selectedId);
}

async function loadFont(fontId) {
	setStatus(i18n("admin.generic.loading"));
	editForm.hidden = true;
	try {
		if (demoSentences.length === 0) await loadDemoSentences();
		const res = await fetch(`/api/admin/fonts/${encodeURIComponent(fontId)}`, {
			headers: headers(),
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Load failed");
		fillForm(data);
		setStatus(i18n("admin.generic.loaded"), "completed");
	} catch (error) {
		setStatus(error.message, "failed");
	}
}

fontListEl.addEventListener("click", event => {
	const item = event.target.closest("[data-font-id]");
	if (!item) return;
	loadFont(item.dataset.fontId);
});

searchInput.addEventListener("input", renderFontList);
categoryFilter.addEventListener("change", renderFontList);
editForm.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = editForm.querySelector("button[type=submit]");
	const fontId = editForm.elements.id.value;
	submit.disabled = true;
	setStatus(i18n("admin.generic.saving"));
	try {
		const formData = new FormData(editForm);
		const file = formData.get("fontFile");
		const payload = Object.fromEntries(formData.entries());
		delete payload.id;
		delete payload.fontFile;

		if (file && file.size > 0) {
			const extension = file.name.split(".").pop().toLowerCase();
			editForm.elements.format.value = extension;
			payload.extension = extension;
			payload.format = extension;
			payload.fileBase64 = await fileToBase64(file);
		} else {
			delete payload.replacementWeight;
		}

		const res = await fetch(`/api/admin/fonts/${encodeURIComponent(fontId)}`, {
			method: "PUT",
			headers: headers(),
			body: JSON.stringify(payload),
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Update failed");
		if (data.jobId) {
			setStatus(i18n("admin.js.savedRegenerate"));
			const job = await pollJob(data.jobId);
			if (job?.status === "failed")
				throw new Error(job.error || "Static generation failed");
			setStatus(i18n("admin.js.fontFileUpdated"), "completed");
			editForm.elements.fontFile.value = "";
		} else {
			setStatus(i18n("admin.generic.saved"), "completed");
		}
		alert(
			i18n("admin.js.fontUpdated", {
				fontUrl: data.fontUrl || previewLink.href,
			}),
		);
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

deleteButton.addEventListener("click", async () => {
	if (!selectedFontId) return;
	const fontId = selectedFontId;
	const confirmId = window.prompt(i18n("admin.js.deleteConfirm", { fontId }));
	if (confirmId === null) return;
	if (confirmId !== fontId) {
		setStatus(i18n("admin.js.deleteMismatch"), "failed");
		return;
	}
	const password = window.prompt(i18n("admin.js.deletePassword"));
	if (password === null) return;

	deleteButton.disabled = true;
	setStatus(i18n("admin.js.deleting"));
	try {
		const res = await fetch(`/api/admin/fonts/${encodeURIComponent(fontId)}`, {
			method: "DELETE",
			headers: headers(),
			body: JSON.stringify({ confirmId, password }),
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Delete failed");
		await refreshAfterDelete(fontId);
	} catch (error) {
		setStatus(error.message, "failed");
		deleteButton.disabled = !isSuperAdmin();
	}
});

sentenceCreateForm.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = sentenceCreateForm.querySelector("button[type=submit]");
	submit.disabled = true;
	setSentenceStatus(i18n("admin.js.adding"));
	try {
		const payload = Object.fromEntries(
			new FormData(sentenceCreateForm).entries(),
		);
		const res = await fetch("/api/admin/demo-sentences", {
			method: "POST",
			headers: headers(),
			body: JSON.stringify(payload),
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Create failed");
		await loadDemoSentences(data.sentence.id);
		if (!editForm.hidden)
			editForm.elements.demoContentId.value = data.sentence.id;
		sentenceCreateForm.reset();
		setSentenceStatus(i18n("admin.js.added"), "completed");
	} catch (error) {
		setSentenceStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

Promise.resolve(window.i18nReady)
	.then(() => {
		document.title = i18n("admin.editTitle");
		return Promise.all([
			loadAdminConfig(),
			loadFontList(),
			loadDemoSentences(),
		]);
	})
	.catch(error => {
		setStatus(error.message, "failed");
	});

logoutButton.addEventListener("click", async () => {
	await fetch("/api/admin/logout", { method: "POST" });
	window.location.href = "/admin/login";
});
