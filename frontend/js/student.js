/* Nimre — student side: welcome, request grades by email, personal grades page */
(() => {
  'use strict';
  const N = window.Nimre;
  const { S, LS, t, esc, fmt, r2, api, errText, ICON, ACTIONS, FORMS, go, toast, formError, busy, storage } = N;

  const savedLinks = () => storage.json(LS.links, []).filter((l) => l && l.s && l.t);

  function saveLink(entry) {
    const links = savedLinks().filter((l) => l.s !== entry.s);
    links.unshift(entry);
    storage.set(LS.links, JSON.stringify(links.slice(0, 20)));
  }

  function removeLink(s) {
    storage.set(LS.links, JSON.stringify(savedLinks().filter((l) => l.s !== s)));
    storage.remove(LS.cache + s);
  }

  function plainBar(extra = '') {
    return '<header class="bar bar--plain"><a class="brand brand--dark" href="' + esc(location.pathname) + '" data-act="goWelcome">' + N.logo(32) + '<span>' + esc(t('appName')) + '</span></a>' +
      '<div class="bar-spacer"></div><div class="bar-actions">' + extra + N.langButton() + '</div></header>';
  }

  function installHint() {
    if (N.isStandalone()) return '';
    if (S.installEvent) return '<button type="button" class="install-row" data-act="install">' + ICON.install + '<span>' + esc(t('install')) + '</span></button>';
    if (N.isIOS()) return '<p class="install-hint">' + ICON.share + '<span>' + esc(t('installHintIos')) + '</span></p>';
    return '';
  }

  ACTIONS.goWelcome = () => go(location.pathname);

  // ───────────── Welcome ─────────────
  function welcomeView() {
    const links = savedLinks();
    N.setView(
      '<div class="screen screen--welcome">' + plainBar() +
      '<main class="welcome">' +
      '<div class="welcome-mark">' + N.logo(96) + '</div>' +
      '<h1 class="h-hero">' + esc(t('welcomeTitle')) + '</h1>' +
      '<p class="lead">' + esc(t('welcomeText')) + '</p>' +
      '<form data-form="code" class="code-form">' +
      '<label class="field"><span>' + esc(t('subjectCode')) + '</span>' +
      '<input name="code" class="code-input" required maxlength="6" minlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" dir="ltr" placeholder="••••••"></label>' +
      '<button class="btn btn--primary btn--block">' + esc(t('continue')) + '</button></form>' +
      (links.length
        ? '<section class="block"><h2 class="h-sec">' + esc(t('mySubjects')) + '</h2><ul class="rows link-list">' +
          links.map((l) => '<li class="link-row"><a href="' + esc(location.pathname + '?s=' + encodeURIComponent(l.s) + '&t=' + encodeURIComponent(l.t)) + '" data-act="openSaved" data-s="' + esc(l.s) + '" data-t="' + esc(l.t) + '" style="--tab:' + esc(l.color || '#1E7A5A') + '">' +
            '<strong>' + esc(l.subjectName || l.s) + '</strong><small>' + esc(l.studentName || '') + '</small></a>' +
            '<button type="button" class="icon-btn" data-act="removeSaved" data-s="' + esc(l.s) + '" aria-label="' + esc(t('removeFromList')) + '">' + ICON.x + '</button></li>').join('') +
          '</ul></section>'
        : '') +
      installHint() +
      '<footer class="welcome-foot"><button type="button" class="link-btn" data-act="goLogin">' + ICON.lock + esc(t('teacherSignIn')) + '</button></footer>' +
      '</main></div>'
    );
  }

  FORMS.code = (form) => {
    const code = N.normDigits(form.code.value).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return formError(form, t('err_SUBJECT_NOT_FOUND'));
    go(location.pathname + '?s=' + code);
  };

  ACTIONS.openSaved = (el) => go(location.pathname + '?s=' + encodeURIComponent(el.dataset.s) + '&t=' + encodeURIComponent(el.dataset.t));
  ACTIONS.removeSaved = (el) => { removeLink(el.dataset.s); welcomeView(); };
  ACTIONS.goLogin = () => go(location.pathname + '#/login');

  // ───────────── Request grades by email ─────────────
  async function requestView(subjectId) {
    const seq = S.seq;
    const mine = savedLinks().find((l) => l.s === subjectId);
    N.setView('<div class="screen">' + plainBar() + '<main class="page page--narrow">' + N.loadingBlock() + '</main></div>');
    try {
      const d = await api('subjectInfo', { subjectId });
      if (seq !== S.seq) return;
      const s = d.subject;
      N.setView(
        '<div class="screen">' + plainBar() +
        '<main class="page page--narrow">' +
        subjectCard(s, d.university, d.teacherName) +
        (mine ? '<button type="button" class="btn btn--primary btn--block" data-act="openSaved" data-s="' + esc(mine.s) + '" data-t="' + esc(mine.t) + '">' + esc(t('mySubjects')) + ': ' + esc(mine.studentName || '') + '</button>' : '') +
        '<div id="request-slot">' + requestForm(subjectId) + '</div>' +
        '</main></div>'
      );
    } catch (e) {
      if (seq !== S.seq) return;
      N.setView('<div class="screen">' + plainBar() + '<main class="page page--narrow">' +
        '<p class="notice notice--error">' + esc(errText(e)) + '</p>' +
        (e.code === 'NETWORK' ? '<button type="button" class="btn btn--ghost btn--block" data-act="retryRoute">' + ICON.refresh + esc(t('refresh')) + '</button>' : '') +
        '<button type="button" class="btn btn--ghost btn--block" data-act="goWelcome">' + esc(t('back')) + '</button></main></div>');
    }
  }

  function subjectCard(s, university, teacherName) {
    return '<section class="subject-card" style="--tab:' + esc(s.color || '#1E7A5A') + '">' +
      (university ? '<small>' + esc(university) + '</small>' : '') +
      '<h1>' + esc(s.name) + '</h1>' +
      '<p>' + esc(N.metaJoin([s.department, s.stage, s.year])) + '</p>' +
      (teacherName ? '<p class="subject-card-teacher">' + esc(t('teacher')) + ': ' + esc(teacherName) + '</p>' : '') +
      '</section>';
  }

  function requestForm(subjectId) {
    return '<form data-form="requestGrades" class="stack request-form">' +
      '<input type="hidden" name="subjectId" value="' + esc(subjectId) + '">' +
      '<h2 class="h-sec">' + esc(t('getMyGrades')) + '</h2>' +
      '<p class="muted">' + esc(t('enterEmailText')) + '</p>' +
      '<label class="field"><span>' + esc(t('email')) + '</span>' +
      '<input type="email" name="email" required autocomplete="email" autocapitalize="off" spellcheck="false" dir="ltr" inputmode="email"></label>' +
      '<button class="btn btn--primary btn--block">' + ICON.mail + esc(t('sendMyGrades')) + '</button></form>';
  }

  FORMS.requestGrades = (form) => busy(form.querySelector('button'), async () => {
    formError(form, '');
    const subjectId = form.subjectId.value;
    try {
      const res = await api('requestGrades', { subjectId, email: form.email.value });
      document.getElementById('request-slot').innerHTML =
        '<section class="sent" role="status">' +
        '<div class="sent-mark">' + ICON.mail + '</div>' +
        '<h2 class="h-sec">' + esc(t('gradesSentTitle')) + '</h2>' +
        '<p>' + esc(t('gradesSentText', { email: res.sentTo })) + '</p>' +
        '<button type="button" class="btn btn--ghost" data-act="requestAgain" data-s="' + esc(subjectId) + '">' + esc(t('sendAgain')) + '</button></section>';
    } catch (e) {
      formError(form, errText(e));
    }
  });

  ACTIONS.requestAgain = (el) => { document.getElementById('request-slot').innerHTML = requestForm(el.dataset.s); };

  // ───────────── Personal grades page ─────────────
  async function gradesView(subjectId, token) {
    const seq = S.seq;
    const cached = storage.json(LS.cache + subjectId, null);
    const usable = cached && cached.token === token ? cached.data : null;
    if (usable) renderGrades(usable, { stale: true }); else N.setView('<div class="screen">' + plainBar() + '<main class="page page--narrow">' + N.loadingBlock() + '</main></div>');

    try {
      const d = await api('studentView', { subjectId, token });
      if (seq !== S.seq) return;
      storage.set(LS.cache + subjectId, JSON.stringify({ token, data: d }));
      saveLink({ s: subjectId, t: token, subjectName: d.subject.name, studentName: d.student.name, color: d.subject.color });
      renderGrades(d, { animate: !usable });
    } catch (e) {
      if (seq !== S.seq) return;
      if (e.code === 'NETWORK' && usable) {
        renderGrades(usable, { offline: true });
        return;
      }
      if (e.code === 'INVALID_LINK' || e.code === 'SUBJECT_NOT_FOUND') removeLink(subjectId);
      N.setView('<div class="screen">' + plainBar() + '<main class="page page--narrow">' +
        '<p class="notice notice--error">' + esc(errText(e)) + '</p>' +
        (e.code === 'INVALID_LINK' ? '<button type="button" class="btn btn--primary btn--block" data-act="toRequest" data-s="' + esc(subjectId) + '">' + ICON.mail + esc(t('getMyGrades')) + '</button>' : '') +
        (e.code === 'NETWORK' ? '<button type="button" class="btn btn--ghost btn--block" data-act="retryRoute">' + ICON.refresh + esc(t('refresh')) + '</button>' : '') +
        '</main></div>');
    }
  }

  ACTIONS.toRequest = (el) => go(location.pathname + '?s=' + encodeURIComponent(el.dataset.s));
  ACTIONS.refreshGrades = (el) => busy(el, () => N.route());

  function renderGrades(d, { offline = false, animate = false, stale = false } = {}) {
    const s = d.subject;
    const pct = d.releasedMax ? r2((d.total / d.releasedMax) * 100) : 0;
    const level = N.levelOf(pct);
    const has = d.items.length > 0;

    const ring =
      '<div class="ring' + (animate ? ' ring--draw' : '') + '">' +
      '<svg viewBox="0 0 240 240" aria-hidden="true"><path d="' + N.ringPath(120, 120, 98, 5) + '" pathLength="100"/></svg>' +
      '<div class="ring-num"><b>' + fmt(d.total) + '</b><span>' + esc(t('outOfReleased', { n: fmt(d.releasedMax) })) + '</span></div></div>';

    const list = d.items.map((it) => {
      const w = it.score === '' || !it.marks ? 0 : Math.min(100, (it.score / it.marks) * 100);
      return '<li class="result">' +
        '<span class="result-name"><strong>' + esc(it.name) + '</strong>' + (it.name.indexOf(t('type_' + it.type)) === 0 ? '' : '<small>' + esc(t('type_' + it.type)) + '</small>') + '</span>' +
        '<span class="result-score" dir="ltr">' + (it.score === '' ? '<em>' + esc(t('notEntered')) + '</em>' : '<b>' + fmt(it.score) + '</b>') + '<span>/' + fmt(it.marks) + '</span></span>' +
        '<span class="result-bar" aria-hidden="true"><i style="inline-size:' + w + '%"></i></span></li>';
    }).join('');

    N.setView(
      '<div class="screen">' +
      plainBar('<button type="button" class="icon-btn" data-act="refreshGrades" aria-label="' + esc(t('refresh')) + '">' + ICON.refresh + '</button>') +
      '<main class="page page--narrow student">' +
      (offline ? '<p class="notice">' + esc(t('offlineCopy')) + '</p>' : '') +
      '<section class="report-head" style="--tab:' + esc(s.color || '#1E7A5A') + '">' +
      (d.university ? '<small>' + esc(d.university) + '</small>' : '') +
      '<h1>' + esc(s.name) + '</h1><p>' + esc(N.metaJoin([s.department, s.stage, s.year])) + '</p>' +
      (d.teacherName ? '<p class="muted">' + esc(t('teacher')) + ': ' + esc(d.teacherName) + '</p>' : '') + '</section>' +
      '<section class="score-hero" aria-label="' + esc(t('releasedTotal')) + '">' +
      '<p class="student-name">' + esc(d.student.name) + '</p>' +
      (has
        ? ring + '<p class="hero-caption">' + esc(t('releasedTotal')) + '</p>' +
          '<p class="hero-pct"><span>' + esc(t('percentOfReleased', { p: fmt(pct) })) + '</span><span class="level-badge lv--' + level + '">' + esc(t('level_' + level)) + '</span></p>'
        : '<p class="empty-text">' + esc(t('noGradesYet')) + '</p>') +
      '</section>' +
      (has ? '<ol class="rows result-list">' + list + '</ol>' : '') +
      (d.pending > 0 ? '<p class="pending">' + esc(t('pendingActivities', { n: d.pending })) + '</p>' : '') +
      '<p class="updated muted small">' + esc(t('updatedAt', { t: N.dateText(d.updatedAt, true) })) + (stale ? ' …' : '') + '</p>' +
      installHint() +
      '</main></div>'
    );
  }

  window.NimreStudent = { welcomeView, requestView, gradesView };
})();
