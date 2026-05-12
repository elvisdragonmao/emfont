export {};

const searchInput = document.getElementById("font-search") as HTMLInputElement;
const categoryFilter = document.getElementById("category-filter") as HTMLSelectElement;
const fontListEl = document.getElementById("font-list") as HTMLElement;
const editForm = document.getElementById("font-edit-form") as HTMLFormElement;
const statusEl = document.getElementById("edit-status") as HTMLElement;
const sentenceStatusEl = document.getElementById("sentence-status") as HTMLElement;
const previewLink = document.getElementById("font-preview-link") as HTMLAnchorElement;
const demoSentenceSelect = document.getElementById("demo-sentence-select") as HTMLSelectElement;
const sentenceCreateForm = document.getElementById("sentence-create-form") as HTMLFormElement;
const logoutButton = document.getElementById("admin-logout") as HTMLButtonElement;
const deleteButton = document.getElementById("font-delete-button") as HTMLButtonElement;
const apiBase = document.documentElement.dataset.apiBase?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => `${apiBase}${path}`;

let fontList = [];
let demoSentences = [];
let selectedFontId = "";
const editElements = () => editForm.elements as any;

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
		const res = await fetch(apiUrl(`/api/admin/font-upload-jobs/${jobId}`));
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
				"'": "&#39;"
			})[char]
	);
}

function optionText(sentence) {
	const language = sentence.language ? ` ${sentence.language}` : "";
	return `#${sentence.id}${language} ${sentence.content}`;
}

function renderDemoSentences(selectedId = 1) {
	demoSentenceSelect.innerHTML = demoSentences
		.map(sentence => `<option value="${sentence.id}" ${Number(sentence.id) === Number(selectedId) ? "selected" : ""}>${escapeHtml(optionText(sentence))}</option>`)
		.join("");
}

function fillForm(font) {
	selectedFontId = font.id;
	const elements = editElements();
	elements.id.value = font.id;
	elements.name.value = font.name || "";
	elements.nameZh.value = font.nameZh || "";
	elements.nameEn.value = font.nameEn || "";
	elements.weights.value = arrayToText(font.weights);
	elements.license.value = font.license || "";
	elements.version.value = font.version || "";
	elements.description.value = font.description || "";
	elements.category.value = font.category || "sans-serif";
	elements.family.value = font.family || "";
	elements.tags.value = arrayToText(font.tags);
	elements.repoUrl.value = font.repoUrl || "";
	elements.authors.value = arrayToText(font.authors);
	elements.format.value = font.format || "ttf";
	elements.replacementWeight.value = font.weights?.[0] || "";
	elements.fontFile.value = "";
	renderDemoSentences(font.demoContentId || 1);
	previewLink.href = font.fontUrl;
	editForm.hidden = false;
	deleteButton.disabled = false;
	renderFontList();
}

function renderCategoryFilter() {
	const categories = Array.from(new Set(fontList.map(font => font.category).filter(Boolean))).sort();
	categoryFilter.innerHTML = [`<option value="all">所有分類</option>`, ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)].join("");
}

function fontMatchesQuery(font, query) {
	const searchTarget = [font.id, font.name, font.name_zh, font.name_en, font.author, font.family, ...(font.tags || [])].filter(Boolean).join(" ").toLowerCase();
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
	const res = await fetch(apiUrl("/list"));
	fontList = await res.json();
	fontList.sort((a, b) => a.id.localeCompare(b.id));
	renderCategoryFilter();
	renderFontList();
}

async function refreshAfterDelete(fontId) {
	selectedFontId = "";
	editForm.hidden = true;
	deleteButton.disabled = true;
	previewLink.href = "#";
	await loadFontList();
	setStatus(`已刪除 ${fontId}`, "completed");
}

async function loadDemoSentences(selectedId = 1) {
	const res = await fetch(apiUrl("/api/admin/demo-sentences"), {
		headers: headers()
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
		const res = await fetch(apiUrl(`/api/admin/fonts/${encodeURIComponent(fontId)}`), {
			headers: headers()
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
	const item = (event.target as HTMLElement).closest("[data-font-id]") as HTMLElement | null;
	if (!item) return;
	loadFont(item.dataset.fontId);
});

searchInput.addEventListener("input", renderFontList);
categoryFilter.addEventListener("change", renderFontList);
editForm.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = editForm.querySelector("button[type=submit]") as HTMLButtonElement;
	const elements = editElements();
	const fontId = elements.id.value;
	submit.disabled = true;
	setStatus("正在儲存");
	try {
		const formData = new FormData(editForm);
		const file = formData.get("fontFile") as File;
		const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
		delete payload.id;
		delete payload.fontFile;

		if (file && file.size > 0) {
			const extension = file.name.split(".").pop().toLowerCase();
			elements.format.value = extension;
			payload.extension = extension;
			payload.format = extension;
			payload.fileBase64 = await fileToBase64(file);
		} else {
			delete payload.replacementWeight;
		}

		const res = await fetch(apiUrl(`/api/admin/fonts/${encodeURIComponent(fontId)}`), {
			method: "PUT",
			headers: headers(),
			body: JSON.stringify(payload)
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Update failed");
		if (data.jobId) {
			setStatus("已儲存，正在重新切割靜態字型");
			const job = await pollJob(data.jobId);
			if (job?.status === "failed") throw new Error(job.error || "Static generation failed");
			setStatus("字型檔已更新，靜態字型也切好了", "completed");
			elements.fontFile.value = "";
		} else {
			setStatus("已儲存", "completed");
		}
		alert(`字型資訊已更新\n${data.fontUrl || previewLink.href}`);
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

deleteButton.addEventListener("click", async () => {
	if (!selectedFontId) return;
	const fontId = selectedFontId;
	const confirmId = window.prompt(`這是不可逆操作，會刪除 ${fontId} 的資料庫紀錄、原始字型檔和已產生的靜態字型。\n\n請輸入字型 ID 確認刪除：`);
	if (confirmId === null) return;
	if (confirmId !== fontId) {
		setStatus("字型 ID 不一致，已取消刪除", "failed");
		return;
	}
	const password = window.prompt("請重新輸入管理員密碼確認刪除：");
	if (password === null) return;

	deleteButton.disabled = true;
	setStatus("正在刪除字型");
	try {
		const res = await fetch(apiUrl(`/api/admin/fonts/${encodeURIComponent(fontId)}`), {
			method: "DELETE",
			headers: headers(),
			body: JSON.stringify({ confirmId, password })
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Delete failed");
		await refreshAfterDelete(fontId);
	} catch (error) {
		setStatus(error.message, "failed");
		deleteButton.disabled = false;
	}
});

sentenceCreateForm.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = sentenceCreateForm.querySelector("button[type=submit]") as HTMLButtonElement;
	submit.disabled = true;
	setSentenceStatus("正在新增");
	try {
		const payload = Object.fromEntries(new FormData(sentenceCreateForm).entries());
		const res = await fetch(apiUrl("/api/admin/demo-sentences"), {
			method: "POST",
			headers: headers(),
			body: JSON.stringify(payload)
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Create failed");
		await loadDemoSentences(data.sentence.id);
		if (!editForm.hidden) editElements().demoContentId.value = data.sentence.id;
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
	await fetch(apiUrl("/api/admin/logout"), { method: "POST" });
	window.location.href = "/admin/login";
});
