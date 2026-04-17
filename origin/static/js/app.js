/**
 * 书稿引用校对系统 - 前端逻辑
 */

(function () {
  'use strict';

  // ====================== 状态管理 ======================
  const state = {
    manuscriptFile: null,
    sourceFiles: [],
    taskId: null,
    pollTimer: null,
    pollCount: 0,
    results: [],
    missingSources: [],
    currentFilter: 'all',
    evtSource: null,
  };

  const ALLOWED_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'text/markdown',
    'text/plain',
    'text/x-markdown',
  ];
  const ALLOWED_EXTS = ['.docx', '.pdf', '.md', '.txt', '.epub'];
  const MAX_POLL = 300; // 10分钟 (2s * 300)

  // 进度步骤提示
  const STEP_HINTS = [
    '正在解析文件内容，请稍候',
    '正在提取书稿中的引用片段',
    '正在与原文进行智能比对分析',
    '正在生成校对报告',
  ];

  // ====================== DOM 引用 ======================
  const els = {
    dropZone1: document.getElementById('dropZone1'),
    dropZone2: document.getElementById('dropZone2'),
    manuscriptFile: document.getElementById('manuscriptFile'),
    sourceFile: document.getElementById('sourceFile'),
    fileInfo1: document.getElementById('fileInfo1'),
    fileInfo2: document.getElementById('fileInfo2'),
    fileName1: document.getElementById('fileName1'),
    fileName2: document.getElementById('fileName2'),
    submitBtn: document.getElementById('submitBtn'),
    submitTip: document.querySelector('.submit-tip'),
    errorAlert: document.getElementById('errorAlert'),
    errorMessage: document.getElementById('errorMessage'),
    closeError: document.getElementById('closeError'),
    uploadSection: document.getElementById('uploadSection'),
    loadingSection: document.getElementById('loadingSection'),
    loadingDesc: document.getElementById('loadingDesc'),
    resultSection: document.getElementById('resultSection'),
    statTotal: document.getElementById('statTotal'),
    statPass: document.getElementById('statPass'),
    statFail: document.getElementById('statFail'),
    progressBar: document.getElementById('progressBar'),
    progressLabel: document.getElementById('progressLabel'),
    quoteList: document.getElementById('quoteList'),
    restartBtn: document.getElementById('restartBtn'),
    logPanel: document.getElementById('logPanel'),
    logToggle: document.getElementById('logToggle'),
    logChevron: document.getElementById('logChevron'),
    logBody: document.getElementById('logBody'),
    logEntries: document.getElementById('logEntries'),
    logCount: document.getElementById('logCount'),
    steps: [
      document.getElementById('step1'),
      document.getElementById('step2'),
      document.getElementById('step3'),
      document.getElementById('step4'),
    ],
  };

  // ====================== 文件验证 ======================
  function isValidFile(file) {
    if (!file) return false;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    return ALLOWED_EXTS.includes(ext) || ALLOWED_TYPES.includes(file.type);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ====================== 文件选择处理 ======================

  function addSourceFile(file) {
    state.sourceFiles.push(file);
    renderSourceFileList();
  }

  function removeSourceFile(index) {
    state.sourceFiles.splice(index, 1);
    renderSourceFileList();
    updateSubmitState();
  }

  function renderSourceFileList() {
    // Remove any existing add-hint
    var existingHint = els.dropZone2.querySelector('.drop-zone__add-hint');
    if (existingHint) existingHint.remove();

    if (state.sourceFiles.length === 0) {
      els.fileInfo2.style.display = 'none';
      els.dropZone2.classList.remove('has-file');
      toggleDropZoneContent(els.dropZone2, false);
    } else {
      els.dropZone2.classList.add('has-file');
      // Hide original large icon and text, but keep drop zone clickable
      toggleDropZoneContent(els.dropZone2, true);

      // Insert add-hint before fileInfo2
      var hint = document.createElement('div');
      hint.className = 'drop-zone__add-hint';
      hint.innerHTML =
        '<svg viewBox="0 0 20 20" fill="currentColor" class="drop-zone__add-icon" width="14" height="14">' +
          '<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>' +
        '</svg>' +
        '<span>已添加 ' + state.sourceFiles.length + ' 个参考文献 · 点击或拖拽继续添加</span>';
      els.dropZone2.insertBefore(hint, els.fileInfo2);

      // Render list of source files inside fileInfo2
      var names = state.sourceFiles.map(function (f, i) {
        return '<span class="file-name" style="flex:1">' + escapeHtml(f.name) + ' (' + formatFileSize(f.size) + ')</span>' +
          '<button class="file-remove source-file-remove" data-index="' + i + '" title="移除文件">' +
          '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>' +
          '</button>';
      }).join('');
      els.fileInfo2.innerHTML =
        '<svg viewBox="0 0 20 20" fill="currentColor" class="file-icon">' +
          '<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>' +
        '</svg>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">' + names + '</div>';
      els.fileInfo2.style.display = 'flex';
    }
  }

  function handleFileSelect(file, slot) {
    if (!isValidFile(file)) {
      showError('文件格式不支持，请上传 DOCX、PDF、MD、TXT 或 EPUB 格式的文件。');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showError('文件大小超出限制（最大 50MB），请压缩后重试。');
      return;
    }

    if (slot === 'manuscript') {
      state.manuscriptFile = file;
      els.fileName1.textContent = file.name + '  (' + formatFileSize(file.size) + ')';
      els.fileInfo1.style.display = 'flex';
      els.dropZone1.classList.add('has-file');
      // 隐藏上传图标和文字
      toggleDropZoneContent(els.dropZone1, true);
    } else {
      addSourceFile(file);
    }
    updateSubmitState();
    hideError();
  }

  function toggleDropZoneContent(zone, hasFile) {
    const icon = zone.querySelector('.drop-zone__icon');
    const text = zone.querySelector('.drop-zone__text');
    const formats = zone.querySelector('.drop-zone__formats');
    if (icon) icon.style.display = hasFile ? 'none' : '';
    if (text) text.style.display = hasFile ? 'none' : '';
    if (formats) formats.style.display = hasFile ? 'none' : '';
  }

  function removeFile(slot, zoneId, infoId, nameId) {
    if (slot === 'manuscriptFile') {
      state.manuscriptFile = null;
      els.manuscriptFile.value = '';
      const zone = document.getElementById(zoneId);
      const info = document.getElementById(infoId);
      const nameEl = document.getElementById(nameId);
      if (info) info.style.display = 'none';
      if (zone) zone.classList.remove('has-file');
      if (nameEl) nameEl.textContent = '';
      toggleDropZoneContent(zone, false);
    } else {
      // For source files, clear all (legacy remove-all path)
      state.sourceFiles = [];
      els.sourceFile.value = '';
      renderSourceFileList();
    }
    updateSubmitState();
  }

  // ====================== 按钮状态 ======================
  function updateSubmitState() {
    const ready = state.manuscriptFile && state.sourceFiles.length > 0;
    els.submitBtn.disabled = !ready;
    els.submitTip.textContent = ready
      ? '两个文件均已就绪，点击开始校对'
      : (!state.manuscriptFile && state.sourceFiles.length === 0)
        ? '请上传书稿文件和参考原文后开始校对'
        : !state.manuscriptFile
          ? '请上传书稿文件'
          : '请上传参考原文';
  }

  // ====================== 错误提示 ======================
  function showError(msg) {
    els.errorMessage.textContent = msg;
    els.errorAlert.style.display = 'flex';
    els.errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    els.errorAlert.style.display = 'none';
  }

  // ====================== 加载状态 ======================
  function setStep(index) {
    els.steps.forEach(function (step, i) {
      step.classList.remove('step--active', 'step--done');
      if (i < index) step.classList.add('step--done');
      else if (i === index) step.classList.add('step--active');
    });
    if (index < STEP_HINTS.length) {
      els.loadingDesc.textContent = STEP_HINTS[index];
    }
  }

  function updateLoadingStep(pollCount) {
    // 根据轮询次数动态推进步骤（纯 UX 效果）
    if (pollCount < 3) setStep(0);
    else if (pollCount < 8) setStep(1);
    else if (pollCount < 20) setStep(2);
    else setStep(3);
  }

  // ====================== 提交校对 ======================
  els.submitBtn.addEventListener('click', function () {
    startProofread();
  });

  async function startProofread() {
    hideError();
    els.submitBtn.disabled = true;

    const formData = new FormData();
    formData.append('manuscript', state.manuscriptFile);
    state.sourceFiles.forEach(function(f) { formData.append('sources', f); });

    // 切换到加载视图
    els.uploadSection.style.display = 'none';
    els.resultSection.style.display = 'none';
    els.loadingSection.style.display = 'flex';
    state.pollCount = 0;
    setStep(0);

    try {
      const res = await fetch('/api/proofread', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || '服务器错误（' + res.status + '），请稍后重试。');
      }

      const data = await res.json();
      if (!data.task_id) {
        throw new Error('服务器返回数据异常，请联系管理员。');
      }

      state.taskId = data.task_id;
      startSSE(state.taskId);

    } catch (err) {
      showUploadView();
      showError(err.message || '提交失败，请检查网络连接后重试。');
    }
  }

  // ====================== 轮询结果 ======================
  function startPolling() {
    clearPolling();
    state.pollTimer = setInterval(pollResult, 2000);
  }

  function clearPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function pollResult() {
    state.pollCount++;
    updateLoadingStep(state.pollCount);

    if (state.pollCount > MAX_POLL) {
      clearPolling();
      showUploadView();
      showError('校对超时（超过10分钟），请检查文件内容后重新提交，或联系管理员。');
      return;
    }

    try {
      const res = await fetch('/api/result/' + state.taskId);
      if (!res.ok) {
        const errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || '查询结果失败（' + res.status + '）');
      }

      const data = await res.json();

      // 每次轮询都更新日志（包括 processing 状态）
      if (data.logs && data.logs.length > 0) {
        updateLogs(data.logs);
      }

      if (data.status === 'done') {
        clearPolling();
        state.results = data.result || [];
        state.missingSources = data.missing_sources || [];
        showResults(state.results);
      } else if (data.status === 'error') {
        clearPolling();
        showUploadView();
        showError(data.error || '校对过程中发生错误，请重新提交。');
      }
      // pending / processing：继续等待

    } catch (err) {
      // 网络瞬断不立即报错，继续轮询
      console.warn('轮询出错:', err.message);
    }
  }

  // ====================== SSE 流式结果 ======================
  function startSSE(taskId) {
    var evtSource = new EventSource('/api/stream/' + taskId);
    evtSource.onmessage = function(e) {
      var data = JSON.parse(e.data);
      if (data.logs && data.logs.length > 0) updateLogs(data.logs);
      if (data.status === 'done') {
        evtSource.close();
        state.evtSource = null;
        state.results = data.result && data.result.results || [];
        state.missingSources = data.result && data.result.missing_sources || data.missing_sources || [];
        showResults(state.results);
      } else if (data.status === 'error') {
        evtSource.close();
        state.evtSource = null;
        showUploadView();
        showError(data.error || '校对过程中发生错误');
      }
    };
    evtSource.onerror = function() {
      evtSource.close();
      state.evtSource = null;
      // fallback to polling
      startPolling();
    };
    state.evtSource = evtSource;
  }

  // ====================== 视图切换 ======================
  function showUploadView() {
    clearPolling();
    if (state.evtSource) { state.evtSource.close(); state.evtSource = null; }
    els.uploadSection.style.display = '';
    els.loadingSection.style.display = 'none';
    els.resultSection.style.display = 'none';
    els.submitBtn.disabled = !(state.manuscriptFile && state.sourceFiles.length > 0);
  }

  // ====================== 渲染结果 ======================
  function showResults(results) {
    els.loadingSection.style.display = 'none';
    els.uploadSection.style.display = 'none';

    const total = results.length;
    const passCount = results.filter(function (r) { return r.verdict === '通过'; }).length;
    const missingCount = results.filter(function (r) { return r.verdict === '原文未上传'; }).length;
    const failCount = total - passCount - missingCount;
    const verifiedTotal = total - missingCount;
    const passRate = verifiedTotal > 0 ? Math.round((passCount / verifiedTotal) * 100) : 0;

    els.statTotal.textContent = total;
    els.statPass.textContent = passCount;
    els.statFail.textContent = failCount;
    els.progressBar.style.width = passRate + '%';
    var rateLabel = '通过率 ' + passRate + '%（' + passCount + '/' + verifiedTotal + '）';
    if (missingCount > 0) {
      rateLabel += '，' + missingCount + ' 条因原文未上传跳过';
    }
    els.progressLabel.textContent = rateLabel;

    state.currentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.classList.toggle('filter-btn--active', btn.dataset.filter === 'all');
    });

    renderQuoteList(results, 'all');

    // Set export links
    var exportWord = document.getElementById('exportWord');
    var exportCsv = document.getElementById('exportCsv');
    if (exportWord) exportWord.onclick = function() { window.location.href = '/api/export/' + state.taskId + '?format=docx'; };
    if (exportCsv) exportCsv.onclick = function() { window.location.href = '/api/export/' + state.taskId + '?format=csv'; };

    els.resultSection.style.display = 'flex';
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildMissingSourcesAlert(missingSources) {
    var div = document.createElement('div');
    div.className = 'missing-sources-alert';
    var items = missingSources.map(function (ms) {
      return '<strong>' + escapeHtml(ms.source_work) + '</strong>（' + ms.quote_count + '处引用）';
    }).join('、');
    div.innerHTML =
      '<svg class="missing-sources-icon" viewBox="0 0 20 20" fill="currentColor">' +
        '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>' +
      '</svg>' +
      '<div class="missing-sources-body">' +
        '<p class="missing-sources-title">以下被引文献未上传原文，相关引用无法完整校对：</p>' +
        '<p class="missing-sources-items">' + items + '</p>' +
        '<p class="missing-sources-hint">请补充上传对应原文文件后重新校对。</p>' +
      '</div>';
    return div;
  }

  function renderQuoteList(results, filter) {
    var filtered = results.filter(function (r) {
      if (filter === 'pass') return r.verdict === '通过';
      if (filter === 'fail') return r.verdict !== '通过';
      return true;
    });

    els.quoteList.innerHTML = '';

    // 缺失原文警告（始终在顶部显示）
    if (state.missingSources && state.missingSources.length > 0) {
      els.quoteList.appendChild(buildMissingSourcesAlert(state.missingSources));
    }

    if (filtered.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
        '<p>暂无符合条件的引用</p>';
      els.quoteList.appendChild(emptyDiv);
      return;
    }

    // 判断是否有章节信息
    var hasChapters = filtered.some(function (r) { return r.chapter && r.chapter.trim(); });

    if (hasChapters) {
      // 按章节分组（保持原始顺序）
      var chapters = [];
      var chapterMap = {};
      filtered.forEach(function (item) {
        var ch = (item.chapter && item.chapter.trim()) ? item.chapter : '未分章节';
        if (!chapterMap[ch]) {
          chapterMap[ch] = [];
          chapters.push(ch);
        }
        chapterMap[ch].push(item);
      });

      chapters.forEach(function (ch) {
        var header = document.createElement('div');
        header.className = 'chapter-header';
        header.textContent = ch;
        els.quoteList.appendChild(header);

        chapterMap[ch].forEach(function (item) {
          var globalIdx = results.indexOf(item) + 1;
          els.quoteList.appendChild(buildQuoteCard(item, globalIdx));
        });
      });
    } else {
      // 无章节信息，平铺显示
      filtered.forEach(function (item) {
        var globalIdx = results.indexOf(item) + 1;
        els.quoteList.appendChild(buildQuoteCard(item, globalIdx));
      });
    }
  }

  function buildQuoteCard(item, index) {
    const isPass = item.verdict === '通过';
    const isMissingSource = item.verdict === '原文未上传';
    const card = document.createElement('div');
    card.className = 'quote-card ' + (isMissingSource ? 'quote-card--missing' : isPass ? 'quote-card--pass' : 'quote-card--fail');
    card.dataset.verdict = isMissingSource ? 'missing' : isPass ? 'pass' : 'fail';

    // 三项检查
    const checks = [
      {
        label: '文字准确',
        ok: item.text_accurate,
        issue: item.text_issues,
      },
      {
        label: '解释一致',
        ok: item.explanation_consistent,
        issue: item.explanation_issues,
      },
      {
        label: '上下文相符',
        ok: item.context_appropriate,
        issue: item.context_issues,
      },
    ];

    const checkIconPass = '<svg class="check-icon check-icon--pass" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>';
    const checkIconFail = '<svg class="check-icon check-icon--fail" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>';

    const checksHtml = checks.map(function (c) {
      const ok = c.ok !== false;
      return '<div class="check-item ' + (ok ? 'check-item--pass' : 'check-item--fail') + '">' +
        '<div class="check-item__title">' +
        (ok ? checkIconPass : checkIconFail) +
        '<span class="check-item__label">' + escapeHtml(c.label) + '</span>' +
        '</div>' +
        ((!ok && c.issue) ? '<p class="check-item__issue">' + escapeHtml(c.issue) + '</p>' : '') +
        '</div>';
    }).join('');

    var paraIndexHtml = (item.estimated_page != null)
      ? '<span class="para-index">约第 ' + item.estimated_page + ' 页</span>'
      : '';

    var sourceWorkHtml = item.source_work
      ? '<span class="source-work-tag">' + escapeHtml(item.source_work) + '</span>'
      : '';

    const locationHtml = item.quote_location
      ? '<span class="quote-location"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>' + escapeHtml(item.quote_location) + '</span>'
      : '';

    const confidenceHtml = (item.confidence != null)
      ? '<span class="confidence-badge" title="置信度">置信度 ' + Math.round(item.confidence * 100) + '%</span>'
      : '';

    var verdictClass = isMissingSource ? 'verdict-badge--missing' : isPass ? 'verdict-badge--pass' : 'verdict-badge--fail';
    var verdictIcon = isPass
      ? '<svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>'
      : isMissingSource
        ? '<svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>'
        : '<svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
    const verdictBadge = '<span class="verdict-badge ' + verdictClass + '">' + verdictIcon +
      escapeHtml(item.verdict || (isPass ? '通过' : '有问题')) +
      '</span>';

    const matchHtml = item.source_match
      ? '<div class="text-block text-block--match"><p class="text-block__label">原文对照</p><p class="text-block__content">' + escapeHtml(item.source_match) + '</p></div>'
      : '';

    // 上下文块：context_before + 加粗引用 + context_after
    var contextHtml = '';
    if (item.context_before || item.context_after) {
      var contextContent =
        escapeHtml(item.context_before || '') +
        '<strong class="highlighted-quote">' + escapeHtml(item.quote || '') + '</strong>' +
        escapeHtml(item.context_after || '');
      contextHtml = '<div class="text-block text-block--context">' +
        '<p class="text-block__label">引用上下文</p>' +
        '<p class="text-block__content context-text">' + contextContent + '</p>' +
        '</div>';
    }

    const summaryClass = isPass ? 'summary-block--pass' : '';
    const summaryHtml = item.summary
      ? '<div class="summary-block ' + summaryClass + '"><p class="summary-block__label">综合评价</p><p class="summary-block__text">' + escapeHtml(item.summary) + '</p></div>'
      : '';

    card.innerHTML =
      '<div class="quote-card__header">' +
        '<div class="quote-card__meta">' +
          '<span class="quote-index">第 ' + index + ' 条</span>' +
          paraIndexHtml +
          sourceWorkHtml +
          locationHtml +
        '</div>' +
        '<div class="quote-card__badges">' + verdictBadge + confidenceHtml + '</div>' +
      '</div>' +
      '<div class="quote-card__body">' +
        '<div class="quote-text-area">' +
          '<div class="text-block"><p class="text-block__label">书稿引用内容</p><p class="text-block__content">' + escapeHtml(item.quote || '') + '</p></div>' +
          matchHtml +
        '</div>' +
        contextHtml +
        '<div class="check-items">' + checksHtml + '</div>' +
        summaryHtml +
      '</div>';

    return card;
  }

  function updateLogs(logs) {
    els.logEntries.innerHTML = '';
    logs.forEach(function (entry) {
      const div = document.createElement('div');
      const isError = entry.includes('[错误]');
      const isDone = entry.includes('校对完成');
      div.className = 'log-entry' + (isError ? ' log-entry--error' : isDone ? ' log-entry--done' : '');
      div.textContent = entry;
      els.logEntries.appendChild(div);
    });
    els.logCount.textContent = logs.length + ' 条';
    // 自动展开日志面板（首次有内容时）
    if (logs.length > 0 && !els.logBody.classList.contains('is-open')) {
      els.logBody.classList.add('is-open');
      els.logToggle.classList.add('is-open');
      els.logChevron.classList.add('is-open');
    }
    // 滚动到底部
    els.logEntries.scrollTop = els.logEntries.scrollHeight;
  }

  function resetLogs() {
    els.logEntries.innerHTML = '';
    els.logCount.textContent = '0 条';
    els.logBody.classList.remove('is-open');
    els.logToggle.classList.remove('is-open');
    els.logChevron.classList.remove('is-open');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ====================== 事件绑定 ======================

  // 拖拽上传 - 通用函数
  function setupDropZone(zone, fileInputId, slot, infoId, nameId) {
    const input = document.getElementById(fileInputId);

    zone.addEventListener('click', function (e) {
      if (e.target.closest('.file-remove')) return;
      input.click();
    });

    input.addEventListener('change', function () {
      if (input.files && input.files.length > 0) {
        if (slot === 'source') {
          // 参考原文支持多文件选择
          Array.from(input.files).forEach(function (f) {
            handleFileSelect(f, slot);
          });
        } else {
          handleFileSelect(input.files[0], slot);
        }
      }
    });

    zone.addEventListener('dragenter', function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files && files[0]) {
        handleFileSelect(files[0], slot);
      }
    });
  }

  setupDropZone(els.dropZone1, 'manuscriptFile', 'manuscript', 'fileInfo1', 'fileName1');
  setupDropZone(els.dropZone2, 'sourceFile', 'source', 'fileInfo2', 'fileName2');

  // 移除文件按钮
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.file-remove');
    if (!btn) return;
    e.stopPropagation();
    if (btn.classList.contains('source-file-remove')) {
      var idx = parseInt(btn.dataset.index, 10);
      removeSourceFile(idx);
    } else {
      removeFile(btn.dataset.target, btn.dataset.zone, btn.dataset.info, btn.dataset.name);
    }
  });

  // 关闭错误提示
  els.closeError.addEventListener('click', hideError);

  // 重新校对按钮
  els.restartBtn.addEventListener('click', function () {
    clearPolling();
    if (state.evtSource) { state.evtSource.close(); state.evtSource = null; }
    state.taskId = null;
    state.results = [];
    state.missingSources = [];
    resetLogs();
    showUploadView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 日志面板折叠/展开
  els.logToggle.addEventListener('click', function () {
    const isOpen = els.logBody.classList.toggle('is-open');
    els.logToggle.classList.toggle('is-open', isOpen);
    els.logChevron.classList.toggle('is-open', isOpen);
  });

  // 筛选按钮
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.remove('filter-btn--active');
      });
      btn.classList.add('filter-btn--active');
      state.currentFilter = btn.dataset.filter;
      renderQuoteList(state.results, state.currentFilter);
    });
  });

  // 防止页面被意外离开（校对中）
  window.addEventListener('beforeunload', function (e) {
    if (state.pollTimer || state.evtSource) {
      e.preventDefault();
      e.returnValue = '校对仍在进行中，确定要离开吗？';
    }
  });

  // 初始状态
  updateSubmitState();

})();
