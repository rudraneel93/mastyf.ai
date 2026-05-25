'use client';

import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ShieldAlert, TrendingUp } from 'lucide-react';
import { ATTACK_SCENARIOS, SOC_TOOLTIP_STYLE } from './soc-data';
import { SocCard, SocSectionHeader } from './primitives';

export function SocAttackSimulationsPanel() {
  const [selected, setSelected] = useState(ATTACK_SCENARIOS[0]);

  const summaryData = ATTACK_SCENARIOS.map(s => ({
    name: s.id, stage1: s.stage1Acc, stage2: s.stage2Acc, blockRate: s.blockRate,
  }));

  return (
    <div>
      <div className="section-header mb-20">
        <ShieldAlert size={20} color="var(--red)"/>
        <div>
          <div className="section-title">Attack Simulations</div>
          <div className="section-sub">6 enterprise scenarios · 180-min continuous attack · Stage 1 → Stage 2 AI learning</div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="kpi-grid mb-16">
        {[
          { l:'Overall Block Rate', v:'95.4%', c:'kpi-green' },
          { l:'Stage 2 Avg Accuracy', v:'94.3%', c:'kpi-cyan' },
          { l:'Avg Latency Improvement', v:'-58%', c:'kpi-blue' },
          { l:'Total Requests', v:'144,400', c:'kpi-purple' },
          { l:'System Stability', v:'92%', c:'kpi-green' },
          { l:'False Positive Rate', v:'1.8%', c:'kpi-amber' },
        ].map(s => (
          <div key={s.l} className={`kpi-card ${s.c}`}>
            <div className="kpi-label">{s.l}</div>
            <div className={`kpi-value ${s.c}`} style={{fontSize:22}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Stage comparison bar */}
      <SocCard title="Stage 1 → Stage 2 Detection Improvement" icon={<TrendingUp size={14}/>} sub="All 6 attack scenarios" style={{marginBottom:16}}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={summaryData} margin={{left:-10}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false}/>
            <XAxis dataKey="name" tick={{fill:'#6B7FA0',fontSize:11}}/>
            <YAxis tick={{fill:'#6B7FA0',fontSize:10}} domain={[70,105]} tickFormatter={v=>`${v}%`}/>
            <Tooltip contentStyle={SOC_TOOLTIP_STYLE} formatter={(v:number)=>`${v}%`}/>
            <Legend wrapperStyle={{fontSize:11,color:'var(--text-muted)'}}/>
            <Bar dataKey="stage1" fill="var(--amber)" name="Stage 1" radius={[2,2,0,0]}/>
            <Bar dataKey="stage2" fill="var(--cyan)" name="Stage 2" radius={[2,2,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </SocCard>

      <div className="grid-2">
        {/* Scenario list */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {ATTACK_SCENARIOS.map(s => (
            <div
              key={s.id}
              className="scenario-card"
              style={{cursor:'pointer', borderColor: selected.id===s.id?s.color:'var(--border)',
                background: selected.id===s.id?`${s.color}08`:'var(--navy-panel)'}}
              onClick={()=>setSelected(s)}
            >
              <div className="scenario-header">
                <div>
                  <div className="scenario-name">{s.name}</div>
                  <div className="scenario-id">{s.id}</div>
                </div>
                <span className="badge badge-block" style={{color:s.color,borderColor:`${s.color}40`,background:`${s.color}15`}}>
                  {s.blockRate}%
                </span>
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>
                {s.description}
              </div>
              <div style={{display:'flex',gap:12,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
                <span style={{color:'var(--amber)'}}>S1: {s.stage1Acc}%</span>
                <span style={{color:'var(--cyan)'}}>S2: {s.stage2Acc}%</span>
                <span style={{color:'var(--text-muted)'}}>lat: {s.latency2}ms</span>
              </div>
            </div>
          ))}
        </div>

        {/* Confidence timeline */}
        <SocCard title={`${selected.name} — Confidence Timeline`} icon={<TrendingUp size={14}/>} sub={`${selected.requests.toLocaleString()} requests · ${selected.blocked.toLocaleString()} blocked`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={selected.timeline} margin={{left:-10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
              <XAxis dataKey="t" tick={{fill:'#6B7FA0',fontSize:10}} tickFormatter={v=>`t+${v}m`}/>
              <YAxis tick={{fill:'#6B7FA0',fontSize:10}} domain={[70,105]} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={SOC_TOOLTIP_STYLE} formatter={(v:number,n:string)=>n==='acc'?`${v}%`:`${v.toFixed(2)}`}/>
              <Legend wrapperStyle={{fontSize:11,color:'var(--text-muted)'}}/>
              <Line type="monotone" dataKey="acc" stroke={selected.color} strokeWidth={2} dot name="Accuracy" isAnimationActive={false}/>
              <Line type="monotone" dataKey="conf" stroke="var(--cyan)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Confidence" yAxisId={0}/>
            </LineChart>
          </ResponsiveContainer>

          <div className="divider"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[
              { l:'Block Rate', v:`${selected.blockRate}%`, c:selected.color },
              { l:'Confidence', v:selected.confidence.toFixed(2), c:'var(--cyan)' },
              { l:'Latency S1', v:`${selected.latency1}ms`, c:'var(--amber)' },
              { l:'Latency S2', v:`${selected.latency2}ms`, c:'var(--green)' },
            ].map(m => (
              <div key={m.l} style={{background:'var(--navy-deep)',borderRadius:6,padding:'8px 12px'}}>
                <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:3}}>{m.l}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:m.c}}>{m.v}</div>
              </div>
            ))}
          </div>
        </SocCard>
      </div>
    </div>
  );
}
