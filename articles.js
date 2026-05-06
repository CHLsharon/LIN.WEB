async function loadArticles() {
  const articleGrid = document.getElementById("articleGrid");

  try {
    const res = await fetch("/api/chat/articles");
    const data = await res.json();

    // ✅ 相容兩種後端格式：
    // 1. 直接回傳陣列：[...]
    // 2. 回傳物件：{ success: true, articles: [...] }
    const articles = Array.isArray(data) ? data : data.articles;

    if (!Array.isArray(articles)) {
      throw new Error("文章資料格式錯誤");
    }

    articleGrid.innerHTML = "";

    articles.forEach((article) => {
      const card = document.createElement("a");
      card.className = "reading-card";
      card.href = `article.html?id=${article._id}`;

      // 🔥 限制 summary 50 字
      let summary = article.summary || "";
      if (summary.length > 50) {
        summary = summary.slice(0, 50) + "...";
      }

      card.innerHTML = `
        <span>${article.category}</span>
        <h2>${article.title}</h2>
        <p>${summary}</p>
        <small>${article.level} · ${article.readingTime}</small>
      `;

      articleGrid.appendChild(card);
    });
  } catch (error) {
    console.error("Fetch error:", error);
    articleGrid.innerHTML = "<p>載入失敗，請確認資料庫連線或後端狀態!!</p>";
  }
}

loadArticles();