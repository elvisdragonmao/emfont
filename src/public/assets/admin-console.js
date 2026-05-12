const createForm = document.getElementById("admin-create-form");
const createStatusEl = document.getElementById("admin-create-status");
const listStatusEl = document.getElementById("admin-list-status");
const userListEl = document.getElementById("admin-user-list");
const logoutButton = document.getElementById("admin-logout");

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
	return role === "super_admin" ? "Super admin" : "一般管理員";
}

function formatDate(value) {
	if (!value) return "尚未登入";
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
					<span>${escapeHtml(roleLabel(user.role))} | 最後登入：${escapeHtml(formatDate(user.lastLogin))}</span>
				</div>
				<select data-user-id="${escapeHtml(user.userId)}" aria-label="調整 ${escapeHtml(user.userId)} 的角色">
					<option value="admin" ${user.role === "admin" ? "selected" : ""}>一般管理員</option>
					<option value="super_admin" ${user.role === "super_admin" ? "selected" : ""}>Super admin</option>
				</select>
			</article>`,
		)
		.join("");

	if (!userListEl.innerHTML) {
		userListEl.innerHTML = `<p class="empty-state">尚未建立管理員。</p>`;
	}
}

async function loadAdminUsers() {
	setListStatus("正在載入");
	const res = await fetch("/api/admin/users", { headers: headers() });
	if (redirectIfUnauthorized(res)) return;
	const data = await res.json();
	if (!res.ok) throw new Error(data.message || "Failed to load admins");
	adminUsers = data;
	renderAdminUsers();
	setListStatus("已載入", "completed");
}

createForm.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = createForm.querySelector("button[type=submit]");
	submit.disabled = true;
	setCreateStatus("正在建立");
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
		setCreateStatus("已建立", "completed");
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
	setListStatus("正在更新角色");
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
		setListStatus("角色已更新", "completed");
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

loadAdminUsers().catch(error => {
	setListStatus(error.message, "failed");
});
