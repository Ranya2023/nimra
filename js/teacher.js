/* Nimre — teacher: sign in, dashboard, subject screen shell, settings */
(() => {
  'use strict';
  const N = window.Nimre;
  const { S, t, esc, fmt, api, errText, ICON, ACTIONS, FORMS, go, toast, openSheet, closeSheetOf, confirmBox, formError, busy } = N;

  const TABS = ['grades', 'activities', 'students', 'share', 'report'];
  const TAB_LABEL = { grades: 'tabGrades', activities: 'tabActivities', students: 'tabStudents', share: 'tabShare', report: 'tabReport' };
  const teacherHome = () => location.pathname + '#/teacher';
  const subjectUrl = (id, tab) => location.pathname + '#/subject/' + id + '/' + (tab || 'grades');

  function handleError(e, { silent = false } = {}) {
    if (e && e.code === 'AUTH') {
      toast(t('err_AUTH'), 'error');
      S.dirty.clear();
      go(location.pathname + '#/login', { replace: true, force: true });
      return true;
    }
    if (!silent) toast(errText(e), 'error');
    return false;
  }

  function teacherBar({ back = false, title = '', sub = '', actions = '' } = {}) {
    return '<header class="bar">' +
      (back
        ? '<button type="button" class="icon-btn icon-btn--bar" data-act="goHome" aria-label="' + esc(t('back')) + '">' + ICON.back + '</button>'
        : '<div class="brand">' + N.logo(32) + '<span>' + esc(t('appName')) + '</span></div>') +
      (title ? '<div class="bar-title"><strong>' + esc(title) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' : '<div class="bar-spacer"></div>') +
      '<div class="bar-actions">' + actions + N.langButton() + '</div></header>';
  }

  // ───────────── Sign in / first run ─────────────
  async function loginView() {
    if (S.token) return go(teacherHome(), { replace: true, force: true });
    const seq = S.seq;
    N.setView(authShell(N.loadingBlock()));
    try {
      const res = await api('status');
      if (seq !== S.seq) return;
      N.setView(authShell(res.initialized ? signInForm() : setupForm()));
    } catch (e) {
      if (seq !== S.seq) return;
      N.setView(authShell('<p class="notice notice--error">' + esc(errText(e)) + '</p>' +
        '<button type="button" class="btn btn--ghost btn--block" data-act="retryRoute">' + ICON.refresh + esc(t('refresh')) + '</button>'));
    }
  }

  function authShell(inner) {
    return '<div class="screen screen--auth">' +
      '<header class="bar bar--plain"><button type="button" class="icon-btn" data-act="goWelcome" aria-label="' + esc(t('back')) + '">' + ICON.back + '</button><div class="bar-spacer"></div>' + N.langButton() + '</header>' +
      '<main class="auth"><div class="auth-mark">' + N.logo(72) + '</div>' + inner + '</main></div>';
  }

  function signInForm() {
    return '<form data-form="signIn" class="stack" autocomplete="on">' +
      '<h1 class="h-display">' + esc(t('teacherSignIn')) + '</h1>' +
      '<label class="field"><span>' + esc(t('password')) + '</span>' +
      '<input type="password" name="password" autocomplete="current-password" required minlength="6" dir="ltr"></label>' +
      '<button class="btn btn--primary btn--block">' + esc(t('signIn')) + '</button></form>';
  }

  function setupForm() {
    return '<form data-form="setup" class="stack">' +
      '<h1 class="h-display">' + esc(t('firstRunTitle')) + '</h1>' +
      '<p class="lead">' + esc(t('firstRunText')) + '</p>' +
      '<label class="field"><span>' + esc(t('teacherName')) + '</span><input name="teacherName" required maxlength="80" autocomplete="name"></label>' +
      '<label class="field"><span>' + esc(t('university')) + '</span><input name="university" maxlength="120" placeholder="' + (S.lang === 'ku' ? 'زانکۆی ڕاپەڕین' : 'University of Raparin') + '"></label>' +
      '<label class="field"><span>' + esc(t('password')) + '</span><input type="password" name="password" required minlength="6" autocomplete="new-password" dir="ltr"></label>' +
      '<label class="field"><span>' + esc(t('confirmPassword')) + '</span><input type="password" name="password2" required minlength="6" autocomplete="new-password" dir="ltr"></label>' +
      '<button class="btn btn--primary btn--block">' + esc(t('createAccount')) + '</button></form>';
  }

  FORMS.signIn = (form) => busy(form.querySelector('button'), async () => {
    formError(form, '');
    try {
      const res = await api('login', { password: form.password.value, appUrl: N.appBase() });
      N.setToken(res.token);
      S.settings = res.settings;
      go(teacherHome(), { replace: true, force: true });
    } catch (e) {
      formError(form, errText(e));
    }
  });

  FORMS.setup = (form) => busy(form.querySelector('button'), async () => {
    formError(form, '');
    if (form.password.value !== form.password2.value) return formError(form, t('passwordsDontMatch'));
    try {
      const res = await api('init', {
        password: form.password.value, teacherName: form.teacherName.value, university: form.university.value, appUrl: N.appBase()
      });
      N.setToken(res.token);
      S.settings = res.settings;
      go(teacherHome(), { replace: true, force: true });
    } catch (e) {
      formError(form, errText(e));
    }
  });

  // ───────────── Dashboard ─────────────
  async function dashboardView() {
    const seq = S.seq;
    S.cur = null;
    renderDashboard();
    try {
      const d = await api('bootstrap', { appUrl: N.appBase() });
      if (seq !== S.seq) return;
      S.settings = d.settings;
      S.subjects = d.subjects;
      S.mailQuota = d.mailQuota;
      renderDashboard();
    } catch (e) {
      if (seq !== S.seq) return;
      if (!handleError(e, { silent: true }) && !S.subjects) {
        N.setView(teacherBar({ actions: settingsBtn() }) + '<main class="page"><p class="notice notice--error">' + esc(errText(e)) + '</p>' +
          '<button type="button" class="btn btn--ghost" data-act="retryRoute">' + ICON.refresh + esc(t('refresh')) + '</button></main>');
      } else if (S.subjects) {
        toast(errText(e), 'error');
      }
    }
  }

  const settingsBtn = () => '<button type="button" class="icon-btn icon-btn--bar" data-act="settings" aria-label="' + esc(t('settings')) + '">' + ICON.gear + '</button>';

  function renderDashboard() {
    const name = S.settings && S.settings.teacherName;
    let body;
    if (!S.subjects) {
      body = N.loadingBlock();
    } else if (!S.subjects.length) {
      body = '<div class="empty"><p>' + esc(t('emptySubjects')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-act="newSubject">' + ICON.plus + esc(t('newSubject')) + '</button></div>';
    } else {
      const groups = new Map();
      S.subjects.forEach((s) => {
        const key = s.department || '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
      });
      body = [...groups.entries()].map(([dept, list]) =>
        '<section class="dept"><h2 class="dept-name">' + esc(dept || t('noDepartment')) + '</h2><ul class="subject-list">' +
        list.map(subjectRow).join('') + '</ul></section>').join('');
    }

    N.setView(
      teacherBar({ actions: settingsBtn() }) +
      '<main class="page page--dash">' +
      '<div class="greet"><h1 class="h-display">' + esc(name ? t('hello', { name }) : t('helloNoName')) + '</h1>' +
      (S.settings && S.settings.university ? '<p class="muted">' + esc(S.settings.university) + '</p>' : '') + '</div>' +
      installRow() + body + '</main>' +
      (S.subjects && S.subjects.length ? '<button type="button" class="fab" data-act="newSubject">' + ICON.plus + '<span>' + esc(t('newSubject')) + '</span></button>' : '')
    );
  }

  function subjectRow(s) {
    const pct = Math.min(100, s.distributed || 0);
    return '<li><a class="subject-row" href="' + esc(subjectUrl(s.id)) + '" data-act="openSubject" data-id="' + esc(s.id) + '" style="--tab:' + esc(s.color) + '">' +
      '<span class="subject-main"><strong>' + esc(s.name) + '</strong>' +
      '<span class="muted">' + esc(N.metaJoin([s.stage, s.year])) + '</span></span>' +
      '<span class="subject-facts"><span>' + esc(t('studentsCount', { n: s.studentCount })) + '</span><span>' + esc(t('activitiesCount', { n: s.activityCount })) + '</span></span>' +
      '<span class="meter' + (pct >= 100 ? ' meter--full' : '') + '" role="img" aria-label="' + esc(t('distributedOf', { n: fmt(s.distributed) })) + '"><i style="inline-size:' + pct + '%"></i></span>' +
      '<span class="meter-label">' + esc(t('distributedOf', { n: fmt(s.distributed) })) + '</span></a></li>';
  }

  function installRow() {
    if (N.isStandalone()) return '';
    if (S.installEvent) {
      return '<button type="button" class="install-row" data-act="install">' + ICON.install + '<span>' + esc(t('install')) + '</span></button>';
    }
    return '';
  }

  ACTIONS.install = async () => {
    if (!S.installEvent) return;
    S.installEvent.prompt();
    try { await S.installEvent.userChoice; } catch (e) { /* ignore */ }
    S.installEvent = null;
    N.route();
  };

  ACTIONS.openSubject = (el) => go(subjectUrl(el.dataset.id));
  ACTIONS.goHome = () => go(teacherHome());
  ACTIONS.retryRoute = () => N.route();

  // ───────────── Subject form ─────────────
  function defaultYear() {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 7 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
  }

  function subjectForm(subject) {
    const s = subject || { color: N.SUBJECT_COLORS[(S.subjects ? S.subjects.length : 0) % N.SUBJECT_COLORS.length], year: defaultYear() };
    const depts = [...new Set((S.subjects || []).map((x) => x.department).filter(Boolean))];
    openSheet({
      title: subject ? t('editSubject') : t('newSubject'),
      body: '<form data-form="subject" class="stack">' +
        '<input type="hidden" name="id" value="' + esc(s.id || '') + '">' +
        '<label class="field"><span>' + esc(t('subjectName')) + '</span><input name="name" required maxlength="120" value="' + esc(s.name || '') + '"></label>' +
        '<label class="field"><span>' + esc(t('department')) + '</span><input name="department" maxlength="80" list="dept-options" value="' + esc(s.department || '') + '">' +
        '<datalist id="dept-options">' + depts.map((d) => '<option value="' + esc(d) + '">').join('') + '</datalist></label>' +
        '<div class="grid2">' +
        '<label class="field"><span>' + esc(t('stage')) + '</span><input name="stage" maxlength="40" value="' + esc(s.stage || '') + '"></label>' +
        '<label class="field"><span>' + esc(t('semester')) + '</span><input name="semester" maxlength="20" value="' + esc(s.semester || '') + '"></label></div>' +
        '<label class="field"><span>' + esc(t('academicYear')) + '</span><input name="year" maxlength="20" dir="ltr" value="' + esc(s.year || '') + '"></label>' +
        '<fieldset class="field"><legend>' + esc(t('color')) + '</legend><div class="swatches">' +
        N.SUBJECT_COLORS.map((c) => '<label class="swatch-pick" style="--c:' + c + '"><input type="radio" name="color" value="' + c + '"' + (c.toLowerCase() === String(s.color).toLowerCase() ? ' checked' : '') + '><span></span></label>').join('') +
        '</div></fieldset>' +
        '<div class="sheet-actions"><button class="btn btn--primary">' + esc(t('save')) + '</button>' +
        (subject ? '<button type="button" class="btn btn--danger-ghost" data-act="deleteSubject" data-id="' + esc(s.id) + '">' + ICON.trash + esc(t('deleteSubject')) + '</button>' : '') +
        '</div></form>'
    });
  }

  ACTIONS.newSubject = () => subjectForm(null);
  ACTIONS.editSubject = () => S.cur && subjectForm(S.cur.subject);

  FORMS.subject = (form) => busy(form.querySelector('.btn--primary'), async () => {
    formError(form, '');
    const f = new FormData(form);
    const subject = Object.fromEntries(f.entries());
    try {
      const res = await api('saveSubject', { subject });
      closeSheetOf(form);
      toast(t('saved'));
      if (subject.id && S.cur) {
        S.cur.subject = res.subject;
        N.route();
      } else {
        S.subjects = null;
        go(subjectUrl(res.subject.id, 'activities'));
      }
    } catch (e) {
      if (!handleError(e, { silent: true })) formError(form, errText(e));
    }
  });

  ACTIONS.deleteSubject = async (el) => {
    const subject = S.cur ? S.cur.subject : (S.subjects || []).find((x) => x.id === el.dataset.id);
    if (!subject) return;
    if (!(await confirmBox(t('confirmDeleteSubject', { name: subject.name })))) return;
    try {
      await api('deleteSubject', { subjectId: subject.id });
      N.closeAllSheets();
      S.cur = null;
      S.subjects = null;
      S.dirty.clear();
      toast(t('saved'));
      go(teacherHome(), { replace: true, force: true });
    } catch (e) {
      handleError(e);
    }
  };

  // ───────────── Subject screen ─────────────
  function toCur(d) {
    const scores = new Map();
    (d.scores || []).forEach(([a, s, v]) => scores.set(a + '|' + s, Number(v)));
    return { subject: d.subject, students: d.students, activities: d.activities, scores };
  }

  async function subjectView(id, tab) {
    const seq = S.seq;
    S.tab = TABS.indexOf(tab) >= 0 ? tab : 'grades';
    if (S.cur && S.cur.subject.id === id) return renderSubject();
    S.cur = null;
    S.activityId = null;
    S.dirty.clear();
    N.setView(teacherBar({ back: true }) + tabsNav(id) + '<main class="page">' + N.loadingBlock() + '</main>');
    await loadSubject(id, seq);
  }

  async function loadSubject(id, seq) {
    try {
      const d = await api('getSubject', { subjectId: id });
      if (seq !== undefined && seq !== S.seq) return;
      S.cur = toCur(d);
      S.settings = d.settings;
      S.mailQuota = d.mailQuota;
      renderSubject();
    } catch (e) {
      if (seq !== undefined && seq !== S.seq) return;
      if (handleError(e, { silent: true })) return;
      if (e.code === 'SUBJECT_NOT_FOUND') { toast(errText(e), 'error'); return go(teacherHome(), { replace: true, force: true }); }
      N.setView(teacherBar({ back: true }) + '<main class="page"><p class="notice notice--error">' + esc(errText(e)) + '</p>' +
        '<button type="button" class="btn btn--ghost" data-act="retryRoute">' + ICON.refresh + esc(t('refresh')) + '</button></main>');
    }
  }

  function tabsNav(id) {
    return '<nav class="tabs" aria-label="' + esc(t('subjects')) + '"><div class="tabs-track">' +
      TABS.map((k) => '<a href="' + esc(subjectUrl(id, k)) + '" class="tab' + (S.tab === k ? ' is-active' : '') + '" data-act="tab" data-tab="' + k + '"' + (S.tab === k ? ' aria-current="page"' : '') + '>' + esc(t(TAB_LABEL[k])) + '</a>').join('') +
      '</div></nav>';
  }

  function renderSubject() {
    const cur = S.cur;
    if (!cur) return;
    const s = cur.subject;
    const sep = S.lang === 'ku' ? '، ' : ', ';
    const actions =
      '<button type="button" class="icon-btn icon-btn--bar" data-act="reloadSubject" aria-label="' + esc(t('refresh')) + '">' + ICON.refresh + '</button>' +
      '<button type="button" class="icon-btn icon-btn--bar" data-act="editSubject" aria-label="' + esc(t('editSubject')) + '">' + ICON.edit + '</button>';
    const T = window.NimreTabs;
    N.setView(
      teacherBar({ back: true, title: s.name, sub: [s.department, s.stage].filter(Boolean).join(sep), actions }) +
      tabsNav(s.id) +
      '<main class="page page--subject" style="--tab:' + esc(s.color) + '">' + T[S.tab](cur) + '</main>'
    );
    if (T.after[S.tab]) T.after[S.tab](cur);
    // Center the active tab and chosen activity inside their strips (without moving the page).
    ['.tab.is-active', '.chip.is-on'].forEach((sel) => {
      const el = document.querySelector(sel);
      const strip = el && el.closest('.tabs, .chips');
      if (!strip) return;
      const b = strip.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      strip.scrollLeft += (r.left + r.width / 2) - (b.left + b.width / 2);
    });
  }

  ACTIONS.tab = (el) => {
    const tab = el.dataset.tab;
    if (!S.cur || tab === S.tab) return;
    go(subjectUrl(S.cur.subject.id, tab), { replace: true });
    window.scrollTo(0, 0);
  };

  ACTIONS.reloadSubject = async (el) => {
    if (!S.cur || !(await N.guardDirty())) return;
    busy(el, () => loadSubject(S.cur.subject.id));
  };

  // ───────────── Settings ─────────────
  ACTIONS.settings = () => {
    const st = S.settings || {};
    openSheet({
      title: t('settings'),
      body:
        '<form data-form="settings" class="stack">' +
        '<label class="field"><span>' + esc(t('teacherName')) + '</span><input name="teacherName" maxlength="80" value="' + esc(st.teacherName || '') + '"></label>' +
        '<label class="field"><span>' + esc(t('university')) + '</span><input name="university" maxlength="120" value="' + esc(st.university || '') + '"></label>' +
        '<button class="btn btn--primary">' + esc(t('save')) + '</button></form>' +
        '<hr class="rule">' +
        '<div class="field"><span class="field-label">' + esc(t('language')) + '</span><div class="seg">' +
        '<button type="button" class="seg-btn' + (S.lang === 'ku' ? ' is-on' : '') + '" data-act="setLang" data-lang="ku" lang="ckb">کوردی</button>' +
        '<button type="button" class="seg-btn' + (S.lang === 'en' ? ' is-on' : '') + '" data-act="setLang" data-lang="en" lang="en">English</button></div></div>' +
        '<hr class="rule">' +
        '<form data-form="password" class="stack"><h3 class="h-sub">' + ICON.lock + esc(t('changePassword')) + '</h3>' +
        '<label class="field"><span>' + esc(t('currentPassword')) + '</span><input type="password" name="oldPassword" required autocomplete="current-password" dir="ltr"></label>' +
        '<label class="field"><span>' + esc(t('newPassword')) + '</span><input type="password" name="newPassword" required minlength="6" autocomplete="new-password" dir="ltr"></label>' +
        '<button class="btn btn--ghost">' + esc(t('changePassword')) + '</button></form>' +
        '<hr class="rule">' +
        '<button type="button" class="btn btn--danger-ghost btn--block" data-act="signOut">' + esc(t('signOut')) + '</button>' +
        '<p class="version muted">Nimre ' + esc(N.CFG.VERSION || '') + '</p>'
    });
  };

  ACTIONS.setLang = (el) => {
    N.setLang(el.dataset.lang);
    N.closeAllSheets();
    N.route();
  };

  FORMS.settings = (form) => busy(form.querySelector('button'), async () => {
    formError(form, '');
    try {
      const res = await api('saveSettings', { settings: { teacherName: form.teacherName.value, university: form.university.value } });
      S.settings = res.settings;
      closeSheetOf(form);
      toast(t('saved'));
      N.route();
    } catch (e) {
      if (!handleError(e, { silent: true })) formError(form, errText(e));
    }
  });

  FORMS.password = (form) => busy(form.querySelector('button'), async () => {
    formError(form, '');
    try {
      const res = await api('changePassword', { oldPassword: form.oldPassword.value, newPassword: form.newPassword.value });
      N.setToken(res.token);
      closeSheetOf(form);
      toast(t('passwordChanged'));
    } catch (e) {
      formError(form, errText(e));
    }
  });

  ACTIONS.signOut = async () => {
    if (!(await N.guardDirty())) return;
    N.setToken('');
    S.subjects = null;
    S.cur = null;
    S.settings = null;
    go(location.pathname, { replace: true, force: true });
  };

  window.NimreTeacher = { loginView, dashboardView, subjectView, renderSubject, handleError, subjectUrl, loadSubject };
})();
