/* Nimre — subject tabs part 1: grading and distribution */
(() => {
  'use strict';
  const N = window.Nimre;
  const { S, t, esc, fmt, r2, api, errText, ICON, ACTIONS, FORMS, CHANGES, INPUTS, toast, openSheet, closeSheetOf, confirmBox, formError, busy } = N;
  const T = (window.NimreTabs = window.NimreTabs || { after: {} });
  const teacher = () => window.NimreTeacher;
  const rerender = () => teacher().renderSubject();

  const typeLabel = (type) => t('type_' + type);
  const used = (cur, exceptId) => r2(cur.activities.filter((a) => a.id !== exceptId).reduce((s, a) => s + a.marks, 0));

  function emptyBlock(message, tab, label) {
    return '<div class="empty"><p>' + esc(message) + '</p>' +
      '<button type="button" class="btn btn--primary" data-act="tab" data-tab="' + tab + '">' + esc(label) + '</button></div>';
  }

  // ═════════════ Grading ═════════════
  T.grades = (cur) => {
    if (!cur.activities.length) return emptyBlock(t('needActivitiesFirst'), 'activities', t('goToActivities'));
    if (!cur.students.length) return emptyBlock(t('needStudentsFirst'), 'students', t('goToStudents'));
    if (!S.activityId || !cur.activities.some((a) => a.id === S.activityId)) S.activityId = cur.activities[0].id;
    const act = cur.activities.find((a) => a.id === S.activityId);
    const entered = cur.students.filter((st) => cur.scores.has(act.id + '|' + st.id)).length;

    const chips = '<div class="chips" role="tablist" aria-label="' + esc(t('chooseActivity')) + '">' +
      cur.activities.map((a) => '<button type="button" role="tab" class="chip' + (a.id === act.id ? ' is-on' : '') + '" aria-selected="' + (a.id === act.id) + '" data-act="pickActivity" data-id="' + esc(a.id) + '">' +
        '<span>' + esc(a.name) + '</span><b>' + fmt(a.marks) + '</b>' + (a.released ? '<i class="dot-released" title="' + esc(t('released')) + '"></i>' : '') + '</button>').join('') +
      '</div>';

    const rows = cur.students.map((st, i) => {
      const saved = cur.scores.get(act.id + '|' + st.id);
      const dirty = S.dirty.has(st.id);
      const value = dirty ? S.dirty.get(st.id) : saved === undefined ? '' : fmt(saved);
      const invalid = dirty && !validScore(value, act.marks);
      return '<li class="score-row" data-name="' + esc(st.name.toLowerCase()) + '">' +
        '<span class="idx">' + (i + 1) + '</span>' +
        '<label class="st-name" for="sc-' + esc(st.id) + '">' + esc(st.name) + '</label>' +
        '<span class="score-cell"><input id="sc-' + esc(st.id) + '" class="score-input' + (dirty ? ' is-dirty' : '') + (invalid ? ' is-invalid' : '') + '"' +
        ' type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" dir="ltr" maxlength="6"' +
        ' data-input="score" data-sid="' + esc(st.id) + '" value="' + esc(value) + '" aria-describedby="of-' + esc(act.id) + '">' +
        '<span class="of" aria-hidden="true">/' + fmt(act.marks) + '</span></span></li>';
    }).join('');

    return chips +
      '<section class="act-head">' +
      '<div><h2 class="h-sec">' + esc(act.name) + '</h2>' +
      '<p class="muted" id="of-' + esc(act.id) + '">' + esc(t('outOf', { n: fmt(act.marks) })) + ' <span class="sep-dot"></span> ' + esc(t('enteredCount', { a: entered, b: cur.students.length })) + '</p></div>' +
      releaseSwitch(act) + '</section>' +
      '<div class="tools">' +
      '<label class="search"><span class="sr-only">' + esc(t('searchStudents')) + '</span>' + ICON.search +
      '<input type="search" data-input="filterRows" data-target=".score-list" placeholder="' + esc(t('searchStudents')) + '"></label>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="fillEmpty">' + esc(t('fillEmpty')) + '</button></div>' +
      '<ol class="rows score-list">' + rows + '</ol>' +
      '<div class="savebar" id="savebar" hidden><span class="savebar-count"></span>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="discardScores">' + esc(t('discard')) + '</button>' +
      '<button type="button" class="btn btn--primary" data-act="saveScores"></button></div>';
  };

  T.after.grades = () => updateSavebar();

  function releaseSwitch(act) {
    return '<label class="switch"><input type="checkbox" data-change="release" data-id="' + esc(act.id) + '"' + (act.released ? ' checked' : '') + '>' +
      '<span class="switch-track" aria-hidden="true"></span><span class="switch-label">' + esc(act.released ? t('released') : t('notReleased')) + '</span></label>';
  }

  function validScore(value, max) {
    if (value === '') return true;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
    const v = Number(value);
    return v >= 0 && v <= max + 1e-9;
  }

  INPUTS.score = (input) => {
    const cur = S.cur;
    const act = cur.activities.find((a) => a.id === S.activityId);
    const normalized = N.normDigits(input.value);
    if (normalized !== input.value) input.value = normalized;
    const sid = input.dataset.sid;
    const saved = cur.scores.get(act.id + '|' + sid);
    const savedText = saved === undefined ? '' : fmt(saved);
    const isSame = normalized === savedText || (normalized !== '' && savedText !== '' && Number(normalized) === Number(savedText));
    if (isSame) S.dirty.delete(sid); else S.dirty.set(sid, normalized);
    input.classList.toggle('is-dirty', !isSame);
    const invalid = !validScore(normalized, act.marks);
    input.classList.toggle('is-invalid', invalid);
    input.setCustomValidity(invalid ? t('scoreTooHigh', { max: fmt(act.marks) }) : '');
    updateSavebar();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList || !e.target.classList.contains('score-input')) return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll('.score-input')].filter((i) => !i.closest('.score-row').hidden);
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) { next.focus(); next.select(); } else { e.target.blur(); }
  });

  function updateSavebar() {
    const bar = document.getElementById('savebar');
    if (!bar) return;
    const n = S.dirty.size;
    bar.hidden = n === 0;
    document.body.classList.toggle('has-savebar', n > 0);
    bar.querySelector('[data-act="saveScores"]').textContent = t('saveChanges', { n });
  }

  INPUTS.filterRows = (input) => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll(input.dataset.target + ' > li').forEach((li) => {
      li.hidden = !!q && (li.dataset.name || '').indexOf(q) < 0;
    });
  };

  ACTIONS.pickActivity = async (el) => {
    if (el.dataset.id === S.activityId) return;
    if (!(await N.guardDirty())) return;
    S.activityId = el.dataset.id;
    document.body.classList.remove('has-savebar');
    rerender();
  };

  ACTIONS.discardScores = () => {
    S.dirty.clear();
    document.body.classList.remove('has-savebar');
    rerender();
  };

  ACTIONS.saveScores = (btn) => busy(btn, async () => {
    const cur = S.cur;
    const act = cur.activities.find((a) => a.id === S.activityId);
    const entries = [...S.dirty.entries()];
    const bad = entries.filter(([, v]) => !validScore(v, act.marks));
    if (bad.length) {
      toast(t('fixInvalid'), 'error');
      const first = document.querySelector('.score-input.is-invalid');
      if (first) first.focus();
      return;
    }
    try {
      const res = await api('saveScores', {
        subjectId: cur.subject.id, activityId: act.id,
        scores: entries.map(([studentId, score]) => ({ studentId, score }))
      });
      [...cur.scores.keys()].forEach((k) => { if (k.indexOf(act.id + '|') === 0) cur.scores.delete(k); });
      res.scores.forEach(([a, s, v]) => cur.scores.set(a + '|' + s, Number(v)));
      S.dirty.clear();
      document.body.classList.remove('has-savebar');
      toast(t('saved'));
      rerender();
    } catch (e) {
      teacher().handleError(e);
    }
  });

  ACTIONS.fillEmpty = () => {
    const act = S.cur.activities.find((a) => a.id === S.activityId);
    openSheet({
      title: t('fillEmpty'),
      body: '<form data-form="fillEmpty" class="stack"><p class="muted">' + esc(t('fillEmptyHint')) + '</p>' +
        '<label class="field"><span>' + esc(act.name) + ' (' + esc(t('outOf', { n: fmt(act.marks) })) + ')</span>' +
        '<input name="value" type="text" inputmode="decimal" required dir="ltr" value="' + fmt(act.marks) + '"></label>' +
        '<button class="btn btn--primary">' + esc(t('apply')) + '</button></form>'
    });
  };

  FORMS.fillEmpty = (form) => {
    const cur = S.cur;
    const act = cur.activities.find((a) => a.id === S.activityId);
    const value = N.normDigits(form.value.value);
    if (!validScore(value, act.marks) || value === '') return formError(form, t('scoreTooHigh', { max: fmt(act.marks) }));
    cur.students.forEach((st) => {
      if (!cur.scores.has(act.id + '|' + st.id) && !(S.dirty.has(st.id) && S.dirty.get(st.id) !== '')) S.dirty.set(st.id, value);
    });
    closeSheetOf(form);
    rerender();
  };

  CHANGES.release = async (input) => {
    const cur = S.cur;
    const act = cur.activities.find((a) => a.id === input.dataset.id);
    if (!act) return;
    const want = input.checked;
    const label = input.parentElement.querySelector('.switch-label');
    if (label) label.textContent = want ? t('released') : t('notReleased');
    input.disabled = true;
    try {
      const res = await api('setRelease', { subjectId: cur.subject.id, activityId: act.id, released: want });
      Object.assign(act, res.activity);
      toast(want ? t('released') : t('notReleased'));
      if (!S.dirty.size) rerender();
    } catch (e) {
      input.checked = !want;
      if (label) label.textContent = !want ? t('released') : t('notReleased');
      teacher().handleError(e);
    } finally {
      input.disabled = false;
    }
  };

  // ═════════════ Distribution ═════════════
  T.activities = (cur) => {
    const total = used(cur);
    const remaining = r2(100 - total);
    const bar = '<div class="dist-bar" role="img" aria-label="' + esc(t('distributed') + ' ' + fmt(total) + '/100') + '">' +
      cur.activities.map((a) => '<i style="flex:' + a.marks + ';background:' + N.TYPE_COLORS[a.type] + '" title="' + esc(a.name + ': ' + fmt(a.marks)) + '"></i>').join('') +
      (remaining > 0 ? '<i class="dist-empty" style="flex:' + remaining + '"></i>' : '') + '</div>';

    const list = cur.activities.length
      ? '<ul class="rows act-list">' + cur.activities.map((a) =>
        '<li class="act-row">' +
        '<button type="button" class="act-open" data-act="editActivity" data-id="' + esc(a.id) + '">' +
        '<i class="swatch" style="background:' + N.TYPE_COLORS[a.type] + '"></i>' +
        '<span class="act-name"><strong>' + esc(a.name) + '</strong>' + (a.name.indexOf(typeLabel(a.type)) === 0 ? '' : '<small>' + esc(typeLabel(a.type)) + '</small>') + '</span>' +
        '<span class="act-marks">' + fmt(a.marks) + '</span></button>' +
        releaseSwitch(a) + '</li>').join('') + '</ul>'
      : '<div class="empty empty--inline"><p>' + esc(t('emptyActivities')) + '</p></div>';

    return '<section class="dist">' +
      '<div class="dist-head"><h2 class="h-sec">' + esc(t('distribution')) + '</h2>' +
      '<p class="dist-num"><b>' + fmt(total) + '</b><span>/100</span></p></div>' + bar +
      '<p class="dist-note' + (remaining <= 0 ? ' is-full' : '') + '">' +
      (remaining > 0 ? esc(t('remaining')) + ': <b>' + fmt(remaining) + '</b>' : ICON.check + esc(t('fullyDistributed'))) + '</p></section>' +
      list +
      '<p class="muted small">' + esc(t('releaseHint')) + '</p>' +
      '<div class="btn-row">' +
      (remaining > 0 ? '<button type="button" class="btn btn--primary" data-act="addActivity">' + ICON.plus + esc(t('addActivity')) + '</button>' : '') +
      (remaining > 0 ? '<button type="button" class="btn btn--ghost" data-act="copyPlan">' + ICON.copy + esc(t('copyPlan')) + '</button>' : '') +
      '</div>';
  };

  function autoName(cur, type, exceptId) {
    const base = typeLabel(type);
    if (type === 'final' || type === 'midterm') return base;
    const same = cur.activities.filter((a) => a.type === type && a.id !== exceptId).length;
    return same ? base + ' ' + (same + 1) : base;
  }

  function activityForm(act) {
    const cur = S.cur;
    const remaining = r2(100 - used(cur, act && act.id));
    const type = act ? act.type : (cur.activities.some((a) => a.type === 'final') ? 'midterm' : 'final');
    const marks = act ? fmt(act.marks) : type === 'final' ? fmt(Math.min(50, remaining)) : '';
    const quick = [5, 10, 15, 20, 25, 50].filter((n) => n <= remaining);
    openSheet({
      title: act ? t('editActivity') : t('addActivity'),
      body: '<form data-form="activity" class="stack">' +
        '<input type="hidden" name="id" value="' + esc(act ? act.id : '') + '">' +
        '<fieldset class="field"><legend>' + esc(t('activityType')) + '</legend><div class="type-grid">' +
        N.TYPES.map((k) => '<label class="type-pick"><input type="radio" name="type" value="' + k + '"' + (k === type ? ' checked' : '') + ' data-change="activityType">' +
          '<span><i style="background:' + N.TYPE_COLORS[k] + '"></i>' + esc(typeLabel(k)) + '</span></label>').join('') +
        '</div></fieldset>' +
        '<label class="field"><span>' + esc(t('activityName')) + '</span><input name="name" required maxlength="80" value="' + esc(act ? act.name : autoName(cur, type)) + '" data-auto="' + (act ? '0' : '1') + '" data-input="markManual"></label>' +
        '<label class="field"><span>' + esc(t('marks')) + '</span><input name="marks" required type="text" inputmode="decimal" dir="ltr" value="' + marks + '" class="input-marks">' +
        '<small class="field-hint">' + esc(t('marksHint', { n: fmt(remaining) })) + '</small></label>' +
        '<div class="quick">' + quick.map((n) => '<button type="button" class="chip chip--sm" data-act="quickMarks" data-v="' + n + '">' + n + '</button>').join('') +
        (remaining > 0 && quick.indexOf(remaining) < 0 ? '<button type="button" class="chip chip--sm" data-act="quickMarks" data-v="' + remaining + '">' + esc(t('useRemaining', { n: fmt(remaining) })) + '</button>' : '') + '</div>' +
        '<label class="switch switch--row"><input type="checkbox" name="released"' + (act && act.released ? ' checked' : '') + '><span class="switch-track" aria-hidden="true"></span><span class="switch-label">' + esc(t('releaseToStudents')) + '</span></label>' +
        '<div class="sheet-actions"><button class="btn btn--primary">' + esc(t('save')) + '</button>' +
        (act ? '<button type="button" class="btn btn--danger-ghost" data-act="deleteActivity" data-id="' + esc(act.id) + '">' + ICON.trash + esc(t('deleteActivity')) + '</button>' : '') +
        '</div></form>'
    });
  }

  ACTIONS.addActivity = () => activityForm(null);
  ACTIONS.editActivity = (el) => activityForm(S.cur.activities.find((a) => a.id === el.dataset.id));
  ACTIONS.quickMarks = (el) => { const f = el.closest('form'); f.marks.value = el.dataset.v; };
  INPUTS.markManual = (el) => { el.dataset.auto = '0'; };

  CHANGES.activityType = (radio) => {
    const form = radio.closest('form');
    if (form.name.dataset.auto === '1') form.name.value = autoName(S.cur, radio.value, form.id.value);
    if (radio.value === 'final' && !form.marks.value) {
      const remaining = r2(100 - used(S.cur, form.id.value));
      form.marks.value = fmt(Math.min(50, remaining));
    }
  };

  FORMS.activity = (form) => busy(form.querySelector('.btn--primary'), async () => {
    formError(form, '');
    const cur = S.cur;
    const id = form.id.value;
    const marks = Number(N.normDigits(form.marks.value));
    const remaining = r2(100 - used(cur, id));
    if (!(marks > 0) || marks > 100) return formError(form, t('err_INVALID_MARKS'));
    if (marks > remaining + 1e-9) return formError(form, t('err_OVER_BUDGET', { remaining: fmt(remaining) }));
    const activity = {
      id, name: form.name.value, marks, released: form.released.checked,
      type: (form.querySelector('input[name="type"]:checked') || {}).value || 'other'
    };
    try {
      const res = await api('saveActivity', { subjectId: cur.subject.id, activity });
      const i = cur.activities.findIndex((a) => a.id === res.activity.id);
      if (i >= 0) cur.activities[i] = res.activity; else cur.activities.push(res.activity);
      if (!id) S.activityId = res.activity.id;
      closeSheetOf(form);
      toast(t('saved'));
      rerender();
    } catch (e) {
      if (!teacher().handleError(e, { silent: true })) formError(form, errText(e));
    }
  });

  ACTIONS.deleteActivity = async (el) => {
    const cur = S.cur;
    const act = cur.activities.find((a) => a.id === el.dataset.id);
    if (!act || !(await confirmBox(t('confirmDeleteActivity', { name: act.name })))) return;
    try {
      await api('deleteActivity', { subjectId: cur.subject.id, activityId: act.id });
      cur.activities = cur.activities.filter((a) => a.id !== act.id);
      [...cur.scores.keys()].forEach((k) => { if (k.indexOf(act.id + '|') === 0) cur.scores.delete(k); });
      if (S.activityId === act.id) { S.activityId = null; S.dirty.clear(); }
      N.closeAllSheets();
      toast(t('saved'));
      rerender();
    } catch (e) {
      teacher().handleError(e);
    }
  };

  ACTIONS.copyPlan = async (btn) => {
    await busy(btn, async () => {
      try {
        if (!S.subjects) {
          const d = await api('bootstrap', {});
          S.subjects = d.subjects;
        }
      } catch (e) {
        return teacher().handleError(e);
      }
      const others = S.subjects.filter((s) => s.id !== S.cur.subject.id && s.activityCount > 0);
      openSheet({
        title: t('copyPlan'),
        body: others.length
          ? '<p class="muted">' + esc(t('copyPlanHint')) + '</p><ul class="rows pick-list">' + others.map((s) =>
            '<li><button type="button" class="pick-row" data-act="copyPlanFrom" data-id="' + esc(s.id) + '" style="--tab:' + esc(s.color) + '">' +
            '<span><strong>' + esc(s.name) + '</strong><small>' + esc([s.department, s.stage].filter(Boolean).join(S.lang === 'ku' ? '، ' : ', ')) + '</small></span>' +
            '<span class="pick-meta">' + esc(t('activitiesCount', { n: s.activityCount })) + ' <b>' + fmt(s.distributed) + '</b></span></button></li>').join('') + '</ul>'
          : '<p class="muted">' + esc(t('noOtherPlans')) + '</p>'
      });
    });
  };

  ACTIONS.copyPlanFrom = (el) => busy(el, async () => {
    try {
      const res = await api('copyActivities', { fromSubjectId: el.dataset.id, toSubjectId: S.cur.subject.id });
      S.cur.activities = res.activities;
      N.closeAllSheets();
      toast(t('saved'));
      rerender();
    } catch (e) {
      teacher().handleError(e);
    }
  });
})();
