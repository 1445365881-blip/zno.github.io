const SUPABASE_URL = "https://qyiqpvwzqtdxlzvoluqs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aXFwdnd6cXRkeGx6dm9sdXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzEyMDIsImV4cCI6MjA4OTg0NzIwMn0.LAMfquKJFdWBqRupfkyRilNVpMSl3LkrmD5dIRmuHbM";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const bookNames = {
  n2: "N2单词书",
  n3: "N3单词书",
  n5: "N5基础单词",
  n4: "N4常用单词",
  daily: "日常会话单词"
};

let currentUser = null;
let currentBook = null;
let currentIndex = 0;
let reviewIndex = 0;
let reviewList = [];

let studySeconds = 0;
let studyTimerInterval = null;
let studySessionActive = false;
let rewardedTenMinuteBlocks = 0;

let voices = [];
let authMode = "otp";

/* =========================
   登录方式切换
========================= */

function switchAuthMode(mode) {
  authMode = mode;

  const otpAuthBox = document.getElementById("otpAuthBox");
  const passwordAuthBox = document.getElementById("passwordAuthBox");
  const otpModeBtn = document.getElementById("otpModeBtn");
  const passwordModeBtn = document.getElementById("passwordModeBtn");
  const authMsg = document.getElementById("authMsg");

  if (mode === "otp") {
    otpAuthBox.classList.remove("hidden");
    passwordAuthBox.classList.add("hidden");
    otpModeBtn.disabled = true;
    passwordModeBtn.disabled = false;
  } else {
    otpAuthBox.classList.add("hidden");
    passwordAuthBox.classList.remove("hidden");
    otpModeBtn.disabled = false;
    passwordModeBtn.disabled = true;
  }

  if (authMsg) authMsg.innerText = "";
}

/* =========================
   每个邮箱自己的本地学习数据
========================= */

function normalizeUser(user) {
  if (!user) return null;

  return {
    username: user.username || "",
    email: user.email || user.username || "",
    points: typeof user.points === "number" ? user.points : 0,
    favorites: Array.isArray(user.favorites) ? user.favorites : [],
    learnedWordsToday: Array.isArray(user.learnedWordsToday) ? user.learnedWordsToday : [],
    wrongWords: Array.isArray(user.wrongWords) ? user.wrongWords : [],
    lastLoginDate: user.lastLoginDate || "",
    todayStudyDate: user.todayStudyDate || "",
    todayStudyCount: typeof user.todayStudyCount === "number" ? user.todayStudyCount : 0,
    passwordSet: !!user.passwordSet
  };
}

function getCurrentUserData() {
  if (!currentUser) return null;

  const allUserData = JSON.parse(localStorage.getItem("userData")) || {};
  const userData = allUserData[currentUser];

  if (!userData) {
    const defaultUserData = {
      username: currentUser,
      email: currentUser,
      points: 0,
      favorites: [],
      learnedWordsToday: [],
      wrongWords: [],
      lastLoginDate: "",
      todayStudyDate: "",
      todayStudyCount: 0,
      passwordSet: false
    };

    allUserData[currentUser] = defaultUserData;
    localStorage.setItem("userData", JSON.stringify(allUserData));
    return defaultUserData;
  }

  return normalizeUser(userData);
}

function updateCurrentUserData(newData) {
  if (!currentUser) return;

  const allUserData = JSON.parse(localStorage.getItem("userData")) || {};
  const oldData = allUserData[currentUser] || {
    username: currentUser,
    email: currentUser,
    points: 0,
    favorites: [],
    learnedWordsToday: [],
    wrongWords: [],
    lastLoginDate: "",
    todayStudyDate: "",
    todayStudyCount: 0,
    passwordSet: false
  };

  allUserData[currentUser] = normalizeUser({
    ...oldData,
    ...newData,
    username: currentUser,
    email: currentUser
  });

  localStorage.setItem("userData", JSON.stringify(allUserData));
}

function sameWord(a, b) {
  return !!a && !!b && a.kana === b.kana && a.kanji === b.kanji;
}

/* =========================
   OTP 注册 / 登录
========================= */

async function sendEmailCode() {
  const email = document.getElementById("email").value.trim();
  const authMsg = document.getElementById("authMsg");

  if (!email) {
    authMsg.innerText = "请输入邮箱";
    return;
  }

  authMsg.innerText = "验证码发送中...";

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true
    }
  });

  if (error) {
    authMsg.innerText = "发送失败：" + error.message;
  } else {
    authMsg.innerText = "验证码已发送，请查看邮箱";
  }
}

async function loginWithCode() {
  const email = document.getElementById("email").value.trim();
  const code = document.getElementById("emailCode").value.trim();
  const authMsg = document.getElementById("authMsg");

  if (!email || !code) {
    authMsg.innerText = "请输入邮箱和验证码";
    return;
  }

  authMsg.innerText = "验证码校验中...";

  const { error } = await supabaseClient.auth.verifyOtp({
    email,
    token: code,
    type: "email"
  });

  if (error) {
    authMsg.innerText = "验证码错误：" + error.message;
    return;
  }

  currentUser = email;
  handleLoginSuccess();
  authMsg.innerText = "验证码登录成功";
  showPasswordModalIfNeeded();
}

/* =========================
   邮箱 + 密码登录
========================= */

async function loginWithEmailPassword() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const authMsg = document.getElementById("authMsg");

  if (!email || !password) {
    authMsg.innerText = "邮箱和密码不能为空";
    return;
  }

  authMsg.innerText = "登录中...";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authMsg.innerText = "登录失败：" + error.message;
    return;
  }

  currentUser = email;
  handleLoginSuccess();
  authMsg.innerText = "邮箱+密码登录成功";
  showPasswordModalIfNeeded();
}

/* =========================
   设置密码弹窗
========================= */
function showPasswordModalIfNeeded() {
  const user = getCurrentUserData();
  if (!user) return;

  const modal = document.getElementById("passwordModal");

  if (user.passwordSet) {
    modal.classList.add("hidden");
    return;
  }

  modal.classList.remove("hidden");
}

async function setPasswordFromModal() {
  const password = document.getElementById("modalPassword").value.trim();
  const msg = document.getElementById("modalMsg");
  const modal = document.getElementById("passwordModal");

  if (!password) {
    msg.innerText = "请输入密码";
    return;
  }

  if (password.length < 6) {
    msg.innerText = "至少6位";
    return;
  }

  msg.innerText = "保存中...";

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: password
    });

    if (error) {
      msg.innerText = "失败：" + error.message;
      return;
    }

    const user = getCurrentUserData();
    updateCurrentUserData({
      ...user,
      passwordSet: true
    });

    document.getElementById("modalPassword").value = "";
    msg.innerText = "设置成功！";

    setTimeout(() => {
      modal.classList.add("hidden");
      msg.innerText = "";
    }, 500);
  } catch (e) {
    msg.innerText = "失败：" + e.message;
  }
}
function closePasswordModal() {
  const modal = document.getElementById("passwordModal");
  const msg = document.getElementById("modalMsg");
  const input = document.getElementById("modalPassword");

  modal.classList.add("hidden");
  if (msg) msg.innerText = "";
  if (input) input.value = "";
}

/* =========================
   登录成功后的统一处理
========================= */

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

/* =========================
   语音初始化
========================= */

function loadVoices() {
  if ("speechSynthesis" in window) {
    voices = speechSynthesis.getVoices();
  }
}

if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

/* =========================
   页面与计时
========================= */

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add("active");
  }
}

function formatStudyTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

function updateStudyTimerDisplay() {
  const globalTimerEl = document.getElementById("globalStudyTimer");
  const rewardEl = document.getElementById("globalRewardCount");
  const globalBar = document.getElementById("globalStudyBar");

  if (globalBar) {
    if (studySessionActive) {
      globalBar.classList.remove("hidden");
    } else {
      globalBar.classList.add("hidden");
    }
  }

  if (globalTimerEl) {
    globalTimerEl.innerText = formatStudyTime(studySeconds);
  }

  if (rewardEl) {
    rewardEl.innerText = rewardedTenMinuteBlocks;
  }
}

function startStudySession() {
  studySessionActive = true;

  if (studyTimerInterval) {
    clearInterval(studyTimerInterval);
  }

  studyTimerInterval = setInterval(() => {
    studySeconds++;
    rewardStudyPointsIfNeeded();
    updateStudyTimerDisplay();
  }, 1000);

  updateStudyTimerDisplay();
}

function stopStudySession() {
  studySessionActive = false;

  if (studyTimerInterval) {
    clearInterval(studyTimerInterval);
    studyTimerInterval = null;
  }

  updateStudyTimerDisplay();
}

function resetStudySession() {
  studySeconds = 0;
  rewardedTenMinuteBlocks = 0;
  updateStudyTimerDisplay();
}

function rewardStudyPointsIfNeeded() {
  if (!currentUser) return;

  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  const completedBlocks = Math.floor(studySeconds / 600);

  if (completedBlocks > rewardedTenMinuteBlocks) {
    const newBlocks = completedBlocks - rewardedTenMinuteBlocks;
    const rewardPoints = newBlocks * 20;

    user.points += rewardPoints;
    rewardedTenMinuteBlocks = completedBlocks;

    updateCurrentUserData(user);
    updateBookPage();
    updateStudyPage();

    const studyMsg = document.getElementById("studyMsg");
    if (studyMsg) {
      studyMsg.innerText = `学习满 ${completedBlocks * 10} 分钟，已奖励 ${rewardPoints} 积分！`;
    }
  }

  updateStudyTimerDisplay();
}

async function logout() {
  stopStudySession();
  resetStudySession();

  await supabaseClient.auth.signOut();

  currentUser = null;
  currentBook = null;
  currentIndex = 0;
  reviewIndex = 0;
  reviewList = [];

  const authMsg = document.getElementById("authMsg");
  if (authMsg) authMsg.innerText = "";

  showPage("authPage");
}

function updateBookPage() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  document.getElementById("currentUser").innerText = user.username;
  document.getElementById("userPoints").innerText = user.points;
  updateStudyTimerDisplay();
}

/* =========================
   学习
========================= */

async function selectBook(bookKey) {
  try {
    if (!books[bookKey] || books[bookKey].length === 0) {
      await loadBookData(bookKey);
    }

    if (!Array.isArray(books[bookKey]) || books[bookKey].length === 0) {
      alert("这本单词书目前是空的");
      return;
    }

    currentBook = bookKey;
    currentIndex = 0;

    document.getElementById("bookName").innerText = bookNames[bookKey] || bookKey;

    resetStudySession();
    startStudySession();

    updateStudyPage();
    showWord();
    showPage("studyPage");
  } catch (error) {
    alert("加载单词书失败：" + error.message);
    console.error(error);
  }
}

let books = {
  n2: [],
  n3: [],
  n5: [],
  n4: [],
  daily: []
};

async function loadBookData(bookKey) {
  const response = await fetch(`data/${bookKey}.json`);
  if (!response.ok) {
    throw new Error(`加载 ${bookKey}.json 失败`);
  }
  const data = await response.json();
  books[bookKey] = data;
}


function updateStudyPage() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  document.getElementById("todayCount").innerText = user.todayStudyCount;
  document.getElementById("studyPoints").innerText = user.points;

  const totalWords = currentBook && books[currentBook] ? books[currentBook].length : 0;
  document.getElementById("totalWordsCount").innerText = totalWords;
  document.getElementById("currentWordIndex").innerText = totalWords > 0 ? currentIndex + 1 : 0;

  const voiceBtn = document.getElementById("voiceBtn");
  if (voiceBtn) {
    voiceBtn.style.display = user.points >= 100 ? "inline-block" : "none";
  }

  const exampleVoiceBtn = document.getElementById("exampleVoiceBtn");
  if (exampleVoiceBtn) {
    exampleVoiceBtn.style.display = user.points >= 100 ? "inline-block" : "none";
  }

  const wordAndExampleBtn = document.getElementById("wordAndExampleVoiceBtn");
  if (wordAndExampleBtn) {
    wordAndExampleBtn.style.display = user.points >= 100 ? "inline-block" : "none";
  }

  updateStudyTimerDisplay();
}

function showWord() {
  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) {
    const studyMsg = document.getElementById("studyMsg");
    if (studyMsg) studyMsg.innerText = "当前单词书没有数据";
    return;
  }

  const word = books[currentBook][currentIndex];

  document.getElementById("kana").innerText = word.kana || "";
  document.getElementById("kanji").innerText = word.kanji || "（无汉字）";
  document.getElementById("meaning").innerText = word.meaning || "";

  const exampleJa = (word.exampleJa || "").trim();
  const exampleZh = (word.exampleZh || "").trim();

  const exampleSection = document.getElementById("exampleSection");
  const exampleJaEl = document.getElementById("exampleJa");
  const exampleZhEl = document.getElementById("exampleZh");

  if (exampleSection && exampleJaEl && exampleZhEl) {
    if (exampleJa || exampleZh) {
      exampleSection.classList.remove("hidden");
      exampleJaEl.innerText = exampleJa || "暂无日语例句";
      exampleZhEl.innerText = exampleZh || "暂无中文翻译";
    } else {
      exampleSection.classList.add("hidden");
      exampleJaEl.innerText = "";
      exampleZhEl.innerText = "";
    }
  }

  const exampleVoiceBtn = document.getElementById("exampleVoiceBtn");
  if (exampleVoiceBtn) {
    exampleVoiceBtn.style.display = exampleJa ? "inline-block" : "none";
  }

  const wordAndExampleBtn = document.getElementById("wordAndExampleVoiceBtn");
  if (wordAndExampleBtn) {
    wordAndExampleBtn.style.display = exampleJa ? "inline-block" : "none";
  }

  document.getElementById("currentWordIndex").innerText = currentIndex + 1;
  document.getElementById("totalWordsCount").innerText = books[currentBook].length;
}

function prevWord() {
  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) return;

  currentIndex--;
  if (currentIndex < 0) {
    currentIndex = books[currentBook].length - 1;
  }

  showWord();
  updateStudyPage();
}

function nextWord() {
  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) return;

  currentIndex++;
  if (currentIndex >= books[currentBook].length) {
    currentIndex = 0;
  }

  showWord();
  updateStudyPage();
}

function markLearned() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) {
    alert("请先登录");
    return;
  }

  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) return;

  if (user.todayStudyCount >= 100) {
    document.getElementById("studyMsg").innerText = "今天已经学满 100 个单词了";
    return;
  }

  user.todayStudyCount += 1;

  if (user.todayStudyCount % 20 === 0) {
    user.points += 20;
    document.getElementById("studyMsg").innerText = "已学习，奖励 20 积分";
  } else {
    document.getElementById("studyMsg").innerText = "已学习，自动进入下一个单词";
  }

  updateCurrentUserData(user);

  currentIndex++;
  if (currentIndex >= books[currentBook].length) {
    currentIndex = 0;
  }

  updateBookPage();
  updateStudyPage();
  showWord();
}

function addToFavorites() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) {
    alert("请先登录");
    return;
  }

  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) return;

  const word = books[currentBook][currentIndex];
  const exists = user.favorites.some(item => sameWord(item, word));

  if (!exists) {
    user.favorites.push(word);
    updateCurrentUserData(user);
    updateBookPage();
    updateStudyPage();
    document.getElementById("studyMsg").innerText = "已加入收藏夹";
  } else {
    document.getElementById("studyMsg").innerText = "这个单词已经在收藏夹里了";
  }
}

function goToFavorites() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  const list = document.getElementById("favoriteList");
  list.innerHTML = "";

  if (user.favorites.length === 0) {
    list.innerHTML = "<li>暂无收藏单词</li>";
  } else {
    user.favorites.forEach(word => {
      const li = document.createElement("li");
      li.innerText = `${word.kana}${word.kanji ? "（" + word.kanji + "）" : ""} - ${word.meaning}`;
      list.appendChild(li);
    });
  }

  showPage("favoritesPage");
  updateStudyTimerDisplay();
}

function backToBooks() {
  updateBookPage();
  showPage("bookPage");
  updateStudyTimerDisplay();
}

/* =========================
   复习
========================= */

function goToReview() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  const learnedWords = user.learnedWordsToday || [];
  const wrongWords = user.wrongWords || [];

  reviewList = [...wrongWords];

  learnedWords.forEach(word => {
    const exists = reviewList.some(item => sameWord(item, word));
    if (!exists) {
      reviewList.push(word);
    }
  });

  if (reviewList.length === 0) {
    document.getElementById("reviewMeaning").innerText = "暂无需要复习的单词";
    document.getElementById("reviewAnswer").innerText = "";
    document.getElementById("reviewMsg").innerText = "";
    showPage("reviewPage");
    return;
  }

  reviewIndex = 0;
  showReviewWord();
  showPage("reviewPage");
}

function showReviewWord() {
  const word = reviewList[reviewIndex];

  if (!word) {
    document.getElementById("reviewMeaning").innerText = "今天复习完成";
    document.getElementById("reviewAnswer").innerText = "";
    document.getElementById("reviewMsg").innerText = "";
    return;
  }

  document.getElementById("reviewMeaning").innerText = word.meaning;
  document.getElementById("reviewInput").value = "";
  document.getElementById("reviewAnswer").innerText = "";
  document.getElementById("reviewMsg").innerText = "";
}

function checkReview() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  const word = reviewList[reviewIndex];
  const input = document.getElementById("reviewInput").value.trim();

  if (!word) return;

  if (input === word.kana || input === word.kanji) {
    user.wrongWords = user.wrongWords.filter(item => !sameWord(item, word));
    updateCurrentUserData(user);

    document.getElementById("reviewMsg").innerText = "回答正确，进入下一个";
    reviewIndex++;

    if (reviewIndex >= reviewList.length) {
      document.getElementById("reviewMeaning").innerText = "今天复习完成";
      document.getElementById("reviewAnswer").innerText = "";
      document.getElementById("reviewMsg").innerText = "很好，今天的复习结束了";
      return;
    }

    setTimeout(() => {
      showReviewWord();
    }, 800);
  } else {
    const exists = user.wrongWords.some(item => sameWord(item, word));
    if (!exists) {
      user.wrongWords.push(word);
      updateCurrentUserData(user);
    }

    document.getElementById("reviewMsg").innerText = "回答错误，可以查看答案";
  }
}

function showAnswer() {
  const word = reviewList[reviewIndex];
  if (!word) return;

  const exampleJa = (word.exampleJa || "").trim();
  const exampleZh = (word.exampleZh || "").trim();

  let html = `
    假名：${word.kana}<br>
    汉字：${word.kanji || "无"}<br>
    中文：${word.meaning || ""}<br>
  `;

  if (exampleJa || exampleZh) {
    html += `
      例句：${exampleJa || "暂无日语例句"}<br>
      例句中文：${exampleZh || "暂无中文翻译"}
    `;
  }

  document.getElementById("reviewAnswer").innerHTML = html;
}

function skipReview() {
  if (reviewList.length === 0) return;

  reviewIndex++;

  if (reviewIndex >= reviewList.length) {
    document.getElementById("reviewMeaning").innerText = "今天复习完成";
    document.getElementById("reviewAnswer").innerText = "";
    document.getElementById("reviewMsg").innerText = "已跳过到最后";
    return;
  }

  showReviewWord();
}

function backToStudy() {
  updateStudyPage();
  showPage("studyPage");
}

/* =========================
   语音
========================= */

function speakWord() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  if (user.points < 100) {
    alert("积分未达到 100，暂未解锁语音功能");
    return;
  }

  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) return;

  const word = books[currentBook][currentIndex];
  const text = word.kanji || word.kana;

  const utterance = new SpeechSynthesisUtterance(text);
  const jpVoice = voices.find(v => v.lang === "ja-JP");

  if (jpVoice) {
    utterance.voice = jpVoice;
  } else {
    alert("没有找到日语语音，请先在系统里安装日语语音包");
  }

  utterance.lang = "ja-JP";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function speakExample() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  if (user.points < 100) {
    alert("积分未达到 100，暂未解锁语音功能");
    return;
  }

  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) return;

  const word = books[currentBook][currentIndex];
  const text = (word.exampleJa || "").trim();

  if (!text) {
    alert("当前单词暂无日语例句");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const jpVoice = voices.find(v => v.lang === "ja-JP");

  if (jpVoice) {
    utterance.voice = jpVoice;
  } else {
    alert("没有找到日语语音，请先在系统里安装日语语音包");
  }

  utterance.lang = "ja-JP";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function speakWordAndExample() {
  const user = normalizeUser(getCurrentUserData());
  if (!user) return;

  if (user.points < 100) {
    alert("积分未达到 100，暂未解锁语音功能");
    return;
  }

  if (!currentBook || !books[currentBook] || books[currentBook].length === 0) return;

  const word = books[currentBook][currentIndex];
  const wordText = word.kanji || word.kana;
  const exampleText = (word.exampleJa || "").trim();
  const jpVoice = voices.find(v => v.lang === "ja-JP");

  speechSynthesis.cancel();

  const utterance1 = new SpeechSynthesisUtterance(wordText);
  utterance1.lang = "ja-JP";
  utterance1.rate = 0.9;
  utterance1.pitch = 1;
  if (jpVoice) utterance1.voice = jpVoice;

  if (!exampleText) {
    speechSynthesis.speak(utterance1);
    return;
  }

  const utterance2 = new SpeechSynthesisUtterance(exampleText);
  utterance2.lang = "ja-JP";
  utterance2.rate = 0.9;
  utterance2.pitch = 1;
  if (jpVoice) utterance2.voice = jpVoice;

  utterance1.onend = () => {
    speechSynthesis.speak(utterance2);
  };

  speechSynthesis.speak(utterance1);
}

/* =========================
   页面加载后恢复登录
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  switchAuthMode("otp");

  const { data } = await supabaseClient.auth.getSession();

  if (data && data.session && data.session.user) {
    currentUser = data.session.user.email;
    handleLoginSuccess();
  }
});
