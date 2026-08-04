// ===== 法考备考网站 - 主应用 =====
const { createApp } = Vue;

// localStorage 存储工具
const Store = {
  get(key, def) {
    try { const v = localStorage.getItem('faka_' + key); return v ? JSON.parse(v) : def; }
    catch(e) { return def; }
  },
  set(key, val) { localStorage.setItem('faka_' + key, JSON.stringify(val)); }
};

const app = createApp({
  data() {
    return {
      currentPage: 'home',
      // 用户数据
      checkins: Store.get('checkins', {}),
      taskDone: Store.get('taskDone', {}),
      quizStats: Store.get('quizStats', { total: 0, correct: 0 }),
      errorBook: Store.get('errorBook', []),
      flashcardState: Store.get('flashcardState', {}),
      notes: Store.get('notes', NOTES_INIT),
      // 刷题状态
      quizFilter: 'all',
      quizIndex: 0,
      selectedOption: null,
      showAnalysis: false,
      quizSessionCorrect: 0,
      quizSessionTotal: 0,
      // 卡片状态
      fcIndex: 0,
      fcFlipped: false,
      // 笔记状态
      currentNoteKey: null,
      // UI
      sidebarOpen: false,
      todayStr: new Date().toISOString().slice(0, 10)
    };
  },

  computed: {
    // 倒计时
    countdownDays() {
      const exam = new Date(EXAM_DATE);
      const now = new Date();
      return Math.max(0, Math.ceil((exam - now) / 86400000));
    },
    examDateText() {
      const d = new Date(EXAM_DATE);
      return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
    },

    // 今日任务
    todayTasks() {
      return STUDY_PLAN.filter(p => p.date === this.todayStr);
    },

    // 今日完成率
    todayProgress() {
      if (this.todayTasks.length === 0) return 0;
      const done = this.todayTasks.filter(t => this.taskDone[t.date]).length;
      return Math.round(done / this.todayTasks.length * 100);
    },

    // 总体进度（按计划完成天数）
    overallProgress() {
      const totalDays = STUDY_PLAN.length;
      const doneDays = STUDY_PLAN.filter(p => this.taskDone[p.date]).length;
      return Math.round(doneDays / totalDays * 100);
    },

    // 各科目进度
    subjectProgressList() {
      return SUBJECTS.map(s => {
        const subjectTasks = STUDY_PLAN.filter(p => p.subject === s.name);
        if (subjectTasks.length === 0) return { name: s.name, pct: 0, color: s.color };
        const done = subjectTasks.filter(t => this.taskDone[t.date]).length;
        return { name: s.name, pct: Math.round(done / subjectTasks.length * 100), color: s.color };
      });
    },

    // 打卡热力图数据（最近60天）
    heatmapData() {
      const days = [];
      const today = new Date();
      for (let i = 59; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const checked = this.checkins[dateStr];
        let level = 0;
        if (checked) {
          const tasks = STUDY_PLAN.filter(p => p.date === dateStr);
          const done = tasks.filter(t => this.taskDone[t.date]).length;
          if (tasks.length > 0) {
            const ratio = done / tasks.length;
            if (ratio >= 1) level = 4;
            else if (ratio >= 0.75) level = 3;
            else if (ratio >= 0.5) level = 2;
            else level = 1;
          } else {
            level = 1;
          }
        }
        days.push({ date: dateStr, level, checked });
      }
      return days;
    },

    // 连续打卡天数
    streakDays() {
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        if (this.checkins[dateStr]) streak++;
        else if (i > 0) break;
      }
      return streak;
    },

    // 过滤后的题目
    filteredQuestions() {
      if (this.quizFilter === 'all') return QUESTIONS;
      if (this.quizFilter === 'errors') {
        const errorIds = this.errorBook.map(e => e.questionId);
        return QUESTIONS.filter(q => errorIds.includes(q.id));
      }
      return QUESTIONS.filter(q => q.subject === this.quizFilter);
    },

    // 当前题目
    currentQuestion() {
      const qs = this.filteredQuestions;
      if (this.quizIndex >= qs.length) this.quizIndex = 0;
      return qs[this.quizIndex] || null;
    },

    // 刷题正确率
    quizAccuracy() {
      if (this.quizStats.total === 0) return 0;
      return Math.round(this.quizStats.correct / this.quizStats.total * 100);
    },

    // 错题列表（带题目详情）
    errorQuestions() {
      return this.errorBook.map(e => {
        const q = QUESTIONS.find(qq => qq.id === e.questionId);
        return { ...q, wrongSelected: e.selected, errorDate: e.date };
      }).filter(q => q.id);
    },

    // 今日待复习卡片
    dueFlashcards() {
      const today = this.todayStr;
      return FLASHCARDS.filter(f => {
        const state = this.flashcardState[f.id];
        if (!state) return true; // 新卡片需要学
        return state.nextReview <= today;
      });
    },

    // 当前卡片
    currentFlashcard() {
      return this.dueFlashcards[this.fcIndex] || null;
    },

    // 按周分组的计划
    planByWeek() {
      const weeks = {};
      STUDY_PLAN.forEach(p => {
        if (!weeks[p.week]) weeks[p.week] = [];
        weeks[p.week].push(p);
      });
      return Object.keys(weeks).map(w => ({ week: parseInt(w), days: weeks[w] }));
    },

    // 当前周
    currentWeek() {
      const todayPlan = STUDY_PLAN.find(p => p.date === this.todayStr);
      return todayPlan ? todayPlan.week : 1;
    }
  },

  methods: {
    // 导航
    navigate(page) {
      this.currentPage = page;
      this.sidebarOpen = false;
      if (page === 'quiz') { this.quizIndex = 0; this.selectedOption = null; this.showAnalysis = false; }
      if (page === 'flashcards') { this.fcIndex = 0; this.fcFlipped = false; }
      if (page === 'notes' && !this.currentNoteKey) {
        this.currentNoteKey = Object.keys(this.notes)[0] || null;
      }
    },

    // 打卡
    toggleCheckin() {
      if (this.checkins[this.todayStr]) {
        delete this.checkins[this.todayStr];
      } else {
        this.checkins[this.todayStr] = true;
      }
      Store.set('checkins', this.checkins);
    },

    // 切换任务完成
    toggleTask(date) {
      if (this.taskDone[date]) {
        delete this.taskDone[date];
      } else {
        this.taskDone[date] = true;
        this.checkins[date] = true; // 完成任务自动打卡
      }
      Store.set('taskDone', this.taskDone);
      Store.set('checkins', this.checkins);
    },

    // 刷题：选择答案
    selectOption(idx) {
      if (this.showAnalysis) return;
      this.selectedOption = idx;
      this.showAnalysis = true;
      const q = this.currentQuestion;
      const correct = idx === q.answer;
      // 更新统计
      this.quizStats.total++;
      if (correct) this.quizStats.correct++;
      Store.set('quizStats', this.quizStats);
      this.quizSessionTotal++;
      if (correct) this.quizSessionCorrect++;
      // 错题本
      if (!correct) {
        const existIdx = this.errorBook.findIndex(e => e.questionId === q.id);
        const entry = { questionId: q.id, selected: idx, date: this.todayStr };
        if (existIdx >= 0) this.errorBook[existIdx] = entry;
        else this.errorBook.push(entry);
        Store.set('errorBook', this.errorBook);
      } else {
        // 答对了，从错题本移除
        const existIdx = this.errorBook.findIndex(e => e.questionId === q.id);
        if (existIdx >= 0) {
          this.errorBook.splice(existIdx, 1);
          Store.set('errorBook', this.errorBook);
        }
      }
    },

    // 下一题
    nextQuestion() {
      this.quizIndex++;
      if (this.quizIndex >= this.filteredQuestions.length) this.quizIndex = 0;
      this.selectedOption = null;
      this.showAnalysis = false;
    },

    // 上一题
    prevQuestion() {
      this.quizIndex--;
      if (this.quizIndex < 0) this.quizIndex = this.filteredQuestions.length - 1;
      this.selectedOption = null;
      this.showAnalysis = false;
    },

    // 答题选项样式
    optionClass(idx) {
      if (!this.showAnalysis) {
        return this.selectedOption === idx ? 'selected' : '';
      }
      const q = this.currentQuestion;
      if (idx === q.answer) return 'correct';
      if (idx === this.selectedOption && idx !== q.answer) return 'wrong';
      return '';
    },

    // 删除错题
    removeError(questionId) {
      this.errorBook = this.errorBook.filter(e => e.questionId !== questionId);
      Store.set('errorBook', this.errorBook);
    },

    // 翻转卡片
    flipCard() { this.fcFlipped = !this.fcFlipped; },

    // 卡片评分（SM-2简化版）
    rateCard(rating) {
      const card = this.currentFlashcard;
      if (!card) return;
      const state = this.flashcardState[card.id] || { interval: 1, ease: 2.5, nextReview: this.todayStr, reps: 0 };
      let interval;
      if (rating === 'again') {
        interval = 1;
        state.reps = 0;
      } else if (rating === 'hard') {
        state.ease = Math.max(1.3, state.ease - 0.2);
        interval = Math.max(1, Math.round(state.interval * 1.2));
      } else if (rating === 'easy') {
        state.ease += 0.15;
        state.reps++;
        if (state.reps === 1) interval = 3;
        else if (state.reps === 2) interval = 7;
        else interval = Math.round(state.interval * state.ease);
      }
      state.interval = interval;
      const next = new Date();
      next.setDate(next.getDate() + interval);
      state.nextReview = next.toISOString().slice(0, 10);
      state.lastReview = this.todayStr;
      this.flashcardState[card.id] = { ...state };
      Store.set('flashcardState', this.flashcardState);
      // 下一张
      this.fcFlipped = false;
      this.fcIndex++;
      if (this.fcIndex >= this.dueFlashcards.length) this.fcIndex = 0;
    },

    // 跳过卡片
    skipCard() {
      this.fcFlipped = false;
      this.fcIndex++;
      if (this.fcIndex >= this.dueFlashcards.length) this.fcIndex = 0;
    },

    // 渲染笔记
    renderNote(key) {
      const content = this.notes[key] || '';
      if (typeof marked !== 'undefined') {
        return marked.parse(content);
      }
      return content.replace(/\n/g, '<br>');
    },

    // 保存笔记
    saveNote() {
      Store.set('notes', this.notes);
    },

    // 选择笔记
    selectNote(key) { this.currentNoteKey = key; },

    // 获取科目颜色
    subjectColor(name) {
      const s = SUBJECTS.find(s => s.name === name);
      return s ? s.color : '#999';
    },

    // 获取科目标签样式
    subjectTagStyle(name) {
      const color = this.subjectColor(name);
      return `background: ${color}20; color: ${color};`;
    },

    // 热力图提示
    heatmapTooltip(cell) {
      if (!cell.checked) return cell.date + ' 未打卡';
      return cell.date + ' 已打卡';
    },

    // 导出数据
    exportData() {
      const data = {
        checkins: this.checkins,
        taskDone: this.taskDone,
        quizStats: this.quizStats,
        errorBook: this.errorBook,
        flashcardState: this.flashcardState,
        notes: this.notes
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'faka-backup-' + this.todayStr + '.json';
      a.click();
      URL.revokeObjectURL(url);
    },

    // 导入数据
    importData(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.checkins) { this.checkins = data.checkins; Store.set('checkins', this.checkins); }
          if (data.taskDone) { this.taskDone = data.taskDone; Store.set('taskDone', this.taskDone); }
          if (data.quizStats) { this.quizStats = data.quizStats; Store.set('quizStats', this.quizStats); }
          if (data.errorBook) { this.errorBook = data.errorBook; Store.set('errorBook', this.errorBook); }
          if (data.flashcardState) { this.flashcardState = data.flashcardState; Store.set('flashcardState', this.flashcardState); }
          if (data.notes) { this.notes = data.notes; Store.set('notes', this.notes); }
          alert('数据导入成功！');
        } catch(err) {
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    },

    // 重置数据
    resetData() {
      if (!confirm('确定要重置所有数据吗？此操作不可撤销！')) return;
      ['checkins', 'taskDone', 'quizStats', 'errorBook', 'flashcardState', 'notes'].forEach(k => {
        localStorage.removeItem('faka_' + k);
      });
      location.reload();
    }
  },

  mounted() {
    // 恢复笔记初始数据
    if (Object.keys(this.notes).length === 0) {
      this.notes = NOTES_INIT;
      Store.set('notes', this.notes);
    }
  }
});
