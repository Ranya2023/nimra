/* Nimre — router and startup */
(() => {
  'use strict';
  const N = window.Nimre;
  const { S, ACTIONS } = N;

  function route() {
    S.seq++;
    S.lastUrl = location.href;
    document.body.classList.remove('has-savebar');
    const q = new URLSearchParams(location.search);
    const subject = (q.get('s') || '').trim().toUpperCase();
    const token = (q.get('t') || '').trim();
    const student = window.NimreStudent;
    const teacher = window.NimreTeacher;

    if (subject && token) return student.gradesView(subject, token);
    if (subject) return student.requestView(subject);

    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'login') return teacher.loginView();
    if (parts[0] === 'subject' && parts[1]) {
      if (!S.token) return N.go(location.pathname + '#/login', { replace: true, force: true });
      return teacher.subjectView(decodeURIComponent(parts[1]).toUpperCase(), parts[2]);
    }
    if (parts[0] === 'teacher' || S.token) {
      if (!S.token) return N.go(location.pathname + '#/login', { replace: true, force: true });
      return teacher.dashboardView();
    }
    return student.welcomeView();
  }
  N.route = route;

  ACTIONS.lang = () => {
    N.setLang(S.lang === 'ku' ? 'en' : 'ku');
    route();
  };

  // Back button: keep unsaved grades safe.
  window.addEventListener('popstate', async () => {
    if (!S.dirty.size) return route();
    const target = location.href;
    history.pushState(null, '', S.lastUrl);
    if (await N.guardDirty()) {
      history.pushState(null, '', target);
      route();
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    S.installEvent = e;
    if (!S.dirty.size && !document.querySelector('.sheet-wrap') && !document.querySelector('.install-row')) {
      const view = location.search ? 'student' : (S.token ? 'teacher' : 'welcome');
      if (view !== 'teacher' || !S.cur) route();
    }
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  N.applyLang();
  route();
})();
