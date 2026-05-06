async function loadArticles() {
  const articleGrid = document.getElementById("articleGrid");

  try {
    const res = await fetch("https://lin-web-red.vercel.app/articles");
    const articles = await res.json();

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
    articleGrid.innerHTML = "<p>載入失敗，請確認後端是否啟動</p>";
  }
}

loadArticles();