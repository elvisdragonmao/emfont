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

let fontList = [];
let demoSentences = [];
let selectedFontId = "";

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
	renderDemoSentences(font.demoContentId || 1);
	previewLink.href = font.fontUrl;
	editForm.hidden = false;
	renderFontList();
}

function renderCategoryFilter() {
	const categories = Array.from(
		new Set(fontList.map(font => font.category).filter(Boolean)),
	).sort();
	categoryFilter.innerHTML = [
		`<option value="all">所有分類</option>`,
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
			const author = font.author || "未知作者";
			const selected = font.id === selectedFontId ? " selected" : "";
			return `<button class="admin-font-item${selected}" type="button" data-font-id="${escapeHtml(font.id)}">
				<span class="admin-font-name">${escapeHtml(font.name || font.id)}</span>
				<span class="admin-font-meta">${escapeHtml(font.id)} | ${escapeHtml(weights || "無字重")} | ${escapeHtml(author)}</span>
			</button>`;
		})
		.join("");

	if (!fontListEl.innerHTML) {
		fontListEl.innerHTML = `<p class="empty-state">沒有符合條件的字型。</p>`;
	}
}

async function loadFontList() {
	const res = await fetch("/list");
	fontList = await res.json();
	fontList.sort((a, b) => a.id.localeCompare(b.id));
	renderCategoryFilter();
	renderFontList();
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
	setStatus("正在載入");
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
		setStatus("已載入", "completed");
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
	setStatus("正在儲存");
	try {
		const payload = Object.fromEntries(new FormData(editForm).entries());
		delete payload.id;
		const res = await fetch(`/api/admin/fonts/${encodeURIComponent(fontId)}`, {
			method: "PUT",
			headers: headers(),
			body: JSON.stringify(payload),
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Update failed");
		setStatus("已儲存", "completed");
		alert(`字型資訊已更新\n${data.fontUrl || previewLink.href}`);
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

sentenceCreateForm.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = sentenceCreateForm.querySelector("button[type=submit]");
	submit.disabled = true;
	setSentenceStatus("正在新增");
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
		setSentenceStatus("已新增", "completed");
	} catch (error) {
		setSentenceStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

Promise.all([loadFontList(), loadDemoSentences()]).catch(error => {
	setStatus(error.message, "failed");
});

logoutButton.addEventListener("click", async () => {
	await fetch("/api/admin/logout", { method: "POST" });
	window.location.href = "/admin/login";
});
