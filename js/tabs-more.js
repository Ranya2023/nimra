/* Nimre — subject tabs part 2: students, link & QR, report */
(() => {
  'use strict';
  const N = window.Nimre;
  const { S, t, esc, fmt, r2, api, errText, ICON, ACTIONS, FORMS, CHANGES, INPUTS, toast, openSheet, closeSheetOf, confirmBox, formError, busy } = N;
  const T = (window.NimreTabs = window.NimreTabs || { after: {} });
  const teacher = () => window.NimreTeacher;
  const rerender = () => teacher().renderSubject();
  const X = () => window.NimreExport;

  const studentLink = (subjectId) => N.appBase() + '?s=' + encodeURIComponent(subjectId);
  const personalLink = (subjectId, token) => studentLink(subjectId) + '&t=' + encodeURIComponent(token);

  // ═════════════ Students ═════════════
  T.students = (cur) => {
    const list = cur.students.length
      ? '<label class="search"><span class="sr-only">' + esc(t('searchStudents')) + '</span>' + ICON.search +
        '<input type="search" data-input="filterRows" data-target=".student-list" placeholder="' + esc(t('searchStudents')) + '"></label>' +
        '<ol class="rows student-list">' + cur.students.map((st, i) =>
          '<li class="student-row" data-name="' + esc((st.name + ' ' + st.email).toLowerCase()) + '">' +
          '<span class="idx">' + (i + 1) + '</span>' +
          '<span class="st-main"><strong>' + esc(st.name) + '</strong>' +
          (st.email ? '<small dir="ltr">' + esc(st.email) + '</small>' : '<small class="warn">' + esc(t('noEmail')) + '</small>') + '</span>' +
          '<button type="button" class="icon-btn" data-act="studentMenu" data-id="' + esc(st.id) + '" aria-label="' + esc(st.name) + '">' + ICON.more + '</button></li>').join('') +
        '</ol>'
      : '<div class="empty empty--inline"><p>' + esc(t('emptyStudents')) + '</p></div>';

    return '<div class="section-head"><h2 class="h-sec">' + esc(t('studentsCount', { n: cur.students.length })) + '</h2>' +
      '<div class="btn-row btn-row--tight">' +
      '<button type="button" class="btn btn--primary btn--sm" data-act="pasteStudents">' + ICON.clipboard + esc(t('pasteList')) + '</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="addStudent">' + ICON.plus + esc(t('addStudent')) + '</button></div></div>' +
      list;
  };

  function studentForm(st) {
    openSheet({
      title: st ? t('editStudent') : t('addStudent'),
      body: '<form data-form="student" class="stack">' +
        '<input type="hidden" name="id" value="' + esc(st ? st.id : '') + '">' +
        '<label class="field"><span>' + esc(t('name')) + '</span><input name="studentName" required maxlength="120" value="' + esc(st ? st.name : '') + '"></label>' +
        '<label class="field"><span>' + esc(t('email')) + '</span><input name="email" type="email" maxlength="160" dir="ltr" autocomplete="off" autocapitalize="off" value="' + esc(st ? st.email : '') + '"></label>' +
        '<div class="sheet-actions"><button class="btn btn--primary">' + esc(t('save')) + '</button></div></form>'
    });
  }

  ACTIONS.addStudent = () => studentForm(null);

  ACTIONS.studentMenu = (el) => {
    const st = S.cur.students.find((s) => s.id === el.dataset.id);
    if (!st) return;
    openSheet({
      title: st.name,
      body: '<div class="menu">' +
        '<button type="button" class="menu-item" data-act="editStudent" data-id="' + esc(st.id) + '">' + ICON.edit + esc(t('editStudent')) + '</button>' +
        '<button type="button" class="menu-item" data-act="copyPersonal" data-id="' + esc(st.id) + '">' + ICON.link + esc(t('copyPersonalLink')) + '</button>' +
        (st.email ? '<button type="button" class="menu-item" data-act="emailStudent" data-id="' + esc(st.id) + '">' + ICON.mail + esc(t('emailGrades')) + '<small dir="ltr">' + esc(st.email) + '</small></button>' : '') +
        '<button type="button" class="menu-item menu-item--danger" data-act="deleteStudent" data-id="' + esc(st.id) + '">' + ICON.trash + esc(t('deleteStudent')) + '</button>' +
        '</div>'
    });
  };

  ACTIONS.editStudent = (el) => { N.closeAllSheets(); setTimeout(() => studentForm(S.cur.students.find((s) => s.id === el.dataset.id)), 210); };

  ACTIONS.copyPersonal = (el) => {
    const st = S.cur.students.find((s) => s.id === el.dataset.id);
    if (st && st.token) N.copyText(personalLink(S.cur.subject.id, st.token));
    N.closeAllSheets();
  };

  ACTIONS.emailStudent = (el) => busy(el, async () => {
    try {
      const res = await api('emailStudent', { subjectId: S.cur.subject.id, studentId: el.dataset.id });
      S.mailQuota = res.mailQuota;
      N.closeAllSheets();
      toast(t('emailAllSent', { n: 1 }));
    } catch (e) {
      teacher().handleError(e);
    }
  });

  ACTIONS.deleteStudent = async (el) => {
    const cur = S.cur;
    const st = cur.students.find((s) => s.id === el.dataset.id);
    if (!st || !(await confirmBox(t('confirmDeleteStudent', { name: st.name })))) return;
    try {
      await api('deleteStudent', { subjectId: cur.subject.id, studentId: st.id });
      cur.students = cur.students.filter((s) => s.id !== st.id);
      [...cur.scores.keys()].forEach((k) => { if (k.endsWith('|' + st.id)) cur.scores.delete(k); });
      S.dirty.delete(st.id);
      N.closeAllSheets();
      toast(t('saved'));
      rerender();
    } catch (e) {
      teacher().handleError(e);
    }
  };

  async function saveStudentList(form, students) {
    const res = await api('saveStudents', { subjectId: S.cur.subject.id, students });
    S.cur.students = res.students;
    closeSheetOf(form);
    toast(t('studentsAdded', { a: res.added, u: res.updated }) + (res.rejected.length ? ' — ' + t('rejectedRows', { n: res.rejected.length }) : ''), res.rejected.length ? 'error' : 'ok');
    rerender();
  }

  FORMS.student = (form) => busy(form.querySelector('.btn--primary'), async () => {
    formError(form, '');
    const email = form.email.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return formError(form, t('err_INVALID_EMAIL'));
    try {
      await saveStudentList(form, [{ id: form.id.value || undefined, name: form.studentName.value, email }]);
    } catch (e) {
      if (!teacher().handleError(e, { silent: true })) formError(form, errText(e));
    }
  });

  /** Accepts rows copied from Excel/Sheets (tabs), CSV, or "Name - email" lines. */
  function parseRoster(text) {
    const out = [];
    const header = /^(#|no\.?|name|names|full name|student|student name|email|e-mail|ناو|ناوی قوتابی|ناوی سیانی|ئیمەیڵ|ژ|ز)$/i;
    String(text).split(/\r?\n/).forEach((line) => {
      const raw = line.trim();
      if (!raw) return;
      const m = raw.match(/[^\s,;<>"'()]+@[^\s,;<>"'()]+\.[^\s,;<>"'()]{2,}/);
      const email = m ? m[0].toLowerCase() : '';
      const rest = m ? raw.replace(m[0], '\t') : raw;
      const parts = rest.split(/\t|;|,(?=\s*$)|\s[-–]\s|,/)
        .map((p) => p.replace(/^[\d\u0660-\u0669\u06F0-\u06F9]+[.)\-]?\s*/, '').trim())
        .filter((p) => p && !/^[\d\u0660-\u0669\u06F0-\u06F9+\s]+$/.test(p) && !header.test(p));
      const name = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (name) out.push({ name, email });
    });
    return out;
  }

  ACTIONS.pasteStudents = () => {
    openSheet({
      title: t('pasteList'),
      body: '<form data-form="pasteStudents" class="stack">' +
        '<p class="muted">' + esc(t('pasteHint')) + '</p>' +
        '<textarea name="roster" rows="9" data-input="rosterPreview" placeholder="' + (S.lang === 'ku' ? 'ئارام کامەران&#9;aram@uor.edu.krd' : 'Aram Kamaran&#9;aram@uor.edu.krd') + '"></textarea>' +
        '<p class="roster-preview muted" aria-live="polite"></p>' +
        '<div class="sheet-actions"><button class="btn btn--primary" disabled>' + esc(t('addStudents', { n: 0 })) + '</button></div></form>'
    });
  };

  INPUTS.rosterPreview = (ta) => {
    const form = ta.closest('form');
    const rows = parseRoster(ta.value);
    const noEmail = rows.filter((r) => !r.email).length;
    form.querySelector('.roster-preview').textContent = rows.length
      ? t('pastePreview', { n: rows.length }) + (noEmail ? ' — ' + t('pasteNoEmail', { n: noEmail }) : '')
      : '';
    const btn = form.querySelector('.btn--primary');
    btn.textContent = t('addStudents', { n: rows.length });
    btn.disabled = !rows.length;
  };

  FORMS.pasteStudents = (form) => busy(form.querySelector('.btn--primary'), async () => {
    formError(form, '');
    const rows = parseRoster(form.roster.value);
    if (!rows.length) return;
    try {
      await saveStudentList(form, rows);
    } catch (e) {
      if (!teacher().handleError(e, { silent: true })) formError(form, errText(e));
    }
  });

  // ═════════════ Link & QR ═════════════
  T.share = (cur) => {
    const s = cur.subject;
    const link = studentLink(s.id);
    const sep = S.lang === 'ku' ? '، ' : ', ';
    const withEmail = cur.students.filter((st) => st.email).length;
    return '<section class="poster" style="--tab:' + esc(s.color) + '">' +
      '<div class="poster-top">' +
      (S.settings && S.settings.university ? '<small>' + esc(S.settings.university) + '</small>' : '') +
      '<strong>' + esc(s.name) + '</strong><span>' + esc([s.department, s.stage].filter(Boolean).join(sep)) + '</span></div>' +
      '<div class="poster-qr"><canvas id="qr-canvas" width="240" height="240" role="img" aria-label="QR"></canvas></div>' +
      '<p class="poster-code" dir="ltr">' + esc(s.id) + '</p>' +
      '<p class="poster-note">' + esc(t('scanForGrades')) + '</p></section>' +
      '<p class="muted center">' + esc(t('shareIntro')) + '</p>' +
      '<div class="link-box"><span dir="ltr">' + esc(link) + '</span></div>' +
      '<div class="btn-row btn-row--center">' +
      '<button type="button" class="btn btn--primary" data-act="copyStudentLink">' + ICON.copy + esc(t('copyLink')) + '</button>' +
      (navigator.share ? '<button type="button" class="btn btn--ghost" data-act="shareStudentLink">' + ICON.share + esc(t('share')) + '</button>' : '') +
      '<button type="button" class="btn btn--ghost" data-act="downloadQr">' + ICON.download + esc(t('downloadQr')) + '</button></div>' +
      '<section class="block"><h2 class="h-sec">' + esc(t('howStudents')) + '</h2><ol class="steps">' +
      '<li>' + esc(t('howStep1')) + '</li><li>' + esc(t('howStep2')) + '</li><li>' + esc(t('howStep3')) + '</li></ol></section>' +
      '<section class="block block--mail"><button type="button" class="btn btn--ghost btn--block" data-act="emailAll"' + (withEmail ? '' : ' disabled') + '>' + ICON.mail + esc(t('emailAll')) + '</button>' +
      (S.mailQuota !== null && S.mailQuota !== undefined ? '<p class="muted small center">' + esc(t('mailQuota', { n: S.mailQuota })) + '</p>' : '') + '</section>';
  };

  T.after.share = (cur) => {
    const canvas = document.getElementById('qr-canvas');
    if (canvas) X().drawQr(canvas, studentLink(cur.subject.id), 232).catch(() => toast(t('err_EXPORT'), 'error'));
  };

  ACTIONS.copyStudentLink = () => N.copyText(studentLink(S.cur.subject.id));
  ACTIONS.shareStudentLink = async () => {
    const s = S.cur.subject;
    try { await navigator.share({ title: s.name, text: t('scanForGrades') + ': ' + s.name, url: studentLink(s.id) }); } catch (e) { /* closed */ }
  };

  function exportMeta(extra) {
    const s = S.cur.subject;
    return Object.assign({
      t, lang: S.lang, subject: s,
      university: (S.settings && S.settings.university) || '',
      teacherName: (S.settings && S.settings.teacherName) || '',
      dateText: N.dateText(Date.now()),
      link: studentLink(s.id),
      opts: S.report
    }, extra || {});
  }

  ACTIONS.downloadQr = (btn) => busy(btn, async () => {
    try { await X().qrPoster(exportMeta()); } catch (e) { toast(t('err_EXPORT'), 'error'); }
  });

  ACTIONS.emailAll = async (btn) => {
    const n = S.cur.students.filter((st) => st.email).length;
    if (!(await confirmBox(t('emailAllConfirm', { n }), { ok: t('emailAll'), danger: false }))) return;
    await busy(btn, async () => {
      const label = btn.innerHTML;
      btn.textContent = t('sending');
      try {
        const res = await api('emailAll', { subjectId: S.cur.subject.id });
        S.mailQuota = res.mailQuota;
        toast(t('emailAllSent', { n: res.sent }));
      } catch (e) {
        teacher().handleError(e);
      } finally {
        btn.innerHTML = label;
      }
    });
    rerender();
  };

  // ═════════════ Report ═════════════
  function buildReport(cur, opts) {
    const acts = cur.activities.filter((a) => !opts.onlyReleased || a.released);
    const max = r2(acts.reduce((s, a) => s + a.marks, 0));
    const finalMarks = r2(acts.filter((a) => a.type === 'final').reduce((s, a) => s + a.marks, 0));
    const showCoursework = finalMarks > 0 && acts.some((a) => a.type !== 'final');
    let rows = cur.students.map((st, i) => {
      let total = 0, coursework = 0;
      const cells = acts.map((a) => {
        const v = cur.scores.get(a.id + '|' + st.id);
        if (v === undefined) return '';
        total += v;
        if (a.type !== 'final') coursework += v;
        return v;
      });
      const pct = max ? (total / max) * 100 : 0;
      return { order: i, st, cells, total: r2(total), coursework: r2(coursework), pct, level: N.levelOf(pct) };
    });
    const collator = new Intl.Collator(S.lang === 'ku' ? 'ckb' : 'en');
    if (opts.sort === 'name') rows.sort((a, b) => collator.compare(a.st.name, b.st.name));
    else if (opts.sort === 'total') rows.sort((a, b) => b.total - a.total || a.order - b.order);
    rows = rows.map((r, i) => Object.assign(r, { n: i + 1 }));

    const totals = rows.map((r) => r.total);
    const levels = {};
    N.LEVELS.forEach((l) => { levels[l] = 0; });
    rows.forEach((r) => { levels[r.level]++; });
    return {
      acts, max, rows, levels, showCoursework, courseworkMax: r2(max - finalMarks),
      stats: {
        count: rows.length,
        average: rows.length ? r2(totals.reduce((a, b) => a + b, 0) / rows.length) : 0,
        highest: rows.length ? Math.max(...totals) : 0,
        lowest: rows.length ? Math.min(...totals) : 0,
        passed: rows.filter((r) => r.pct >= 50).length
      }
    };
  }

  T.report = (cur) => {
    if (!cur.students.length || !cur.activities.length) {
      return !cur.activities.length
        ? '<div class="empty"><p>' + esc(t('needActivitiesFirst')) + '</p><button type="button" class="btn btn--primary" data-act="tab" data-tab="activities">' + esc(t('goToActivities')) + '</button></div>'
        : '<div class="empty"><p>' + esc(t('needStudentsFirst')) + '</p><button type="button" class="btn btn--primary" data-act="tab" data-tab="students">' + esc(t('goToStudents')) + '</button></div>';
    }
    const o = S.report;
    const rep = buildReport(cur, o);
    const st = rep.stats;
    const maxLevel = Math.max(1, ...Object.values(rep.levels));

    const options = '<div class="report-opts">' +
      '<label class="check"><input type="checkbox" data-change="reportOpt" data-key="onlyReleased"' + (o.onlyReleased ? ' checked' : '') + '><span>' + esc(t('onlyReleased')) + '</span></label>' +
      '<label class="check"><input type="checkbox" data-change="reportOpt" data-key="includeActivities"' + (o.includeActivities ? ' checked' : '') + '><span>' + esc(t('includeActivities')) + '</span></label>' +
      '<label class="select"><span>' + esc(t('sortBy')) + '</span><select data-change="reportOpt" data-key="sort">' +
      ['roster', 'name', 'total'].map((k) => '<option value="' + k + '"' + (o.sort === k ? ' selected' : '') + '>' + esc(t('sort' + k.charAt(0).toUpperCase() + k.slice(1))) + '</option>').join('') +
      '</select></label></div>';

    const stats = '<dl class="stats">' +
      [['statStudents', st.count, ''], ['statAverage', fmt(st.average), '/' + fmt(rep.max)], ['statHighest', fmt(st.highest), ''], ['statLowest', fmt(st.lowest), ''],
        ['statPassed', st.passed, ''], ['statFailed', st.count - st.passed, '']]
        .map(([k, v, suffix]) => '<div class="stat"><dt>' + esc(t(k)) + '</dt><dd><b>' + esc(v) + '</b>' + (suffix ? '<span>' + esc(suffix) + '</span>' : '') + '</dd></div>').join('') +
      '</dl>';

    const levels = '<section class="block"><h2 class="h-sec">' + esc(t('levels')) + '</h2><ul class="levels">' +
      N.LEVELS.map((l) => '<li class="lv lv--' + l + '"><span>' + esc(t('level_' + l)) + '</span>' +
        '<span class="lv-bar"><i style="inline-size:' + ((rep.levels[l] / maxLevel) * 100) + '%"></i></span><b>' + rep.levels[l] + '</b></li>').join('') +
      '</ul></section>';

    const exportsBlock = '<section class="block export"><h2 class="h-sec">' + esc(t('exportTitle')) + '</h2><div class="export-grid">' +
      '<button type="button" class="export-btn" data-act="exportExcel">' + ICON.sheet + '<span>' + esc(t('downloadExcel')) + '</span><small>.xlsx</small></button>' +
      '<button type="button" class="export-btn" data-act="exportWord">' + ICON.doc + '<span>' + esc(t('downloadWord')) + '</span><small>.docx</small></button>' +
      '<button type="button" class="export-btn" data-act="exportPrint">' + ICON.print + '<span>' + esc(t('print')) + '</span><small>PDF</small></button>' +
      '</div></section>';

    const showActs = o.includeActivities;
    const head = '<tr><th class="c-idx">#</th><th class="c-name">' + esc(t('name')) + '</th>' +
      (showActs ? rep.acts.map((a) => '<th' + (a.released ? '' : ' class="is-unreleased" title="' + esc(t('notReleased')) + '"') + '><span>' + esc(a.name) + '</span><small>' + fmt(a.marks) + '</small></th>').join('') +
        (rep.showCoursework ? '<th class="c-strong"><span>' + esc(t('coursework')) + '</span><small>' + fmt(rep.courseworkMax) + '</small></th>' : '') : '') +
      '<th class="c-total"><span>' + esc(t('total')) + '</span><small>' + fmt(rep.max) + '</small></th><th>' + esc(t('level')) + '</th></tr>';
    const body = rep.rows.map((r) => '<tr><td class="c-idx">' + r.n + '</td><td class="c-name">' + esc(r.st.name) + '</td>' +
      (showActs ? r.cells.map((v) => '<td>' + (v === '' ? '<span class="blank">—</span>' : fmt(v)) + '</td>').join('') +
        (rep.showCoursework ? '<td class="c-strong">' + fmt(r.coursework) + '</td>' : '') : '') +
      '<td class="c-total">' + fmt(r.total) + '</td><td class="lv-cell lv--' + r.level + '">' + esc(t('level_' + r.level)) + '</td></tr>').join('');

    return options + stats + exportsBlock + levels +
      '<section class="block"><h2 class="h-sec">' + esc(t('gradebook')) + '</h2>' +
      '<div class="table-wrap" tabindex="0"><table class="gradebook"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></section>';
  };

  // Warm the export libraries while the teacher looks at the report, so the download starts right away.
  T.after.report = () => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 800));
    idle(() => { X().loadScript(X().LIBS.excel).catch(() => {}); X().loadScript(X().LIBS.docx).catch(() => {}); });
  };

  CHANGES.reportOpt = (el) => {
    S.report[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value;
    rerender();
  };

  async function runExport(btn, kind) {
    await busy(btn, async () => {
      const small = btn.querySelector('small');
      const old = small ? small.textContent : '';
      if (small) small.textContent = t('preparing');
      try {
        const rep = buildReport(S.cur, S.report);
        await X()[kind](rep, exportMeta());
      } catch (e) {
        console.error(e);
        toast(t('err_EXPORT'), 'error');
      } finally {
        if (small) small.textContent = old;
      }
    });
  }

  ACTIONS.exportExcel = (btn) => runExport(btn, 'excel');
  ACTIONS.exportWord = (btn) => runExport(btn, 'word');
  ACTIONS.exportPrint = () => X().print(buildReport(S.cur, S.report), exportMeta());

  window.NimreReport = { buildReport, parseRoster };
})();
