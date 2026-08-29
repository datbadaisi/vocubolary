// ==========================================
// CEFR VOCABULARY APPLICATION JAVASCRIPT
// ==========================================

// Global State
let vocabData = window.VOCAB_DATA || [];
let filteredList = [];
let currentPage = 1;
let pageSize = 50;

let currentLevel = 'ALL';
let currentPOS = 'ALL';
let currentSort = 'az';
let searchQuery = '';
let showFavoritesOnly = false;

// Favorites saved in LocalStorage
let favorites = new Set(JSON.parse(localStorage.getItem('cefr_favs') || '[]'));

// Flashcard State
let fcList = [];
let fcIndex = 0;
let currentFcWord = null;
let isFlipped = false;

// Quiz State
let quizList = [];
let quizIndex = 0;
let currentQuizItem = null;
let quizCorrect = 0;
let quizWrong = 0;
let quizAnswered = false;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateChipCounts();
  updateFavBadge();
  applyFilters();
});

// ==========================================
// THEME & FAVORITES MANAGEMENT
// ==========================================
function initTheme() {
  const isDark = localStorage.getItem('cefr_theme') === 'dark' || 
    (!localStorage.getItem('cefr_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('cefr_theme', isDark ? 'dark' : 'light');
}

function toggleFavorite(id, event) {
  if (event) event.stopPropagation();
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  localStorage.setItem('cefr_favs', JSON.stringify(Array.from(favorites)));
  updateFavBadge();
  
  // Update heart icons in UI
  const btns = document.querySelectorAll(`[data-fav-id="${id}"]`);
  btns.forEach(btn => {
    if (favorites.has(id)) {
      btn.innerHTML = '<i class="fa-solid fa-star text-amber-500"></i>';
      btn.classList.add('text-amber-500');
    } else {
      btn.innerHTML = '<i class="fa-regular fa-star"></i>';
      btn.classList.remove('text-amber-500');
    }
  });

  if (showFavoritesOnly) {
    applyFilters();
  }
}

function updateFavBadge() {
  const badge = document.getElementById('fav-count-badge');
  const count = favorites.size;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function toggleFavoriteFilter() {
  showFavoritesOnly = !showFavoritesOnly;
  const btn = document.getElementById('btn-fav-header');
  if (showFavoritesOnly) {
    btn.classList.add('bg-amber-50', 'dark:bg-amber-950/50', 'text-amber-500', 'border-amber-200');
    switchMode('dict');
  } else {
    btn.classList.remove('bg-amber-50', 'dark:bg-amber-950/50', 'text-amber-500', 'border-amber-200');
  }
  applyFilters();
}

// ==========================================
// AUDIO SYNTHESIS
// ==========================================
function speakWord(text, event) {
  if (event) event.stopPropagation();
  if (!('speechSynthesis' in window)) {
    alert('Trình duyệt của bạn không hỗ trợ phát âm tự động.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// ==========================================
// MODE SWITCHING
// ==========================================
function switchMode(mode) {
  document.getElementById('view-dict').classList.add('hidden');
  document.getElementById('view-flashcard').classList.add('hidden');
  document.getElementById('view-quiz').classList.add('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
  });

  const activeClass = 'tab-btn px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm';

  if (mode === 'dict') {
    document.getElementById('view-dict').classList.remove('hidden');
    document.getElementById('tab-dict').className = activeClass;
  } else if (mode === 'flashcard') {
    document.getElementById('view-flashcard').classList.remove('hidden');
    document.getElementById('tab-flashcard').className = activeClass;
    initFlashcards();
  } else if (mode === 'quiz') {
    document.getElementById('view-quiz').classList.remove('hidden');
    document.getElementById('tab-quiz').className = activeClass;
    document.getElementById('quiz-setup-card').classList.remove('hidden');
    document.getElementById('quiz-active-card').classList.add('hidden');
    document.getElementById('quiz-result-card').classList.add('hidden');
  }
}

// ==========================================
// DICTIONARY & FILTER LOGIC
// ==========================================
function updateChipCounts() {
  const counts = { ALL: vocabData.length, A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  vocabData.forEach(item => {
    if (counts[item.level] !== undefined) counts[item.level]++;
  });
  Object.keys(counts).forEach(lvl => {
    const el = document.getElementById(`chip-count-${lvl}`);
    if (el) el.textContent = `(${counts[lvl].toLocaleString('vi-VN')})`;
  });
}

function setLevelFilter(lvl) {
  currentLevel = lvl;
  showFavoritesOnly = false;
  document.getElementById('btn-fav-header').classList.remove('bg-amber-50', 'dark:bg-amber-950/50', 'text-amber-500', 'border-amber-200');

  document.querySelectorAll('.level-chip').forEach(btn => {
    if (btn.dataset.lvl === lvl) {
      btn.className = 'level-chip active px-3 py-1.5 rounded-lg border transition-all shrink-0 bg-brand-600 border-brand-600 text-white shadow-sm';
    } else {
      btn.className = 'level-chip px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all shrink-0';
    }
  });

  applyFilters();
}

function onSearchChange() {
  searchQuery = document.getElementById('search-input').value.trim().toLowerCase();
  const clearBtn = document.getElementById('clear-search-btn');
  if (searchQuery) {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }
  applyFilters();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  searchQuery = '';
  document.getElementById('clear-search-btn').classList.add('hidden');
  applyFilters();
}

function onFilterChange() {
  currentPOS = document.getElementById('pos-filter').value;
  currentSort = document.getElementById('sort-filter').value;
  applyFilters();
}

function onPageSizeChange() {
  pageSize = parseInt(document.getElementById('page-size').value, 10);
  currentPage = 1;
  renderCurrentPage();
}

function resetFilters() {
  currentLevel = 'ALL';
  currentPOS = 'ALL';
  currentSort = 'az';
  searchQuery = '';
  showFavoritesOnly = false;
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search-btn').classList.add('hidden');
  document.getElementById('pos-filter').value = 'ALL';
  document.getElementById('sort-filter').value = 'az';
  setLevelFilter('ALL');
}

function applyFilters() {
  currentPage = 1;
  
  filteredList = vocabData.filter(item => {
    // Level filter
    if (currentLevel !== 'ALL' && item.level !== currentLevel) return false;
    
    // Favorites filter
    if (showFavoritesOnly && !favorites.has(item.id)) return false;
    
    // POS filter
    if (currentPOS !== 'ALL') {
      const posLower = item.pos.toLowerCase();
      if (currentPOS === 'phrasal' && !posLower.includes('phrasal')) return false;
      if (currentPOS !== 'phrasal' && !posLower.includes(currentPOS)) return false;
    }
    
    // Search query filter
    if (searchQuery) {
      const w = item.word.toLowerCase();
      const m = item.meaning.toLowerCase();
      const ipa = item.ipa.toLowerCase();
      const exEn = (item.example_en || '').toLowerCase();
      const exVi = (item.example_vi || '').toLowerCase();
      return w.includes(searchQuery) || m.includes(searchQuery) || ipa.includes(searchQuery) || exEn.includes(searchQuery) || exVi.includes(searchQuery);
    }
    
    return true;
  });

  // Sort
  if (currentSort === 'az') {
    filteredList.sort((a, b) => a.word.localeCompare(b.word));
  } else if (currentSort === 'za') {
    filteredList.sort((a, b) => b.word.localeCompare(a.word));
  } else if (currentSort === 'level') {
    const lvlOrder = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
    filteredList.sort((a, b) => (lvlOrder[a.level] || 0) - (lvlOrder[b.level] || 0) || a.word.localeCompare(b.word));
  } else if (currentSort === 'random') {
    filteredList.sort(() => Math.random() - 0.5);
  }

  // Update counter UI
  document.getElementById('results-count').textContent = filteredList.length.toLocaleString('vi-VN');
  
  const filterLabel = document.getElementById('active-filter-label');
  if (showFavoritesOnly) {
    filterLabel.textContent = `(Đang lọc: ⭐ Đã lưu)`;
  } else if (currentLevel !== 'ALL') {
    filterLabel.textContent = `(Đang lọc: Cấp độ ${currentLevel})`;
  } else {
    filterLabel.textContent = '';
  }

  renderCurrentPage();
}

function getLevelBadgeClass(lvl) {
  switch (lvl) {
    case 'A1': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'A2': return 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border-teal-200 dark:border-teal-800';
    case 'B1': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'B2': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    case 'C1': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'C2': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  }
}

function renderCurrentPage() {
  const container = document.getElementById('vocab-container');
  const emptyState = document.getElementById('empty-state');
  const paginationContainer = document.getElementById('pagination-container');

  if (filteredList.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    paginationContainer.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  paginationContainer.classList.remove('hidden');

  const totalPages = Math.ceil(filteredList.length / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredList.length);
  const pageItems = filteredList.slice(startIdx, endIdx);

  // Render cards
  container.innerHTML = pageItems.map((item, idx) => {
    const isFav = favorites.has(item.id);
    const badgeClass = getLevelBadgeClass(item.level);

    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 hover:border-brand-500/40 dark:hover:border-brand-500/40 hover:shadow-md transition-all flex flex-col justify-between group">
        <div>
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-3 mb-2.5">
            <div class="flex items-baseline gap-2 flex-wrap">
              <h3 class="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                ${item.word}
              </h3>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                ${item.pos}
              </span>
              <span class="font-mono text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                ${item.ipa}
              </span>
            </div>

            <!-- Actions: Audio + Favorite + Level Badge -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="speakWord('${item.word.replace(/'/g, "\\'")}', event)" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 text-xs transition-colors" title="Nghe phát âm">
                <i class="fa-solid fa-volume-high"></i>
              </button>
              
              <button onclick="toggleFavorite(${item.id}, event)" data-fav-id="${item.id}" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-slate-700 flex items-center justify-center ${isFav ? 'text-amber-500' : 'text-slate-400'} text-xs transition-colors" title="Đánh dấu từ">
                <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
              </button>

              <span class="text-xs font-bold px-2 py-1 rounded-lg border ${badgeClass}">
                ${item.level}
              </span>
            </div>
          </div>

          <!-- Meaning -->
          <p class="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">
            ${item.meaning}
          </p>
        </div>

        <!-- Example Box -->
        ${item.example_en ? `
          <div class="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs sm:text-sm space-y-1">
            <p class="text-slate-700 dark:text-slate-300 italic font-medium">
              "${item.example_en}"
            </p>
            ${item.example_vi ? `
              <p class="text-slate-400 dark:text-slate-500">
                (${item.example_vi})
              </p>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Update Pagination Info
  const pageInfoStr = `Hiển thị từ <strong>${startIdx + 1}</strong> đến <strong>${endIdx}</strong> (Tổng <strong>${filteredList.length.toLocaleString('vi-VN')}</strong> từ)`;
  document.getElementById('pagination-info-bottom').innerHTML = pageInfoStr;
  document.getElementById('pagination-info-top').innerHTML = `Trang ${currentPage} / ${totalPages}`;

  // Render pagination buttons
  renderPaginationButtons(totalPages);
}

function renderPaginationButtons(totalPages) {
  const container = document.getElementById('pagination-buttons');
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  
  // Previous Button
  html += `
    <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
      class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Page Numbers
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `<button onclick="goToPage(1)" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">1</button>`;
    if (startPage > 2) html += `<span class="px-1 text-slate-400">...</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    if (p === currentPage) {
      html += `<button class="px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs sm:text-sm font-bold shadow-sm">${p}</button>`;
    } else {
      html += `<button onclick="goToPage(${p})" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">${p}</button>`;
    }
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="px-1 text-slate-400">...</span>`;
    html += `<button onclick="goToPage(${totalPages})" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">${totalPages}</button>`;
  }

  // Next Button
  html += `
    <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
      class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  container.innerHTML = html;
}

function goToPage(p) {
  currentPage = p;
  renderCurrentPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// FLASHCARD MODE LOGIC
// ==========================================
function initFlashcards() {
  const selectedLvl = document.getElementById('fc-level-select').value;
  if (selectedLvl === 'FAV') {
    fcList = vocabData.filter(item => favorites.has(item.id));
  } else if (selectedLvl === 'ALL') {
    fcList = [...vocabData];
  } else {
    fcList = vocabData.filter(item => item.level === selectedLvl);
  }

  if (fcList.length === 0) {
    alert('Không có từ vựng nào trong danh mục đã chọn.');
    document.getElementById('fc-level-select').value = 'ALL';
    fcList = [...vocabData];
  }

  // Shuffle initially
  fcList.sort(() => Math.random() - 0.5);
  fcIndex = 0;
  loadFlashcard(fcIndex);
}

function loadFlashcard(idx) {
  if (idx < 0) idx = fcList.length - 1;
  if (idx >= fcList.length) idx = 0;
  fcIndex = idx;
  currentFcWord = fcList[fcIndex];

  // Reset Flip State
  isFlipped = false;
  document.getElementById('fc-card').classList.remove('rotate-y-180');

  // Update UI Elements
  document.getElementById('fc-counter').textContent = `${fcIndex + 1} / ${fcList.length}`;
  document.getElementById('fc-progress').style.width = `${((fcIndex + 1) / fcList.length) * 100}%`;

  // Front
  document.getElementById('fc-front-level').textContent = currentFcWord.level;
  document.getElementById('fc-front-word').textContent = currentFcWord.word;
  document.getElementById('fc-front-pos').textContent = currentFcWord.pos;
  document.getElementById('fc-front-ipa').textContent = currentFcWord.ipa;

  // Back
  document.getElementById('fc-back-level').textContent = currentFcWord.level;
  document.getElementById('fc-back-pos').textContent = currentFcWord.pos;
  document.getElementById('fc-back-meaning').textContent = currentFcWord.meaning;
  document.getElementById('fc-back-ex-en').textContent = currentFcWord.example_en ? `"${currentFcWord.example_en}"` : '';
  document.getElementById('fc-back-ex-vi').textContent = currentFcWord.example_vi ? `(${currentFcWord.example_vi})` : '';
}

function flipFlashcard() {
  isFlipped = !isFlipped;
  const card = document.getElementById('fc-card');
  if (isFlipped) {
    card.classList.add('rotate-y-180');
  } else {
    card.classList.remove('rotate-y-180');
  }
}

function nextFlashcard() {
  loadFlashcard(fcIndex + 1);
}

function prevFlashcard() {
  loadFlashcard(fcIndex - 1);
}

function randomFlashcard() {
  const randIdx = Math.floor(Math.random() * fcList.length);
  loadFlashcard(randIdx);
}

// ==========================================
// QUIZ MODE LOGIC
// ==========================================
function startQuiz() {
  const lvl = document.getElementById('quiz-level-select').value;
  const totalCount = parseInt(document.getElementById('quiz-count-select').value, 10);

  let pool = lvl === 'ALL' ? [...vocabData] : vocabData.filter(i => i.level === lvl);
  if (pool.length < 10) pool = [...vocabData];

  // Shuffle and pick N items
  pool.sort(() => Math.random() - 0.5);
  quizList = pool.slice(0, Math.min(totalCount, pool.length));

  quizIndex = 0;
  quizCorrect = 0;
  quizWrong = 0;

  document.getElementById('quiz-setup-card').classList.add('hidden');
  document.getElementById('quiz-result-card').classList.add('hidden');
  document.getElementById('quiz-active-card').classList.remove('hidden');

  loadQuizQuestion();
}

function loadQuizQuestion() {
  quizAnswered = false;
  currentQuizItem = quizList[quizIndex];

  document.getElementById('quiz-badge-level').textContent = currentQuizItem.level;
  document.getElementById('quiz-current-idx').textContent = quizIndex + 1;
  document.getElementById('quiz-total-idx').textContent = quizList.length;
  document.getElementById('quiz-correct-count').textContent = quizCorrect;
  document.getElementById('quiz-wrong-count').textContent = quizWrong;

  document.getElementById('quiz-word').textContent = currentQuizItem.word;
  document.getElementById('quiz-ipa').innerHTML = `${currentQuizItem.ipa} - <span class="italic font-sans text-brand-600">${currentQuizItem.pos}</span>`;

  // Hide explanation and next button
  document.getElementById('quiz-explanation').classList.add('hidden');
  document.getElementById('quiz-next-btn').classList.add('hidden');

  // Generate 4 options (1 correct + 3 random distractors)
  let distractors = vocabData
    .filter(i => i.id !== currentQuizItem.id && i.meaning !== currentQuizItem.meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(i => i.meaning);

  let options = [currentQuizItem.meaning, ...distractors].sort(() => Math.random() - 0.5);

  const container = document.getElementById('quiz-options');
  container.innerHTML = options.map((opt, idx) => {
    const letters = ['A', 'B', 'C', 'D'];
    return `
      <button onclick="handleQuizAnswer('${opt.replace(/'/g, "\\'")}', this)" class="quiz-opt-btn w-full p-4 text-left rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all font-semibold text-sm sm:text-base flex items-center gap-3 group">
        <span class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-brand-600 group-hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
          ${letters[idx]}
        </span>
        <span class="flex-1">${opt}</span>
      </button>
    `;
  }).join('');
}

function handleQuizAnswer(selectedMeaning, btnEl) {
  if (quizAnswered) return;
  quizAnswered = true;

  const isCorrect = selectedMeaning === currentQuizItem.meaning;
  if (isCorrect) {
    quizCorrect++;
    btnEl.classList.remove('border-slate-200', 'dark:border-slate-800');
    btnEl.classList.add('bg-emerald-50', 'dark:bg-emerald-950/60', 'border-emerald-500', 'text-emerald-700', 'dark:text-emerald-300');
  } else {
    quizWrong++;
    btnEl.classList.remove('border-slate-200', 'dark:border-slate-800');
    btnEl.classList.add('bg-rose-50', 'dark:bg-rose-950/60', 'border-rose-500', 'text-rose-700', 'dark:text-rose-300');

    // Highlight the correct one
    document.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      if (btn.textContent.includes(currentQuizItem.meaning)) {
        btn.classList.add('bg-emerald-50', 'dark:bg-emerald-950/60', 'border-emerald-500', 'text-emerald-700', 'dark:text-emerald-300');
      }
    });
  }

  // Update live counters
  document.getElementById('quiz-correct-count').textContent = quizCorrect;
  document.getElementById('quiz-wrong-count').textContent = quizWrong;

  // Show example explanation
  if (currentQuizItem.example_en) {
    document.getElementById('quiz-ex-en').textContent = `"${currentQuizItem.example_en}"`;
    document.getElementById('quiz-ex-vi').textContent = currentQuizItem.example_vi ? `(${currentQuizItem.example_vi})` : '';
    document.getElementById('quiz-explanation').classList.remove('hidden');
  }

  // Show Next Question Button
  document.getElementById('quiz-next-btn').classList.remove('hidden');
}

function nextQuizQuestion() {
  quizIndex++;
  if (quizIndex < quizList.length) {
    loadQuizQuestion();
  } else {
    // Show Results Card
    document.getElementById('quiz-active-card').classList.add('hidden');
    document.getElementById('quiz-result-card').classList.remove('hidden');

    const pct = Math.round((quizCorrect / quizList.length) * 100);
    document.getElementById('quiz-score-summary').textContent = `Bạn đã trả lời đúng ${quizCorrect} / ${quizList.length} câu (${pct}%).`;
  }
}

// ==========================================
// EXPORT UTILITIES (CSV & ANKI)
// ==========================================
function exportToCSV() {
  const exportItems = filteredList.length > 0 ? filteredList : vocabData;
  let csv = "\uFEFFLevel,Word,POS,IPA,Meaning,Example English,Example Vietnamese\n";
  
  exportItems.forEach(i => {
    const row = [
      i.level,
      `"${i.word.replace(/"/g, '""')}"`,
      `"${i.pos.replace(/"/g, '""')}"`,
      `"${i.ipa.replace(/"/g, '""')}"`,
      `"${i.meaning.replace(/"/g, '""')}"`,
      `"${(i.example_en || '').replace(/"/g, '""')}"`,
      `"${(i.example_vi || '').replace(/"/g, '""')}"`
    ];
    csv += row.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CEFR_Vocabulary_${currentLevel}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToAnki() {
  const exportItems = filteredList.length > 0 ? filteredList : vocabData;
  let txt = "#separator:tab\n#html:true\n#tags column:5\n";
  
  exportItems.forEach(i => {
    const front = `<b>${i.word}</b> <small>(${i.pos})</small><br><span style="color:#6366f1;">${i.ipa}</span>`;
    const back = `<div style="font-size:1.1em;font-weight:bold;color:#059669;">${i.meaning}</div><hr style="margin:8px 0;opacity:0.3;"><i>"${i.example_en || ''}"</i><br><small style="color:#64748b;">${i.example_vi || ''}</small>`;
    const tag = `CEFR_${i.level}`;
    txt += `${front}\t${back}\t${tag}\n`;
  });

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CEFR_Anki_Deck_${currentLevel}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
