
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

// Supabase connection
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Shortcuts
const $ = (id) => document.getElementById(id);

let currentPosts = [];
let currentUser = null;

// Escape HTML for safe display
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// Date formatting
function formatDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// Navigation
function showPage(name) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const page = $(name + "Page");

  if (page) {
    page.classList.add("active");
  }

  document.querySelectorAll("[data-page]").forEach(link => {
    link.classList.toggle(
      "active",
      link.dataset.page === name
    );
  });

  document.querySelector(".navbar nav")?.classList.remove("open");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// Messages
function showMessage(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

// Render writing card
function renderPostCard(post) {
  const isPoetry = ["Shayari", "Poetry"].includes(post.category);

  return `
    <article class="${isPoetry ? "poetry-card" : "post-card"}">
      <div class="${isPoetry ? "" : "post-details"}">

        <span class="post-category">
          ${escapeHTML(post.category)}
        </span>

        <h3>${escapeHTML(post.title)}</h3>

        <p>
          ${escapeHTML(
            post.excerpt || post.content.slice(0, 150)
          )}
        </p>

        <div class="post-meta">
          ${formatDate(post.created_at)}
        </div>

        <button class="read-more" data-open="${post.id}">
          Read more ↗
        </button>

      </div>
    </article>
  `;
}

// Render collections
function renderCollection(elementId, posts) {
  const element = $(elementId);
  if (!element) return;

  if (!posts.length) {
    element.innerHTML = `
      <div class="empty-state">
        <h3>Nothing here just yet ♡</h3>
        <p>New writings will find their way here soon.</p>
      </div>
    `;
    return;
  }

  element.innerHTML = posts.map(renderPostCard).join("");
}

// Load public writings
async function loadPublicPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,category,excerpt,content,created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Public posts error:", error.message);

    ["latestPosts", "blogPosts", "shayariPosts"].forEach(id => {
      const element = $(id);
      if (element) {
        element.innerHTML = `
          <div class="empty-state">
            Unable to load writings. Please try again later.
          </div>
        `;
      }
    });

    return;
  }

  currentPosts = data || [];

  const blogs = currentPosts.filter(post =>
    !["Shayari", "Poetry"].includes(post.category)
  );

  const poetry = currentPosts.filter(post =>
    ["Shayari", "Poetry"].includes(post.category)
  );

  renderCollection("latestPosts", currentPosts.slice(0, 3));
  renderCollection("blogPosts", blogs);
  renderCollection("shayariPosts", poetry);
}

// Open individual writing
function openPost(id) {
  const post = currentPosts.find(item => item.id === id);

  if (!post) return;

  $("readerContent").innerHTML = `
    <span class="post-category">
      ${escapeHTML(post.category)}
    </span>

    <h1>${escapeHTML(post.title)}</h1>

    <div class="post-meta">
      ${formatDate(post.created_at)}
    </div>

    <div class="reader-body">${escapeHTML(post.content)}</div>
  `;

  showPage("reader");
}

// Check author login
async function updateAuthUI() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Session error:", error.message);
  }

  currentUser = data?.session?.user || null;

  $("loginPanel")?.classList.toggle("hidden", !!currentUser);
  $("editorPanel")?.classList.toggle("hidden", !currentUser);
  $("logoutButton")?.classList.toggle("hidden", !currentUser);

  // Only authenticated author sees Write
  $("writeButton")?.classList.toggle("hidden", !currentUser);

  if (currentUser) {
    await loadMyPosts();
  }
}

// Author login
async function login(event) {
  event.preventDefault();

  showMessage("loginMessage", "Logging in...");

  const email = $("email").value.trim();
  const password = $("password").value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("loginMessage", error.message);
    return;
  }

  showMessage("loginMessage", "Welcome back, Nikita! ♡");

  await updateAuthUI();
}

// Author logout
async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  currentUser = null;

  $("postForm").reset();
  $("postId").value = "";

  await updateAuthUI();
  showPage("home");
}

// Load author's writings
async function loadMyPosts() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("myPosts").textContent = error.message;
    return;
  }

  $("myPosts").innerHTML = (data || []).map(post => `
    <div class="admin-post">

      <strong>${escapeHTML(post.title)}</strong>

      <small>
        ${escapeHTML(post.category)} ·
        ${post.is_published ? "Published" : "Draft"}
      </small>

      <div>
        <button data-edit="${post.id}">Edit</button>
        <button data-delete="${post.id}">Delete</button>
      </div>

    </div>
  `).join("") || "<p>No writings yet ♡</p>";
}

// Save or publish writing
async function savePost(publish) {
  if (!currentUser) {
    showMessage("editorMessage", "Please log in first.");
    return;
  }

  const title = $("postTitle").value.trim();
  const content = $("postContent").value.trim();

  if (!title || !content) {
    showMessage(
      "editorMessage",
      "Please enter a title and your writing."
    );
    return;
  }

  const id = $("postId").value;

  const postData = {
    title,
    category: $("postCategory").value,
    excerpt: $("postExcerpt").value.trim(),
    content,
    is_published: publish,
    updated_at: new Date().toISOString()
  };

  showMessage("editorMessage", "Saving your writing...");

  let result;

  if (id) {
    result = await supabase
      .from("posts")
      .update(postData)
      .eq("id", id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("posts")
      .insert(postData)
      .select()
      .single();
  }

  if (result.error) {
    showMessage("editorMessage", result.error.message);
    return;
  }

  showMessage(
    "editorMessage",
    publish
      ? "Your writing is published! ♡"
      : "Draft saved successfully! ♡"
  );

  $("postForm").reset();
  $("postId").value = "";

  await loadMyPosts();
  await loadPublicPosts();
}

// Edit writing
async function editPost(id) {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    showMessage("editorMessage", error.message);
    return;
  }

  $("postId").value = data.id;
  $("postTitle").value = data.title;
  $("postCategory").value = data.category;
  $("postExcerpt").value = data.excerpt || "";
  $("postContent").value = data.content;

  showMessage(
    "editorMessage",
    "Editing: " + data.title
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// Delete writing
async function deletePost(id) {
  if (!currentUser) return;

  const confirmed = confirm(
    "Are you sure you want to delete this writing?"
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadMyPosts();
  await loadPublicPosts();
}

// Navigation and post actions
document.addEventListener("click", event => {
  const pageLink = event.target.closest("[data-page]");

  if (pageLink) {
    event.preventDefault();

    const page = pageLink.dataset.page;
    showPage(page);

    if (page === "write") {
      updateAuthUI();
    }
  }

  const postLink = event.target.closest("[data-open]");

  if (postLink) {
    openPost(postLink.dataset.open);
  }

  const editButton = event.target.closest("[data-edit]");

  if (editButton) {
    editPost(editButton.dataset.edit);
  }

  const deleteButton = event.target.closest("[data-delete]");

  if (deleteButton) {
    deletePost(deleteButton.dataset.delete);
  }
});

// Mobile navigation
$("menuToggle")?.addEventListener("click", () => {
  document.querySelector(".navbar nav")?.classList.toggle("open");
});

// Write button
$("writeButton")?.addEventListener("click", async () => {
  if (!currentUser) {
    showPage("write");
    await updateAuthUI();
    return;
  }

  showPage("write");
  await updateAuthUI();
});

// Back button
$("backButton")?.addEventListener("click", () => {
  showPage("blogs");
});

// Login form
$("loginForm")?.addEventListener("submit", login);

// Logout button
$("logoutButton")?.addEventListener("click", logout);

// Publish form
$("postForm")?.addEventListener("submit", event => {
  event.preventDefault();
  savePost(true);
});

// Save draft
$("draftButton")?.addEventListener("click", () => {
  savePost(false);
});

// Footer year
$("year").textContent = new Date().getFullYear();

// Restore author session when authentication changes
supabase.auth.onAuthStateChange(() => {
  setTimeout(() => updateAuthUI(), 0);
});

// Initial loading
async function initializeWebsite() {
  await Promise.all([
    loadPublicPosts(),
    updateAuthUI()
  ]);

  // Private author entry URL
  const params = new URLSearchParams(window.location.search);

  if (params.get("author") === "1") {
    showPage("write");
  }
}

initializeWebsite();
