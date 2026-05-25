'use client';

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart2, Clock, Database, Lock, Zap } from 'lucide-react';
import { BENCHMARK_TIERS as REAL_BENCHMARK_TIERS } from '@/lib/repo-data';
import { SOC_TOOLTIP_STYLE } from './soc-data';
import { SocCard, SocSectionHeader } from './primitives';

const BENCHMARK_TIERS = REAL_BENCHMARK_TIERS;

export function SocBenchmarksPanel() {
  return (
    <div>
      <div className="section-header mb-20">
        <BarChart2 size={20} color="var(--blue)"/>
        <div>
          <div className="section-title">Performance & Benchmarks</div>
          <div className="section-sub">SLO by concurrency tier · p50/p95/p99 latency · from proxy-slo-by-concurrency-latest.json</div>
        </div>
      </div>

      {/* SLO overview */}
      <div className="kpi-grid mb-16">
        {BENCHMARK_TIERS.map(t => (
          <div key={t.concurrency} className={`kpi-card ${t.sloPass?'kpi-green':'kpi-red'}`}>
            <div className="kpi-label">Concurrency {t.concurrency}</div>
            <div className={`kpi-value ${t.sloPass?'kpi-green':'kpi-red'}`}>{t.cps} req/s</div>
            <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:t.sloPass?'var(--green)':'var(--red)',marginTop:4}}>
              p95: {t.p95.toFixed(0)}ms / SLO: {t.sloMs}ms
            </div>
            <div style={{marginTop:6}}>
              {t.sloPass
                ? <span className="badge badge-allow">✓ SLO PASS</span>
                : <span className="badge badge-block">✗ SLO FAIL</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Latency comparison */}
        <SocCard title="p50 / p95 / p99 Latency by Concurrency" icon={<Clock size={14}/>} sub="All values in milliseconds">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={BENCHMARK_TIERS.map(t=>({name:`C=${t.concurrency}`,p50:t.p50,p95:t.p95,p99:t.p99,slo:t.sloMs}))} margin={{left:-10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:'#6B7FA0',fontSize:11}}/>
              <YAxis tick={{fill:'#6B7FA0',fontSize:10}} tickFormatter={v=>`${v}ms`}/>
              <Tooltip contentStyle={SOC_TOOLTIP_STYLE} formatter={(v:number)=>`${v.toFixed(0)}ms`}/>
              <Legend wrapperStyle={{fontSize:11,color:'var(--text-muted)'}}/>
              <Bar dataKey="p50" fill="var(--green)" name="p50" radius={[2,2,0,0]}/>
              <Bar dataKey="p95" fill="var(--cyan)" name="p95" radius={[2,2,0,0]}/>
              <Bar dataKey="p99" fill="var(--amber)" name="p99" radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </SocCard>

        {/* Throughput */}
        <SocCard title="Throughput (calls/sec) by Concurrency" icon={<Zap size={14}/>} sub="Machine: Apple M-series ARM · darwin arm64">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={BENCHMARK_TIERS.map(t=>({name:`C=${t.concurrency}`,cps:t.cps}))} margin={{left:-10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:'#6B7FA0',fontSize:11}}/>
              <YAxis tick={{fill:'#6B7FA0',fontSize:10}}/>
              <Tooltip contentStyle={SOC_TOOLTIP_STYLE} formatter={(v:number)=>`${v} req/s`}/>
              <Bar dataKey="cps" fill="var(--purple)" radius={[3,3,0,0]} name="Calls/sec">
                {BENCHMARK_TIERS.map((_,i)=>(<Cell key={i} fill={['#00D67C','#4B9EFF','#F5A623','#FF4D6A'][i]}/>))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SocCard>
      </div>

      {/* Detailed table */}
      <SocCard title="SLO Results — Full Detail" icon={<Database size={14}/>} sub="Timestamp: 2026-05-19T14:49:39.860Z · darwin arm64 · Node v23.11.0">
        <div className="table-wrap">
          <table className="soc-table">
            <thead>
              <tr>
                <th>Concurrency</th><th>SLO (ms)</th>
                <th>p50</th><th>p95</th><th>p99</th><th>Avg</th>
                <th>Calls/s</th><th>Correctness</th><th>P95 SLO</th><th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_TIERS.map(t => (
                <tr key={t.concurrency}>
                  <td className="font-mono font-semibold">{t.concurrency}</td>
                  <td className="font-mono text-muted">{t.sloMs}ms</td>
                  <td className="perf-value">{t.p50.toFixed(0)}ms</td>
                  <td className={`perf-value ${t.sloPass?'perf-pass':'perf-fail'}`}>{t.p95.toFixed(0)}ms</td>
                  <td className="perf-value">{t.p99.toFixed(0)}ms</td>
                  <td className="perf-value">{t.avg.toFixed(0)}ms</td>
                  <td className="perf-value">{t.cps}</td>
                  <td className="perf-pass">{t.correctness}%</td>
                  <td>{t.sloPass ? <span className="badge badge-allow">PASS</span> : <span className="badge badge-block">FAIL</span>}</td>
                  <td>{t.sloPass ? <span className="badge badge-allow">PASS</span> : <span className="badge badge-block">FAIL</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:12,padding:'10px 12px',background:'var(--amber-dim)',borderRadius:6,border:'1px solid rgba(245,166,35,0.2)',fontSize:12,color:'var(--amber)'}}>
          ⚠ Only concurrency=1 passes p95 SLO. C=10/25/50 exceed tiered SLO gates. Correctness: 100% across all tiers. HTTP SSE variant: BLOCKED (requires live upstream + SSE handshake).
        </div>
      </SocCard>

      {/* Policy-only gate */}
      <div className="grid-2" style={{marginTop:16}}>
        <SocCard title="Policy-Only Gates" icon={<Lock size={14}/>} sub="1000-call stress test · No proxy overhead">
          {[
            { label:'p95 Gate', value:'500ms', status:'–' },
            { label:'p99 Gate', value:'1000ms', status:'–' },
            { label:'Rate Limit Cache', value:'10,000 entries', status:'✓' },
            { label:'Throughput', value:'1,140 req/s', status:'✓' },
          ].map(r => (
            <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border-dim)'}}>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>{r.label}</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'var(--cyan)'}}>{r.value}</span>
                <span style={{color:'var(--green)',fontSize:13}}>{r.status}</span>
              </div>
            </div>
          ))}
        </SocCard>
        <SocCard title="Token Counting Accuracy" icon={<Database size={14}/>} sub="Provider token drift measurements">
          {[
            { prov:'OpenAI (gpt-4)', acc:'99.5%', drift:'±2-3%', pass:true },
            { prov:'Anthropic', acc:'99.9%', drift:'±0.1%', pass:true },
            { prov:'Google Gemini', acc:'97.5%', drift:'±5-7%', pass:true },
            { prov:'Groq', acc:'99.0%', drift:'±1-2%', pass:true },
          ].map(p => (
            <div key={p.prov} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border-dim)'}}>
              <span style={{fontSize:12,color:'var(--text)'}}>{p.prov}</span>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'var(--cyan)'}}>{p.acc}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'var(--text-muted)'}}>{p.drift}</span>
                <span className="badge badge-allow">✓</span>
              </div>
            </div>
          ))}
        </SocCard>
      </div>
    </div>
  );
}
