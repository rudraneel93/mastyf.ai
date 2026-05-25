'use client';

import { useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { ATTACKS } from '@/lib/repo-data';
import { THREAT_SIGNATURES } from './soc-data';
import { SocSectionHeader } from './primitives';

const ALL_ATTACKS = ATTACKS;

export function SocThreatIntelPanel() {
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 25;

  const filtered = ALL_ATTACKS.filter(a => {
    const matchCat = cat === 'all' || a.category === cat;
    const matchSearch = !search || a.id.toLowerCase().includes(search.toLowerCase())
      || a.category.toLowerCase().includes(search.toLowerCase())
      || a.tool.toLowerCase().includes(search.toLowerCase())
      || (a.hint || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const paged = filtered.slice(page * PER_PAGE, (page+1) * PER_PAGE);
  const total = filtered.length;
  const pages = Math.ceil(total / PER_PAGE);

  const catCounts: Record<string,number> = {};
  ALL_ATTACKS.forEach(a => { catCounts[a.category]=(catCounts[a.category]||0)+1; });

  return (
    <div>
      <div className="section-header mb-20">
        <AlertTriangle size={20} color="var(--red)"/>
        <div>
          <div className="section-title">Threat Intelligence</div>
          <div className="section-sub">{ALL_ATTACKS.length} adversarial evasion probes · 58 attack categories · CVE-mapped signatures</div>
        </div>
      </div>

      {/* Signatures */}
      <div className="mb-16">
        <div className="soc-card-title mb-8" style={{fontSize:13,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,color:'var(--text-bright)'}}>
          <ShieldAlert size={14} style={{marginRight:6}}/>Threat Intel Signatures (Active)
        </div>
        {THREAT_SIGNATURES.map(sig => (
          <div key={sig.id} className="sig-card">
            <div className="sig-card-id">{sig.id} · {sig.cve} · <span className={sig.severity==='CRITICAL'?'text-red':'text-amber'}>{sig.severity}</span></div>
            {sig.pattern}
          </div>
        ))}
      </div>

      {/* Category pills */}
      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="Search by ID, category, tool, hint..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        {['all',...Object.keys(catCounts).sort((a,b)=>catCounts[b]-catCounts[a]).slice(0,10)].map(c => (
          <button key={c} className={`filter-btn ${cat===c?'active':''}`}
            onClick={() => { setCat(c); setPage(0); }}>
            {c} {c!=='all' && <span style={{marginLeft:3,opacity:.7}}>({catCounts[c]||0})</span>}
          </button>
        ))}
      </div>

      <div className="table-wrap mb-8">
        <table className="soc-table">
          <thead>
            <tr>
              <th>ID</th><th>Tool</th><th>Category</th><th>Rule Hint</th><th>Source</th><th>Confidence</th><th>Expected</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(a => (
              <tr key={a.id}>
                <td className="font-mono text-cyan" style={{fontSize:11}}>{a.id}</td>
                <td className="font-mono" style={{fontSize:11,color:'var(--amber)'}}>{a.tool}</td>
                <td><span className="badge badge-block">{a.category}</span></td>
                <td className="font-mono text-sm" style={{color:'var(--text-muted)',fontSize:11}}>{a.hint||'—'}</td>
                <td className="text-sm" style={{color:'var(--text-muted)',fontSize:11}}>{a.source||'—'}</td>
                <td className="font-mono text-sm" style={{color: (a.confidence||0)>=0.9?'var(--green)':'var(--amber)'}}>
                  {((a.confidence||0)*100).toFixed(0)}%
                </td>
                <td><span className="badge badge-block">BLOCK</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:12,fontSize:12,color:'var(--text-muted)'}}>
        <span>Showing {page*PER_PAGE+1}–{Math.min((page+1)*PER_PAGE,total)} of {total}</span>
        <button className="filter-btn" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>← Prev</button>
        <button className="filter-btn" onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1}>Next →</button>
      </div>
    </div>
  );
}
