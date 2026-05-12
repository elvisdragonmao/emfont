const createForm = document.getElementById("admin-create-form");
const createStatusEl = document.getElementById("admin-create-status");
const listStatusEl = document.getElementById("admin-list-status");
const userListEl = document.getElementById("admin-user-list");
const logoutButton = document.getElementById("admin-logout");
const i18n = (key, values) =>
	typeof window.t === "function" ? window.t(key, values) : key;

let adminUsers = [];

function setCreateStatus(message, className = "") {
	createStatusEl.textContent = message;
	createStatusEl.className = className;
}

function setListStatus(message, className = "") {
	listStatusEl.textContent = message;
	listStatusEl.className = className;
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

function roleLabel(role) {
	return role === "super_admin" ? "Super admin" : i18n("admin.js.roleRegular");
}

function formatDate(value) {
	if (!value) return i18n("admin.js.neverLoggedIn");
	return new Intl.DateTimeFormat("zh-Hant", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
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

function renderAdminUsers() {
	userListEl.innerHTML = adminUsers
		.map(
			user => `<article class="admin-user-item">
				<div>
					<strong>${escapeHtml(user.userId)}</strong>
					<span>${escapeHtml(roleLabel(user.role))} | ${escapeHtml(i18n("admin.js.lastLogin"))}：${escapeHtml(formatDate(user.lastLogin))}</span>
				</div>
				<select data-user-id="${escapeHtml(user.userId)}" aria-label="${escapeHtml(i18n("admin.js.adjustRole", { userId: user.userId }))}">
					<option value="admin" ${user.role === "admin" ? "selected" : ""}>${escapeHtml(i18n("admin.js.roleRegular"))}</option>
					<option value="super_admin" ${user.role === "super_admin" ? "selected" : ""}>Super admin</option>
				</select>
			</article>`,
		)
		.join("");

	if (!userListEl.innerHTML) {
		userListEl.innerHTML = `<p class="empty-state">${escapeHtml(i18n("admin.js.emptyAdminList"))}</p>`;
	}
}

async function loadAdminUsers() {
	setListStatus(i18n("admin.generic.loading"));
	const res = await fetch("/api/admin/users", { headers: headers() });
	if (redirectIfUnauthorized(res)) return;
	const data = await res.json();
	if (!res.ok) throw new Error(data.message || "Failed to load admins");
	adminUsers = data;
	renderAdminUsers();
	setListStatus(i18n("admin.generic.loaded"), "completed");
}

createForm.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = createForm.querySelector("button[type=submit]");
	submit.disabled = true;
	setCreateStatus(i18n("admin.generic.creating"));
	try {
		const payload = Object.fromEntries(new FormData(createForm).entries());
		const res = await fetch("/api/admin/users", {
			method: "POST",
			headers: headers(),
			body: JSON.stringify(payload),
		});
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Create failed");
		createForm.reset();
		setCreateStatus(i18n("admin.generic.created"), "completed");
		await loadAdminUsers();
	} catch (error) {
		setCreateStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

userListEl.addEventListener("change", async event => {
	const select = event.target.closest("[data-user-id]");
	if (!select) return;
	const userId = select.dataset.userId;
	const role = select.value;
	select.disabled = true;
	setListStatus(i18n("admin.js.updatingRole"));
	try {
		const res = await fetch(
			`/api/admin/users/${encodeURIComponent(userId)}/role`,
			{
				method: "PATCH",
				headers: headers(),
				body: JSON.stringify({ role }),
			},
		);
		if (redirectIfUnauthorized(res)) return;
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Update failed");
		adminUsers = adminUsers.map(user =>
			user.userId === data.user.userId ? data.user : user,
		);
		renderAdminUsers();
		setListStatus(i18n("admin.js.roleUpdated"), "completed");
	} catch (error) {
		setListStatus(error.message, "failed");
		await loadAdminUsers();
	} finally {
		select.disabled = false;
	}
});

logoutButton.addEventListener("click", async () => {
	await fetch("/api/admin/logout", { method: "POST" });
	window.location.href = "/admin/login";
});

Promise.resolve(window.i18nReady).then(() => {
	document.title = i18n("admin.consoleTitle");
	loadAdminUsers().catch(error => {
		setListStatus(error.message, "failed");
	});
});
