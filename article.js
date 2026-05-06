// ========================
// 基本設定
// ========================
function getArticleId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

let currentFontSize = 20;
let currentArticleTitle = "";
let selectedTextCache = "";
let isFocusMode = false;

// ========================
// 載入文章
// ========================
async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");

  const titleEl = document.getElementById("articleTitle");
  const contentEl = document.getElementById("articleContent");
  const currentArticleEl = document.getElementById("currentArticle");

  try {
    if (!articleId) {
      throw new Error("網址缺少文章 ID");
    }

    const res = await fetch(`/api/chat/articles/${articleId}`);
    const data = await res.json();

    console.log("單篇文章 API 回傳：", data);

    const article = data.article ? data.article : data;

    if (!res.ok || !article || !article.title) {
      throw new Error(data.error || data.message || "文章資料格式錯誤");
    }

    window.currentArticle = article;

    if (titleEl) {
      titleEl.textContent = article.title;
    }

    if (currentArticleEl) {
      currentArticleEl.textContent = article.title;
    }

    if (contentEl) {
      contentEl.textContent = article.content || "";
    }
  } catch (error) {
    console.error("載入單篇文章失敗：", error);

    if (titleEl) titleEl.textContent = "載入失敗";
    if (currentArticleEl) currentArticleEl.textContent = "載入失敗";
    if (contentEl) contentEl.textContent = "載入失敗";
  }
}

loadArticle();

// 整理整篇文章
async function summarizeArticle() {
  const articleBody = document.getElementById("articleBody");
  const aiResult = document.getElementById("aiResult");

  if (!articleBody) return;
  const text = articleBody.innerText.trim();
  if (!text) {
    aiResult.innerHTML = "文章內容為空，無法整理。";
    return;
  }

  aiResult.innerHTML = "AI 正在整理文章...";

  try {
    const res = await fetch("https://lin-web-red.vercel.app/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText: text,
        articleTitle: currentArticleTitle,
        mode: "summary" // 可以在後端判斷是否要做摘要
      })
    });

    const data = await res.json();
    aiResult.innerHTML =
      data.explanation?.replace(/\n/g, "<br>") || "AI 沒有回傳內容";
  } catch (err) {
    console.error(err);
    aiResult.innerHTML = "AI 整理失敗";
  }
}

// 使用者輸入問題 (聊天)
async function askAI() {
  const input = document.getElementById("aiQuestion");
  const aiResult = document.getElementById("aiResult");

  if (!input || !input.value.trim()) {
    aiResult.innerHTML += `<div class="chat-message system">請輸入問題或心得。</div>`;
    return;
  }

  const userMsg = input.value.trim();
  aiResult.innerHTML += `<div class="chat-message user">${userMsg}</div>`;
  input.value = "";

  try {
    const res = await fetch("https://lin-web-red.vercel.app/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText: userMsg,
        articleTitle: currentArticleTitle,
        mode: "chat" // 可以在後端判斷是否要做聊天
      })
    });

    const data = await res.json();
     aiResult.innerHTML += `<div class="chat-message ai">${data.explanation}</div>`;
  } catch (err) {
    console.error(err);
    aiResult.innerHTML += `<div class="chat-message system">AI 聊天失敗</div>`;
  }
}
// 存聊天內容到右側筆記
function saveChatToNote() {
  const aiResult = document.getElementById("aiResult");
  const noteBody = document.getElementById("noteBody");

  if (!aiResult || !noteBody) return;

  const chatText = aiResult.innerText.trim();
  if (!chatText) return;

  noteBody.innerHTML += `<br><br><b>[AI 助手回覆]</b><br>${chatText}`;
  document.getElementById("saveStatus").textContent = "已存到筆記";
}
// ========================
// 文章段落處理
// ========================
function formatArticleContent(content) {
  const safeContent = escapeHTML(content);

  return safeContent
    .replace(/([。！？!?])/g, "$1|")
    .split("|")
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "")
    .map((sentence) => `<p class="article-paragraph">${sentence}</p>`)
    .join("");
}
// ========================
// 字體
// ========================
function changeFontSize(size) {
  const articleBody = document.getElementById("articleBody");
  if (!articleBody) return;

  currentFontSize += size;

  if (currentFontSize < 20) currentFontSize = 20;
  if (currentFontSize > 36) currentFontSize = 36;

  articleBody.style.fontSize = currentFontSize + "px";
}

function changeFontFamily(font) {
  const articleBody = document.getElementById("articleBody");
  if (!articleBody) return;

  articleBody.style.fontFamily = font;
}

// ========================
// 語音
// ========================
function speakArticle() {
  const articleBody = document.getElementById("articleBody");
  const rateSelect = document.getElementById("rateSelect");

  if (!articleBody || !rateSelect) return;

  const text = articleBody.innerText.trim();
  if (!text) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = Number(rateSelect.value);

  speechSynthesis.speak(utterance);
}

function stopSpeak() {
  speechSynthesis.cancel();
}

// ========================
// AI：選取文字解釋
// ========================
// 一開始載入文章後自動摘要
async function summarizeArticleOnLoad() {
  const articleBody = document.getElementById("articleBody");
  const aiSummary = document.getElementById("aiSummary");

  if (!articleBody || !aiSummary) return;
  const text = articleBody.innerText.trim();
  if (!text) {
    aiSummary.innerHTML = "文章內容為空，無法整理。";
    return;
  }

  aiSummary.innerHTML = "AI 正在整理文章重點...";

  try {
    const res = await fetch("https://lin-web-red.vercel.app/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText: text,
        articleTitle: currentArticleTitle,
        mode: "summary",
        length: 50 // 指定摘要長度
      })
    });

    const data = await res.json();
    aiSummary.innerHTML =
      data.explanation?.replace(/\n/g, "<br>") || "AI 沒有回傳摘要";
  } catch (err) {
    console.error(err);
    aiSummary.innerHTML = "AI 整理失敗";
  }
}
// ========================
// AI：輸入問題 (已串接 Gemini 並同步儲存至後台)
// ========================
async function askAI() {
  const input = document.getElementById("aiQuestion");
  const aiResult = document.getElementById("aiResult");
  
  // 💡 取得當前使用者 ID 與文章 ID，以便後端存檔
  const userId = localStorage.getItem("userId"); 
  const articleId = getArticleId(); 

  if (!input || !input.value.trim()) {
    aiResult.innerHTML = "請輸入問題或選取文字。";
    return;
  }

  const userQuestion = input.value.trim();
  aiResult.innerHTML = "AI 正在思考中...";

  try {
    const res = await fetch("https://lin-web-red.vercel.app/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId,           // 💡 傳送使用者 ID
        articleId: articleId,     // 💡 傳送文章 ID
        selectedText: userQuestion,
        articleTitle: currentArticleTitle,
        mode: "chat"              // 💡 標記為對話模式
      })
    });

    const data = await res.json();
    
    // 💡 顯示 AI 回傳內容，並將斷行符號轉為網頁標籤
    aiResult.innerHTML = data.explanation?.replace(/\n/g, "<br>") || "AI 沒有回傳內容";
    
    // 清空輸入框
    input.value = "";
    
  } catch (err) {
    console.error("AI 請求失敗:", err);
    aiResult.innerHTML = "AI 暫時無法連線，請確保後端伺服器已啟動。";
  }
}

// 頁面切換功能保持不變
function switchLeftTab(tab) {
  const original = document.getElementById("originalContent");
  const ai = document.getElementById("aiContent");
  const tabs = document.querySelectorAll(".reader-tab");

  if (tab === "original") {
    original.classList.remove("hidden");
    ai.classList.add("hidden");
  } else if (tab === "ai") {
    ai.classList.remove("hidden");
    original.classList.add("hidden");
  }

  tabs.forEach(btn => btn.classList.remove("active"));
  const activeTab = document.querySelector(`.reader-tab[onclick*="${tab}"]`);
  if (activeTab) activeTab.classList.add("active");
}

// ========================
// 高亮模式：段落沉浸聚焦
// ========================
function toggleFocusMode() {
  const articleBody = document.getElementById("articleBody");
  const btn = document.getElementById("focusModeBtn");
  
  // 💡 取得分頁容器（請根據你的 HTML id 修改）
  const tabContainer = document.querySelector(".left-tabs-container"); 

  if (!articleBody || !btn) return;
  isFocusMode = !isFocusMode;

  // 💡 修正：只切換內容區的 class，不要影響到外層分頁
  articleBody.classList.toggle("focus-mode", isFocusMode);
  // 💡 如果你的 CSS 會導致標籤消失，可以在這裡強制控制它顯示
  if (tabContainer) {
    tabContainer.style.display = "flex"; 
  }
  btn.textContent = isFocusMode ? "高亮模式：開" : "高亮模式：關";
  if (!isFocusMode) {
    clearFocusedParagraph();
  }
}

function initParagraphFocus() {
  const articleBody = document.getElementById("articleBody");
  if (!articleBody) return;
// 點擊段落時聚焦
  articleBody.addEventListener("click", function (e) {
    const target = e.target.closest(".article-paragraph");
    if (!target) return;

    articleBody.querySelectorAll(".article-paragraph").forEach((p) => {
      p.classList.remove("focused");
    });

    target.classList.add("focused");

    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    e.stopPropagation();
  });

// 或者更簡單：在整個 document 上監聽
document.addEventListener("click", function (e) {
  const articleBody = document.getElementById("articleBody");
  if (!articleBody) return;

  // 如果點擊的不是段落，也不是 focusModeBtn，就清除聚焦
  if (!e.target.closest(".article-paragraph") &&
      !e.target.closest("#focusModeBtn")) {
    clearFocusedParagraph();
  }
});
}
function clearFocusedParagraph() {
  const articleBody = document.getElementById("articleBody");
  if (!articleBody) return;

  articleBody.querySelectorAll(".article-paragraph").forEach((p) => {
    p.classList.remove("focused");
  });
}

// ========================
// 安全
// ========================
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (tag) => {
    const chars = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return chars[tag] || tag;
  });
}
// ========================
// 筆記編輯器功能
// ========================

// 1. 螢光筆 (背景顏色)
function applyHighlight() {
    // 使用黃色作為預設螢光筆顏色
    document.execCommand('backColor', false, '#ffeb3b');
}

// 2. 套用文字顏色
function applyTextColor() {
    const color = document.getElementById('textColorPicker').value;
    document.execCommand('foreColor', false, color);
}

// 3. 底線
function underlineText() {
    document.execCommand('underline', false, null);
}

// 4. 清除格式
function clearFormat() {
    document.execCommand('removeFormat', false, null);
}

// 5. 調整筆記區全局字體大小
function applyGlobalStyle() {
    const fontSize = document.getElementById('noteFontSize').value;
    const noteBody = document.getElementById('noteBody');
    if (noteBody) {
        // 設定 inline style，這樣才能被封裝進 innerHTML
        noteBody.style.fontSize = fontSize;
    }
}


// 頁面加載後執行
async function initNoteData() {
  const userId = localStorage.getItem("userId"); // 假設你登入時有存 userId
  const articleId = getArticleId(); // 你原本就有的 function

  if (!userId || !articleId) return;

  try {
    const res = await fetch(`https://lin-web-red.vercel.app/notes/${userId}/${articleId}`);
    const data = await res.json();
    if (data.content) {
      // 將內容塞入你的筆記編輯區 (noteBody)
      document.getElementById("noteBody").innerHTML = data.content;
    }
  } catch (err) {
    console.error("載入舊筆記失敗", err);
  }
}

// 存檔功能 (修正：將字體大小樣式封裝進 HTML 字串中)
async function saveNote(isManual = false) {
  const userId = localStorage.getItem("userId");
  const articleId = getArticleId();
  const noteBody = document.getElementById("noteBody");

  if (!noteBody) return;

  // 讀取 innerHTML 時，字體大小資訊才會被當作字串內容存進資料庫
  const currentSize = noteBody.style.fontSize || "18px";
  const noteContent = `<div style="font-size: ${currentSize};">${noteBody.innerHTML}</div>`;

  if (!userId) {
    if (isManual) alert("請先登入才能存檔筆記");
    return;
  }

  try {
    const res = await fetch("https://lin-web-red.vercel.app/notes/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, articleId, content: noteContent })
    });
    
    if (res.ok && isManual) {
      alert("✅ 筆記存檔成功！");
    }
  } catch (err) {
    console.error("存檔失敗", err);
  }
}
// ========================
// 完成閱讀：向後端請求測驗題目
// ========================
async function startQuiz() {
  const modal = document.getElementById("quizModal");
  const questionText = document.getElementById("quizQuestion");
  const optionsContainer = document.getElementById("quizOptions");
  const feedback = document.getElementById("quizFeedback");

  // 取得當前文章資訊
  const articleTitle = document.getElementById("topArticleTitle")?.innerText || "未知文章";
  const articleContent = document.getElementById("articleContent")?.innerText || "";

  // 初始化彈窗狀態
  if (modal) modal.classList.remove("hidden");
  if (questionText) questionText.innerText = "AI 正在根據文章生成題目...";
  if (optionsContainer) optionsContainer.innerHTML = "";
  if (feedback) feedback.classList.add("hidden");

  try {
    // 比照 saveNote 的 fetch 格式向後端發送請求
    const res = await fetch("https://lin-web-red.vercel.app/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        articleTitle: articleTitle, 
        content: articleContent 
      })
    });

    if (!res.ok) throw new Error("網路請求失敗");

    const data = await res.json();
    const quiz = data.quiz;

    // 渲染題目與選項
    if (questionText) questionText.innerText = quiz.question;
    
    quiz.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.innerText = `${idx + 1}. ${opt}`;
      
      // 點擊選項後的邏輯
      btn.onclick = () => {
        if (feedback) {
          feedback.classList.remove("hidden");
          if (idx === quiz.correctIndex) {
            feedback.className = "quiz-feedback feedback-success";
            feedback.innerHTML = `<b>✅ 正確！</b><br>${quiz.explanation}`;
          } else {
            feedback.className = "quiz-feedback feedback-error";
            feedback.innerHTML = `<b>❌ 答錯了！</b><br>正確答案是：${quiz.options[quiz.correctIndex]}<br>${quiz.explanation}`;
          }
        }
      };
      optionsContainer.appendChild(btn);
    });

  } catch (err) {
    console.error("生成題目失敗", err);
    if (questionText) questionText.innerText = "❌ 題目生成失敗，請確認後端伺服器是否正常運作。";
  }
}

// 關閉彈窗函式
function closeQuiz() {
  const modal = document.getElementById("quizModal");
  if (modal) modal.classList.add("hidden");
}

// 在你的 loadArticle 或頁面初始化時呼叫
loadArticle().then(() => initNoteData());