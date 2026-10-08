// ============================================================
// STUDENT STAGE DISTRIBUTION CHARTS (RECHARTS)
// رسوم بيانية ديناميكية لتوزيع الطلاب حسب المراحل الدراسية
// ============================================================

window.currentChartMode = 'both';

function switchChartType(mode) {
  window.currentChartMode = mode;
  ['bar', 'pie', 'both'].forEach(m => {
    const btn = document.getElementById('chart-tab-' + m);
    if (btn) {
      if (m === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  renderStudentCharts();
}

function renderChartSummaryPills(stageData, totalStudents) {
  const pillsEl = document.getElementById('chart-summary-pills');
  if (!pillsEl) return;

  if (totalStudents === 0) {
    pillsEl.innerHTML = `<div class="alert a-info" style="width:100%;margin:0">لا توجد بيانات طلاب مطابقة للتصفية الحالية</div>`;
    return;
  }

  const maxStage = stageData.reduce((prev, current) => (prev.count > current.count) ? prev : current, { stage: '-', count: 0 });

  let html = `
    <div style="background:var(--pr-l);border:1px solid var(--pr-m);padding:8px 14px;border-radius:10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--pr-d);font-weight:bold">إجمالي الطلاب:</span>
      <span style="font-size:16px;font-weight:900;color:var(--pr-d);font-family:'Cairo Play',sans-serif">${totalStudents}</span>
    </div>
    <div style="background:var(--go-l);border:1px solid var(--go);padding:8px 14px;border-radius:10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--go);font-weight:bold">الأعلى كثافة:</span>
      <span style="font-size:13px;font-weight:bold;color:var(--tx)">${maxStage.stage} (${maxStage.count} طالب)</span>
    </div>
  `;

  stageData.forEach(st => {
    const pct = totalStudents > 0 ? Math.round((st.count / totalStudents) * 100) : 0;
    html += `
      <div style="background:var(--sf2);border:1px solid var(--bd);padding:6px 10px;border-radius:8px;font-size:11px;display:flex;align-items:center;gap:6px">
        <span style="font-weight:bold;color:var(--tx2)">${st.stage}:</span>
        <span style="font-weight:800;color:var(--tx)">${st.count}</span>
        <span class="badge b-teal" style="font-size:10px;padding:1px 5px">${pct}%</span>
      </div>
    `;
  });

  pillsEl.innerHTML = html;
}

function generateSVGBarChart(stageData, totalStudents) {
  if (totalStudents === 0) {
    return `<div class="te" style="padding:20px;text-align:center">لا توجد بيانات للعرض</div>`;
  }
  const maxVal = Math.max(...stageData.map(d => d.count), 1);
  const chartHeight = 200;

  const barsHtml = stageData.map((d) => {
    const maleHeight = (d.males / maxVal) * chartHeight;
    const femaleHeight = (d.females / maxVal) * chartHeight;
    const pct = totalStudents > 0 ? Math.round((d.count / totalStudents) * 100) : 0;

    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:55px">
        <span style="font-size:11px;font-weight:bold;color:var(--pr-d)">${d.count > 0 ? d.count : ''}</span>
        <div style="width:100%;max-width:32px;height:${chartHeight}px;background:var(--bd);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden;position:relative">
          <div style="width:50%;height:${maleHeight}px;background:var(--pr);transition:height .4s" title="ذكور: ${d.males}"></div>
          <div style="width:50%;height:${femaleHeight}px;background:var(--go);transition:height .4s" title="إناث: ${d.females}"></div>
        </div>
        <span style="font-size:10px;font-weight:700;color:var(--tx2);text-align:center;line-height:1.2;margin-top:4px">${d.stage}</span>
        <span class="badge b-gray" style="font-size:9px">${pct}%</span>
      </div>
    `;
  }).join('');

  return `
    <div>
      <div style="display:flex;align-items:flex-end;justify-content:space-around;gap:6px;padding-bottom:10px;border-bottom:1px solid var(--bd)">
        ${barsHtml}
      </div>
      <div style="display:flex;justify-content:center;gap:16px;margin-top:12px;font-size:12px">
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;background:var(--pr);border-radius:3px"></span> ذكور</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;background:var(--go);border-radius:3px"></span> إناث</span>
      </div>
    </div>
  `;
}

function generateSVGPieChart(stageData, totalStudents) {
  if (totalStudents === 0) {
    return `<div class="te" style="padding:20px;text-align:center">لا توجد بيانات للعرض</div>`;
  }
  const COLORS = ['#00897B', '#26A69A', '#1a3a5c', '#c8922a', '#15803d', '#7c3aed', '#db2777'];
  const activeData = stageData.filter(d => d.count > 0);
  if (activeData.length === 0) {
    return `<div class="te" style="padding:20px;text-align:center">لا توجد بيانات للعرض</div>`;
  }

  let cumulativeAngle = -Math.PI / 2;
  const cx = 100, cy = 100, outerR = 85, innerR = 40;
  let pathsHtml = '';

  activeData.forEach((d, index) => {
    const fraction = d.count / totalStudents;
    const angle = fraction * 2 * Math.PI;
    const color = COLORS[index % COLORS.length];
    const pct = Math.round(fraction * 100);

    if (fraction >= 0.9999) {
      pathsHtml += `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" stroke="${color}" stroke-width="${outerR - innerR}" fill="none"><title>${d.stage}: ${d.count} طالب (${pct}%)</title></circle>`;
    } else {
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);

      const ix1 = cx + innerR * Math.cos(startAngle);
      const iy1 = cy + innerR * Math.sin(startAngle);
      const ix2 = cx + innerR * Math.cos(endAngle);
      const iy2 = cy + innerR * Math.sin(endAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      const dPath = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;

      pathsHtml += `<path d="${dPath}" fill="${color}" stroke="#ffffff" stroke-width="2"><title>${d.stage}: ${d.count} طالب (${pct}%)</title></path>`;
    }
  });

  const legendHtml = activeData.map((d, index) => {
    const color = COLORS[index % COLORS.length];
    const pct = Math.round((d.count / totalStudents) * 100);
    return `
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px">
        <span style="width:12px;height:12px;border-radius:3px;background:${color};flex-shrink:0"></span>
        <span style="font-weight:bold;color:var(--tx)">${d.stage}:</span>
        <span style="color:var(--tx2)">${d.count} طالب (${pct}%)</span>
      </div>
    `;
  }).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;padding:8px">
      <svg width="200" height="200" viewBox="0 0 200 200" style="overflow:visible">
        ${pathsHtml}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="10" font-family="Cairo" font-weight="bold" fill="var(--tx2)">إجمالي الطلاب</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="15" font-family="Cairo" font-weight="900" fill="var(--pr-d)">${totalStudents}</text>
      </svg>
      <div style="max-width:220px">${legendHtml}</div>
    </div>
  `;
}

function renderFallbackSVGChart(container, stageData, totalStudents) {
  const mode = window.currentChartMode || 'both';
  if (totalStudents === 0) {
    container.innerHTML = `<div class="te" style="padding:24px;text-align:center">لا توجد بيانات للعرض</div>`;
    return;
  }

  const barHtml = generateSVGBarChart(stageData, totalStudents);
  const pieHtml = generateSVGPieChart(stageData, totalStudents);

  if (mode === 'both') {
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(310px, 1fr));gap:16px">
        <div style="background:var(--sf2);padding:14px;border-radius:12px;border:1px solid var(--bd)">
          <h4 style="font-size:13px;font-weight:bold;color:var(--tx);margin-bottom:12px;text-align:center">توزيع الطلاب حسب المراحل (رسم شريطي)</h4>
          ${barHtml}
        </div>
        <div style="background:var(--sf2);padding:14px;border-radius:12px;border:1px solid var(--bd)">
          <h4 style="font-size:13px;font-weight:bold;color:var(--tx);margin-bottom:12px;text-align:center">توزيع النسب المئوية للمراحل (رسم دائرى)</h4>
          ${pieHtml}
        </div>
      </div>
    `;
  } else if (mode === 'pie') {
    container.innerHTML = `
      <div style="background:var(--sf2);padding:14px;border-radius:12px;border:1px solid var(--bd)">
        <h4 style="font-size:13px;font-weight:bold;color:var(--tx);margin-bottom:12px;text-align:center">توزيع النسب المئوية للمراحل (رسم دائرى)</h4>
        ${pieHtml}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="background:var(--sf2);padding:14px;border-radius:12px;border:1px solid var(--bd)">
        <h4 style="font-size:13px;font-weight:bold;color:var(--tx);margin-bottom:12px;text-align:center">توزيع الطلاب حسب المراحل (رسم شريطي)</h4>
        ${barHtml}
      </div>
    `;
  }
}

function renderStudentCharts() {
  const container = document.getElementById('recharts-root-container');
  if (!container) return;

  let students = typeof gdata === 'function' ? gdata('stud') : [];

  const activeYr = window.ACTIVE_YEAR || document.getElementById('dash-year-filter')?.value || '';
  if (activeYr) {
    students = students.filter(s => s.academicYear === activeYr);
  }

  const schoolFilter = document.getElementById('chart-school-filter')?.value || '';
  if (schoolFilter) {
    students = students.filter(s => s.school === schoolFilter);
  }

  const genderFilter = document.getElementById('chart-gender-filter')?.value || '';
  if (genderFilter) {
    students = students.filter(s => s.gender === genderFilter);
  }

  const STAGES_ORDER = [
    "الأول المتوسط",
    "الثاني المتوسط",
    "الثالث المتوسط",
    "الرابع الإعدادي",
    "الخامس الإعدادي",
    "السادس الإعدادي"
  ];

  const stageCounts = {};
  STAGES_ORDER.forEach(st => {
    stageCounts[st] = { stage: st, count: 0, males: 0, females: 0 };
  });

  students.forEach(s => {
    const st = s.stage || 'غير محدد';
    if (!stageCounts[st]) {
      stageCounts[st] = { stage: st, count: 0, males: 0, females: 0 };
    }
    stageCounts[st].count += 1;
    if (s.gender === 'أنثى') {
      stageCounts[st].females += 1;
    } else {
      stageCounts[st].males += 1;
    }
  });

  const chartData = Object.values(stageCounts);
  const totalStudents = students.length;

  renderChartSummaryPills(chartData, totalStudents);

  if (!window.Recharts || !window.React || !window.ReactDOM) {
    renderFallbackSVGChart(container, chartData, totalStudents);
    return;
  }

  const {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
    CartesianGrid
  } = window.Recharts;

  const h = window.React.createElement;
  const COLORS = ['#00897B', '#26A69A', '#1a3a5c', '#c8922a', '#15803d', '#7c3aed', '#db2777'];
  const mode = window.currentChartMode || 'both';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = totalStudents > 0 ? ((data.count / totalStudents) * 100).toFixed(1) : 0;
      return h('div', {
        style: {
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          padding: '10px 14px',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          direction: 'rtl',
          fontFamily: 'Cairo, sans-serif'
        }
      },
        h('div', { style: { fontWeight: 'bold', color: '#00695C', marginBottom: '4px' } }, label || data.stage),
        h('div', { style: { fontSize: '13px', color: '#0f172a' } }, `إجمالي الطلاب: `, h('strong', null, `${data.count} طالب`)),
        h('div', { style: { fontSize: '12px', color: '#1a3a5c', marginTop: '2px' } }, `ذكور: ${data.males} · إناث: ${data.females}`),
        h('div', { style: { fontSize: '12px', color: '#00897B', marginTop: '2px', fontWeight: 'bold' } }, `النسبة من المجموع: ${pct}%`)
      );
    }
    return null;
  };

  const barChartElement = h(ResponsiveContainer, { width: '100%', height: 320 },
    h(BarChart, { data: chartData, margin: { top: 20, right: 10, left: 10, bottom: 40 } },
      h(CartesianGrid, { strokeDasharray: '3 3', stroke: '#e2e8f0' }),
      h(XAxis, { dataKey: 'stage', tick: { fill: '#475569', fontSize: 11, fontFamily: 'Cairo' }, interval: 0, angle: -10, textAnchor: 'end' }),
      h(YAxis, { allowDecimals: false, tick: { fill: '#475569', fontSize: 12 } }),
      h(Tooltip, { content: h(CustomTooltip) }),
      h(Legend, { wrapperStyle: { fontFamily: 'Cairo', fontSize: '12px', paddingTop: '10px' } }),
      h(Bar, { dataKey: 'males', name: 'الطلاب الذكور', fill: '#00897B', radius: [6, 6, 0, 0] }),
      h(Bar, { dataKey: 'females', name: 'الطالبات الإناث', fill: '#c8922a', radius: [6, 6, 0, 0] })
    )
  );

  const activePieData = chartData.filter(d => d.count > 0);
  const pieCells = (activePieData.length ? activePieData : [{ stage: 'لا توجد بيانات', count: 1 }]).map((entry, index) =>
    h(Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })
  );

  const pieChartElement = h(ResponsiveContainer, { width: '100%', height: 320 },
    h(PieChart, null,
      h(Pie, {
        data: activePieData.length ? activePieData : [{ stage: 'لا توجد بيانات', count: 1 }],
        cx: '50%',
        cy: '50%',
        outerRadius: 100,
        innerRadius: 45,
        dataKey: 'count',
        nameKey: 'stage',
        label: ({ stage, percent }) => activePieData.length ? `${stage}: ${(percent * 100).toFixed(0)}%` : 'لا توجد بيانات',
        labelLine: true
      }, ...pieCells),
      h(Tooltip, { content: h(CustomTooltip) }),
      h(Legend, { wrapperStyle: { fontFamily: 'Cairo', fontSize: '12px' } })
    )
  );

  let contentElement;
  if (mode === 'both') {
    contentElement = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' } },
      h('div', { style: { background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' } },
        h('h4', { style: { fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', textAlign: 'center' } }, 'توزيع الطلاب حسب المراحل (رسم بياني شريطي)'),
        barChartElement
      ),
      h('div', { style: { background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' } },
        h('h4', { style: { fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', textAlign: 'center' } }, 'توزيع النسب المئوية للمراحل (رسم بياني دائرى)'),
        pieChartElement
      )
    );
  } else if (mode === 'pie') {
    contentElement = h('div', { style: { background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' } }, pieChartElement);
  } else {
    contentElement = h('div', { style: { background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' } }, barChartElement);
  }

  if (window.reactRootInstance) {
    window.reactRootInstance.render(contentElement);
  } else if (window.ReactDOM && window.ReactDOM.createRoot) {
    window.reactRootInstance = window.ReactDOM.createRoot(container);
    window.reactRootInstance.render(contentElement);
  } else if (window.ReactDOM) {
    window.ReactDOM.render(contentElement, container);
  }
}

// Auto re-render charts when Recharts script loads
window.addEventListener('load', () => {
  setTimeout(() => {
    if (document.getElementById('recharts-root-container')) {
      renderStudentCharts();
    }
  }, 300);
});
