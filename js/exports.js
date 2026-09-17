/* Nimre — file exports (Excel, Word, print) and QR codes. Libraries load only when needed. */
(() => {
  'use strict';

  const LIBS = {
    qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
    excel: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
    docx: 'https://cdn.jsdelivr.net/npm/docx@9.6.1/dist/index.iife.js'
  };
  const loaded = {};

  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => { delete loaded[src]; s.remove(); reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (n === '' || n === null || n === undefined ? '' : String(Math.round(Number(n) * 100) / 100));

  function fileName(meta, ext) {
    const base = [meta.subject.name, meta.subject.department].filter(Boolean).join(' - ');
    return (base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'grades') + '.' + ext;
  }

  async function saveBlob(blob, filename) {
    let file = null;
    try { file = new File([blob], filename, { type: blob.type }); } catch (e) { /* old browsers */ }
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (file && touch && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // the person closed the share sheet
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /** Columns shared by Excel, Word and print. */
  function columns(rep, meta) {
    const { t, opts } = meta;
    const cols = [
      { header: '#', kind: 'index', value: (r) => r.n },
      { header: t('name'), kind: 'name', value: (r) => r.st.name }
    ];
    if (opts.includeActivities) {
      rep.acts.forEach((a, i) => cols.push({
        header: a.name, sub: fmt(a.marks), kind: 'score', len: a.name.length,
        value: (r) => (r.cells[i] === '' ? '' : r.cells[i])
      }));
      if (rep.showCoursework) {
        cols.push({ header: t('coursework'), sub: fmt(rep.courseworkMax), kind: 'coursework', value: (r) => r.coursework });
      }
    }
    cols.push({ header: t('total'), sub: fmt(rep.max), kind: 'total', value: (r) => r.total });
    cols.push({ header: t('level'), kind: 'level', value: (r) => t('level_' + r.level) });
    return cols;
  }

  function metaLine(meta) {
    const { t, subject } = meta;
    const sep = meta.lang === 'ku' ? '، ' : ', ';
    return [subject.department, subject.stage, subject.semester ? t('semester') + ' ' + subject.semester : '', subject.year ? '\u200E' + subject.year + '\u200E' : '']
      .filter(Boolean).join(sep);
  }

  function summaryItems(rep, meta) {
    const { t } = meta;
    const s = rep.stats;
    return [
      [t('statStudents'), String(s.count)],
      [t('statAverage'), fmt(s.average) + ' / ' + fmt(rep.max)],
      [t('statHighest'), fmt(s.highest)],
      [t('statLowest'), fmt(s.lowest)],
      [t('statPassed'), String(s.passed)],
      [t('statFailed'), String(s.count - s.passed)]
    ];
  }

  // ───────────── Excel ─────────────
  async function excel(rep, meta) {
    await loadScript(LIBS.excel);
    const { t } = meta;
    const rtl = meta.lang === 'ku';
    const cols = columns(rep, meta);
    const N = cols.length;
    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'Nimre';
    wb.created = new Date();

    const sheetName = (meta.subject.name || 'Grades').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    const ws = wb.addWorksheet(sheetName, {
      views: [{ rightToLeft: rtl, showGridLines: false }],
      pageSetup: {
        paperSize: 9, orientation: N > 6 ? 'landscape' : 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
      },
      headerFooter: { oddFooter: '&C&P / &N' }
    });

    ws.columns = cols.map((c) => ({
      width: c.kind === 'index' ? 5 : c.kind === 'name' ? 32 : c.kind === 'level' ? 14 : Math.max(11, Math.min(20, (c.len || 6) + 4))
    }));

    const ink = 'FF1B2A41';
    const readingOrder = rtl ? 'rtl' : 'ltr';
    const thin = (argb) => ({ style: 'thin', color: { argb } });
    const box = (argb) => ({ top: thin(argb), bottom: thin(argb), left: thin(argb), right: thin(argb) });

    const title = (text, size, bold, color) => {
      const r = ws.addRow([text]);
      ws.mergeCells(r.number, 1, r.number, N);
      const c = r.getCell(1);
      c.font = { name: 'Calibri', size, bold, color: { argb: color } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder };
      r.height = Math.round(size * 1.9);
    };
    if (meta.university) title(meta.university, 12, false, 'FF4A5A70');
    title(meta.subject.name, 18, true, ink);
    const line = metaLine(meta);
    if (line) title(line, 12, false, 'FF4A5A70');
    title([meta.teacherName ? t('teacher') + ': ' + meta.teacherName : '', t('date') + ': ' + meta.dateText].filter(Boolean).join('     '), 11, false, 'FF6B7785');
    ws.addRow([]);

    const header = ws.addRow(cols.map((c) => (c.sub ? c.header + '\n(' + c.sub + ')' : c.header)));
    header.height = 40;
    header.eachCell((cell) => {
      cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ink } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder };
      cell.border = box(ink);
    });

    rep.rows.forEach((r, i) => {
      const row = ws.addRow(cols.map((c) => c.value(r)));
      row.height = 22;
      cols.forEach((c, ci) => {
        const cell = row.getCell(ci + 1);
        const strong = c.kind === 'total' || c.kind === 'coursework';
        cell.font = { name: 'Calibri', size: 11, bold: strong, color: { argb: c.kind === 'level' && r.level === 'fail' ? 'FFB3261E' : ink } };
        cell.alignment = { horizontal: c.kind === 'name' ? (rtl ? 'right' : 'left') : 'center', vertical: 'middle', readingOrder, indent: c.kind === 'name' ? 1 : 0 };
        cell.border = box('FFDCE2E0');
        const fill = c.kind === 'total' ? (i % 2 ? 'FFD6EBE1' : 'FFE3F1EA') : (i % 2 ? 'FFF5F7F4' : null);
        if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      });
    });
    ws.views = [{ rightToLeft: rtl, showGridLines: false, state: 'frozen', ySplit: header.number }];

    ws.addRow([]);
    summaryItems(rep, meta).forEach(([label, value]) => {
      const r = ws.addRow(['', label, value]);
      r.getCell(2).font = { name: 'Calibri', size: 11, color: { argb: 'FF4A5A70' } };
      r.getCell(2).alignment = { horizontal: rtl ? 'right' : 'left', readingOrder, indent: 1 };
      r.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: ink } };
      r.getCell(3).alignment = { horizontal: 'center', readingOrder };
    });

    const buf = await wb.xlsx.writeBuffer();
    await saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName(meta, 'xlsx'));
  }

  // ───────────── Word ─────────────
  async function word(rep, meta) {
    await loadScript(LIBS.docx);
    const D = window.docx;
    const { t } = meta;
    const rtl = meta.lang === 'ku';
    const cols = columns(rep, meta);
    const landscape = cols.length > 6;
    const margin = 850;
    const tableW = (landscape ? 16838 : 11906) - margin * 2;

    // Column widths (DXA): fixed for small columns, the name column takes the rest.
    const fixed = cols.map((c) => (c.kind === 'index' ? 520 : c.kind === 'name' ? 0 : c.kind === 'level' ? 1250 : 1050));
    let nameW = Math.max(2400, tableW - fixed.reduce((a, b) => a + b, 0));
    const scoreCols = cols.filter((c) => c.kind === 'score' || c.kind === 'coursework').length;
    if (scoreCols && nameW > 4200) {
      const extra = Math.min(450, Math.floor((nameW - 4200) / scoreCols));
      cols.forEach((c, i) => { if (c.kind === 'score' || c.kind === 'coursework') fixed[i] += extra; });
      nameW -= extra * scoreCols;
    }
    let widths = fixed.map((w) => w || nameW);
    const sum = widths.reduce((a, b) => a + b, 0);
    if (sum !== tableW) widths = widths.map((w) => Math.floor((w * tableW) / sum));
    widths[1] += tableW - widths.reduce((a, b) => a + b, 0);

    const FONT = { ascii: 'Calibri', hAnsi: 'Calibri', cs: 'Arial', eastAsia: 'Calibri' };
    const run = (text, o = {}) => new D.TextRun({
      text: String(text), bold: !!o.bold, size: o.size || 20, color: o.color || '1B2A41', font: FONT, rightToLeft: rtl
    });
    const para = (text, o = {}) => new D.Paragraph({
      bidirectional: rtl,
      alignment: o.align,
      spacing: { before: o.before || 0, after: o.after ?? 60 },
      children: [run(text, o)]
    });
    const border = (color) => ({ style: D.BorderStyle.SINGLE, size: 4, color });
    const cell = (lines, w, o = {}) => new D.TableCell({
      width: { size: w, type: D.WidthType.DXA },
      verticalAlign: D.VerticalAlign.CENTER,
      shading: o.fill ? { type: D.ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      borders: o.borders,
      children: [].concat(lines).map((txt, li) => para(txt, {
        bold: o.bold && li === 0, color: li ? (o.subColor || o.color) : o.color, size: li ? 16 : o.size, align: o.align, after: 0
      }))
    });

    const headerRow = new D.TableRow({
      tableHeader: true,
      cantSplit: true,
      children: cols.map((c, i) => cell(c.sub ? [c.header, '(' + c.sub + ')'] : [c.header], widths[i], {
        bold: true, color: 'FFFFFF', subColor: 'D6DEE8', fill: '1B2A41', align: D.AlignmentType.CENTER, size: 19
      }))
    });

    const bodyRows = rep.rows.map((r, ri) => new D.TableRow({
      cantSplit: true,
      children: cols.map((c, i) => {
        const v = c.value(r);
        const isTotal = c.kind === 'total';
        return cell([v === '' ? '' : String(v)], widths[i], {
          bold: isTotal || c.kind === 'coursework',
          color: c.kind === 'level' && r.level === 'fail' ? 'B3261E' : '1B2A41',
          fill: isTotal ? 'E3F1EA' : ri % 2 ? 'F5F7F4' : undefined,
          align: c.kind === 'name' ? undefined : D.AlignmentType.CENTER,
          size: 20
        });
      })
    }));

    const grid = border('C5CFCC');
    const table = new D.Table({
      width: { size: tableW, type: D.WidthType.DXA },
      columnWidths: widths,
      layout: D.TableLayoutType.FIXED,
      visuallyRightToLeft: rtl,
      borders: { top: grid, bottom: grid, left: grid, right: grid, insideHorizontal: grid, insideVertical: grid },
      rows: [headerRow, ...bodyRows]
    });

    const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: none, bottom: none, left: none, right: none };
    const half = Math.floor(tableW / 2);
    const summary = summaryItems(rep, meta).map(([k, v]) => k + ': ' + v).join('     ');
    const signatures = new D.Table({
      width: { size: tableW, type: D.WidthType.DXA },
      columnWidths: [half, tableW - half],
      layout: D.TableLayoutType.FIXED,
      visuallyRightToLeft: rtl,
      borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows: [new D.TableRow({
        children: [t('signatureTeacher'), t('signatureHead')].map((label, i) => cell(
          [label, '', '..................................'], i ? tableW - half : half,
          { align: D.AlignmentType.CENTER, color: '4A5A70', size: 20, borders: noBorders }
        ))
      })]
    });

    const head = [];
    if (meta.university) head.push(para(meta.university, { align: D.AlignmentType.CENTER, size: 22, color: '4A5A70' }));
    head.push(para(meta.subject.name, { align: D.AlignmentType.CENTER, size: 34, bold: true, after: 40 }));
    const line = metaLine(meta);
    if (line) head.push(para(line, { align: D.AlignmentType.CENTER, size: 22, color: '4A5A70' }));
    head.push(para([meta.teacherName ? t('teacher') + ': ' + meta.teacherName : '', t('date') + ': ' + meta.dateText].filter(Boolean).join('     '),
      { align: D.AlignmentType.CENTER, size: 20, color: '6B7785', after: 240 }));

    const doc = new D.Document({
      creator: 'Nimre',
      title: meta.subject.name,
      styles: { default: { document: { run: { font: FONT, size: 20 } } } },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: landscape ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT },
            margin: { top: 800, bottom: 800, left: margin, right: margin }
          }
        },
        footers: {
          default: new D.Footer({
            children: [new D.Paragraph({
              alignment: D.AlignmentType.CENTER,
              children: [new D.TextRun({ children: [t('page') + ' ', D.PageNumber.CURRENT, ' / ', D.PageNumber.TOTAL_PAGES], size: 16, color: '6B7785', font: FONT })]
            })]
          })
        },
        children: [
          ...head,
          table,
          para(summary, { size: 19, color: '4A5A70', before: 200, after: 360 }),
          signatures
        ]
      }]
    });

    const blob = await D.Packer.toBlob(doc);
    await saveBlob(blob, fileName(meta, 'docx'));
  }

  // ───────────── Print / PDF ─────────────
  function print(rep, meta) {
    const { t } = meta;
    const rtl = meta.lang === 'ku';
    const cols = columns(rep, meta);
    const area = document.getElementById('print-area');
    area.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    area.innerHTML =
      '<header class="pr-head">' +
      (meta.university ? '<p>' + esc(meta.university) + '</p>' : '') +
      '<h1>' + esc(meta.subject.name) + '</h1>' +
      '<p>' + esc(metaLine(meta)) + '</p>' +
      '<p class="pr-small">' + esc([meta.teacherName ? t('teacher') + ': ' + meta.teacherName : '', t('date') + ': ' + meta.dateText].filter(Boolean).join('   ')) + '</p>' +
      '</header>' +
      '<table class="pr-table"><thead><tr>' +
      cols.map((c) => '<th class="k-' + c.kind + '">' + esc(c.header) + (c.sub ? '<small>(' + esc(c.sub) + ')</small>' : '') + '</th>').join('') +
      '</tr></thead><tbody>' +
      rep.rows.map((r) => '<tr>' + cols.map((c) => '<td class="k-' + c.kind + (c.kind === 'level' && r.level === 'fail' ? ' is-fail' : '') + '">' + esc(c.value(r)) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table>' +
      '<p class="pr-summary">' + summaryItems(rep, meta).map(([k, v]) => esc(k) + ': <b>' + esc(v) + '</b>').join(' &nbsp; ') + '</p>' +
      '<div class="pr-sign"><div>' + esc(t('signatureTeacher')) + '</div><div>' + esc(t('signatureHead')) + '</div></div>';
    document.getElementById('print-page-style').textContent =
      '@page { size: A4 ' + (cols.length > 6 ? 'landscape' : 'portrait') + '; margin: 12mm; }';
    setTimeout(() => window.print(), 60);
  }

  // ───────────── QR ─────────────
  async function qrMatrix(text) {
    await loadScript(LIBS.qr);
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr;
  }

  function paintQr(ctx, qr, x, y, size, color) {
    const n = qr.getModuleCount();
    const cell = size / n;
    ctx.fillStyle = color;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  async function drawQr(canvas, text, cssSize) {
    const qr = await qrMatrix(text);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const quiet = 4;
    const n = qr.getModuleCount() + quiet * 2;
    const px = Math.floor((cssSize * dpr) / n) * n;
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, px, px);
    const cell = px / n;
    paintQr(ctx, qr, cell * quiet, cell * quiet, px - cell * quiet * 2, '#1B2A41');
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else { line = test; }
    });
    if (line) lines.push(line);
    return lines;
  }

  async function qrPoster(meta) {
    const { t, subject } = meta;
    const rtl = meta.lang === 'ku';
    const family = '"Instrument Sans", "Noto Kufi Arabic", sans-serif';
    try {
      await Promise.all([
        document.fonts.load('700 60px "Noto Kufi Arabic"'), document.fonts.load('400 36px "Noto Kufi Arabic"'),
        document.fonts.load('700 60px "Instrument Sans"')
      ]);
    } catch (e) { /* fall back to system fonts */ }
    const qr = await qrMatrix(meta.link);
    const W = 1080, H = 1500;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#F5F7F4';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = subject.color || '#1E7A5A';
    ctx.fillRect(0, 0, W, 420);

    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.font = '400 34px ' + family;
    if (meta.university) ctx.fillText(meta.university, W / 2, 96);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 64px ' + family;
    const nameLines = wrapLines(ctx, subject.name, W - 140).slice(0, 2);
    nameLines.forEach((l, i) => ctx.fillText(l, W / 2, 196 + i * 86));
    ctx.font = '400 38px ' + family;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText(metaLine(meta), W / 2, 196 + nameLines.length * 86 + 20);

    const qrSize = 660, qx = (W - qrSize) / 2, qy = 500;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(qx - 44, qy - 44, qrSize + 88, qrSize + 88, 40); else ctx.rect(qx - 44, qy - 44, qrSize + 88, qrSize + 88);
    ctx.fill();
    paintQr(ctx, qr, qx, qy, qrSize, '#1B2A41');

    ctx.fillStyle = '#1B2A41';
    ctx.font = '700 44px ' + family;
    ctx.fillText(t('scanForGrades'), W / 2, qy + qrSize + 140);

    ctx.direction = 'ltr';
    ctx.font = '700 68px ' + family;
    ctx.fillStyle = subject.color || '#1E7A5A';
    ctx.fillText(subject.id.split('').join(' '), W / 2, qy + qrSize + 240);
    ctx.font = '400 28px ' + family;
    ctx.fillStyle = '#6B7785';
    ctx.fillText(meta.link.replace(/^https?:\/\//, ''), W / 2, qy + qrSize + 300);

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    await saveBlob(blob, 'QR - ' + fileName(meta, 'png'));
  }

  window.NimreExport = { LIBS, loadScript, saveBlob, excel, word, print, drawQr, qrPoster };
})();
