// ===== Supabase 初始化 =====
const supabaseClient = supabase.createClient(
  "https://your-project-url.supabase.co",
  "your-anon-key"
);

// ===== 全局变量 =====
let currentUser = null;
let currentBook = "";
let words = [];
let currentIndex = 0;

// ===== 用户数据 =====
function getAllUserData() {
  return JSON.parse(localStorage.getItem("userData")) || {};
}

function saveAllUserData(data) {
  localStorage.setItem("userData", JSON.stringify(data));
}

function getCurrentUserData() {
  const all = getAllUserData();
  return all[currentUser] || null;
}

function updateCurrentUserData(data) {
  const all = getAllUserData();
  all[currentUser] = data;
  saveAllUserData(all);
}

// ===== 页面切换 =====
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===== 登录（验证码模拟）=====
function loginWithCode() {
  const email = document.getElementById("email").value.trim();
  if (!email) return;

  currentUser = email;

  const all = getAllUserData();
  if (!all[email]) {
    all[email] = {
      points: 0,
      lastLoginDate: "",
      todayStudyDate: "",
      todayStudyCount: 0,
      learnedWordsToday: []
    };
    saveAllUserData(all);
  }

  handleLoginSuccess();
}

// ===== 登录成功 =====
function handleLoginSuccess() {
  if (!currentUser) return;

  const today = new Date().toLocaleDateString();
  const user = getCurrentUserData();

  if (user.lastLoginDate !== today) {
    user.points += 10;
    user.lastLoginDate = today;
  }

  if (user.todayStudyDate !== today) {
    user.todayStudyDate = today;
    user.todayStudyCount = 0;
    user.learnedWordsToday = [];
  }

  updateCurrentUserData(user);
  updateBookPage();
  showPage("bookPage");
}

// ===== 书本选择 =====
function selectBook(bookKey) {
  currentBook = bookKey;
  loadBookData(bookKey);
}

// ===== 加载数据 =====
async function loadBookData(bookKey) {
  try {
    const res = await fetch(`data/${bookKey}.json`);
    words = await res.json();

    currentIndex = 0;
    updateWordDisplay();

    document.getElementById("bookName").innerText = bookKey.toUpperCase();
    document.getElementById("totalWordsCount").innerText = words.length;

    showPage("studyPage");
  } catch (e) {
    alert("加载失败：" + e.message);
  }
}

// ===== 显示单词 =====
function updateWordDisplay() {
  if (!words.length) return;

  const w = words[currentIndex];

  document.getElementById("kana").innerText = w.kana || "";
  document.getElementById("kanji").innerText = w.kanji || "";
  document.getElementById("meaning").innerText = w.meaning || "";
  document.getElementById("exampleJa").innerText = w.exampleJa || "";
  document.getElementById("exampleZh").innerText = w.exampleZh || "";

  document.getElementById("currentWordIndex").innerText = currentIndex + 1;
}

// ===== 上一个 =====
function prevWord() {
  if (currentIndex > 0) {
    currentIndex--;
    updateWordDisplay();
  }
}

// ===== 下一个 =====
function nextWord() {
  if (currentIndex < words.length - 1) {
    currentIndex++;
    updateWordDisplay();
  }
}

// ===== 已学习 =====
function markLearned() {
  const user = getCurrentUserData();
  if (!user) return;

  user.todayStudyCount++;
  user.points += 1;

  updateCurrentUserData(user);

  document.getElementById("todayCount").innerText = user.todayStudyCount;
  document.getElementById("studyPoints").innerText = user.points;
}

// ===== 返回书本 =====
function backToBooks() {
  showPage("bookPage");
}

// ===== 更新书页 =====
function updateBookPage() {
  const user = getCurrentUserData();
  if (!user) return;

  document.getElementById("currentUser").innerText = currentUser;
  document.getElementById("userPoints").innerText = user.points;
}

// ===== 退出 =====
function logout() {
  currentUser = null;
  showPage("authPage");
}
