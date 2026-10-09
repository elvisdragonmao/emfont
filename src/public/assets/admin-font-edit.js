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
const regenerateButton = document.getElementById("font-regenerate-button");
const originalFilesList = document.getElementById("original-files-list");
const originalFilesInput = document.getElementById("original-files-input");
const originalFilesUpload = document.getElementById("original-files-upload");
const originalFilesRefresh = document.getElementById("original-files-refresh");

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
	renderDemoSentences(font.demoContentId || 1);
	previewLink.href = font.fontUrl;
	editForm.hidden = false;
	deleteButton.disabled = !isSuperAdmin();
	regenerateButton.disabled = !isSuperAdmin();
	renderFontList();
}

function renderOriginalFiles(files) {
	if (files.length === 0) {
		originalFilesList.innerHTML = `<p class="empty-state">找不到原始字型檔。</p>`;
		return;
	}
	const hashCounts = new Map();
	for (const file of files) {
		if (file.sha256)
			hashCounts.set(file.sha256, (hashCounts.get(file.sha256) || 0) + 1);
	}
	originalFilesList.innerHTML = `<table class="original-files-table">
		<thead><tr><th>檔案</th><th>SHA-256</th><th>內容</th><th>MinIO</th><th>本地</th></tr></thead>
		<tbody>${files
			.map(
				file => `<tr>
			<td>${escapeHtml(file.filename)}</td>
			<td><code title="${escapeHtml(file.sha256 || "尚未計算")}">${escapeHtml(file.sha256 || "尚未計算")}</code></td>
			<td>${file.sha256 ? (hashCounts.get(file.sha256) > 1 ? "與其他檔案相同" : "唯一") : "未知"}</td>
			<td>${file.minioExists ? "存在" : "缺少"}</td>
			<td>${file.localExists ? "存在" : "缺少"}</td>
		</tr>`,
			)
			.join("")}</tbody>
	</table>`;
}

async function loadOriginalFiles(fontId = selectedFontId) {
	if (!fontId || !originalFilesList) return;
	originalFilesList.innerHTML = `<p class="empty-state">正在檢查原始檔案...</p>`;
	const res = await fetch(
		`/api/admin/fonts/${encodeURIComponent(fontId)}/original-files`,
		{
			headers: headers(),
		},
	);
	if (redirectIfUnauthorized(res)) return;
	const data = await res.json();
	if (!res.ok) throw new Error(data.message || "Failed to load original files");
	renderOriginalFiles(data.files || []);
}

function parseOriginalFileName(name) {
	const match = name.match(/^(\d+)(?:-([1-9]\d*))?\.(ttf|otf)$/i);
	if (!match) throw new Error(`${name}：檔名須為 400.ttf 或 400-1.ttf`);
	return {
		name,
		weight: Number(match[1]),
		part: match[2] ? Number(match[2]) : 0,
		extension: match[3].toLowerCase(),
	};
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
	regenerateButton.disabled = true;
	previewLink.href = "#";
	await loadFontList();
	setStatus(`已刪除 ${fontId}`, "completed");
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
		await loadOriginalFiles(fontId);
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
		const formData = new FormData(editForm);
		const payload = Object.fromEntries(formData.entries());
		delete payload.id;

		const res = await fetch(`/api/admin/fonts/${encodeURIComponent(fontId)}`, {
			method: "PUT",
			headers: headers(),
			body: JSON.stringify(payload),
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Update failed");
		if (data.jobId) {
			setStatus("已儲存，正在重新切割靜態字型");
			const job = await pollJob(data.jobId);
			if (job?.status === "failed")
				throw new Error(job.error || "Static generation failed");
			setStatus("字型檔已更新，靜態字型也切好了", "completed");
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

originalFilesRefresh.addEventListener("click", async () => {
	try {
		await loadOriginalFiles();
	} catch (error) {
		setStatus(error.message, "failed");
	}
});
originalFilesUpload.addEventListener("click", async () => {
	const fontId = selectedFontId;
	const files = Array.from(originalFilesInput.files || []);
	if (files.length === 0)
		return setStatus("請選擇至少一個原始字型檔", "failed");
	originalFilesUpload.disabled = true;
	try {
		const uploads = files.map(file => ({
			...parseOriginalFileName(file.name),
			file,
		}));
		const names = new Set();
		for (const upload of uploads) {
			if (names.has(upload.name)) throw new Error(`檔案重複：${upload.name}`);
			names.add(upload.name);
		}
		setStatus("正在讀取原始字型檔");
		const payload = await Promise.all(
			uploads.map(async upload => ({
				name: upload.name,
				fileBase64: await fileToBase64(upload.file),
			})),
		);
		const res = await fetch(
			`/api/admin/fonts/${encodeURIComponent(fontId)}/original-files`,
			{
				method: "POST",
				headers: headers(),
				body: JSON.stringify({ files: payload }),
			},
		);
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Upload failed");
		setStatus("檔案已儲存，正在重新切割");
		const job = await pollJob(data.jobId);
		if (job?.status === "failed")
			throw new Error(job.error || "Static generation failed");
		originalFilesInput.value = "";
		// 如果目前頁籤已經跳到別頁，就不會刷新。否則就會進 if 重新載入這頁。理想中跳出檔案已儲存，正在重新切割就可以關閉頁面
		if (selectedFontId === fontId) await loadOriginalFiles(fontId);
		setStatus("原始檔案已更新，靜態字型也切好了", "completed");
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		originalFilesUpload.disabled = false;
	}
});

deleteButton.addEventListener("click", async () => {
	if (!selectedFontId) return;
	const fontId = selectedFontId;
	const confirmId = window.prompt(
		`這是不可逆操作，會刪除 ${fontId} 的資料庫紀錄、原始字型檔和已產生的靜態字型。\n\n請輸入字型 ID 確認刪除：`,
	);
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

regenerateButton.addEventListener("click", async () => {
	if (!selectedFontId) return;
	const fontId = selectedFontId;
	if (!window.confirm(`要重新生成 ${fontId} 的靜態字型和 CSS 嗎？`)) return;
	regenerateButton.disabled = true;
	setStatus("正在重新生成");
	try {
		const res = await fetch(
			`/api/admin/fonts/${encodeURIComponent(fontId)}/regenerate`,
			{
				method: "POST",
				headers: headers(),
				body: JSON.stringify({}),
			},
		);
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Regenerate failed");
		const job = await pollJob(data.jobId);
		if (job?.status === "failed")
			throw new Error(job.error || "Regeneration failed");
		setStatus("字型已重新生成，CSS 已更新", "completed");
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		regenerateButton.disabled = !isSuperAdmin();
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

Promise.all([loadAdminConfig(), loadFontList(), loadDemoSentences()]).catch(
	error => {
		setStatus(error.message, "failed");
	},
);

logoutButton.addEventListener("click", async () => {
	await fetch("/api/admin/logout", { method: "POST" });
	window.location.href = "/admin/login";
});
