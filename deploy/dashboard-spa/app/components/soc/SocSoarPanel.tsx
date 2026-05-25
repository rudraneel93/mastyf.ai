'use client';

import { Activity, ChevronRight, GitBranch } from 'lucide-react';
import { SOAR_PLAYBOOKS } from './soc-data';
import { SocCard, SocSectionHeader } from './primitives';

export function SocSoarPanel() {
  return (
    <div>
      <div className="section-header mb-20">
        <GitBranch size={20} color="var(--purple)"/>
        <div>
          <div className="section-title">SOAR Playbooks</div>
          <div className="section-sub">Automated Security Orchestration · {SOAR_PLAYBOOKS.length} active playbooks · trigger → action pipelines</div>
        </div>
      </div>

      {SOAR_PLAYBOOKS.map(pb => (
        <div key={pb.name} className="playbook-card">
          <div className="playbook-name">
            <GitBranch size={14}/>
            {pb.name}
            <span className={`badge ${pb.severity==='CRITICAL'?'badge-block':'badge-warn'}`}>{pb.severity}</span>
          </div>

          <div className="playbook-section">Trigger Conditions</div>
          <div className="playbook-conditions mb-8">
            {pb.when.map((w, i) => (
              <div key={i} className="playbook-condition">
                <span style={{color:'var(--cyan)'}}>{w.field}</span>
                <span style={{color:'var(--text-faint)',margin:'0 6px'}}>{w.op}</span>
                <span style={{color:'var(--amber)'}}>"{String(w.value)}"</span>
              </div>
            ))}
          </div>

          <div className="playbook-section">Actions</div>
          <div className="playbook-actions">
            {pb.actions.map((a, i) => (
              <div key={i} className="playbook-action">
                <span className={`playbook-action-type ${a.type}`}>{a.type.toUpperCase()}</span>
                <span style={{color:'var(--text)',fontSize:12}}>
                  {a.type==='notify' ? `${(a as {message?:string}).message||''}` :
                   a.type==='pagerduty' ? 'PagerDuty alert → on-call SRE' :
                   a.type==='open' ? `Open threat lab for investigation` :
                   `Suggest automated rule change`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Playbook flow diagram */}
      <SocCard title="Playbook Execution Flow" icon={<Activity size={14}/>} sub="Event → Conditions → Actions pipeline">
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',padding:'12px 0'}}>
          {['Event Received','Condition Check','Confidence Threshold','Action Router','Notify / Block / Page'].map((step,i,arr) => (
            <div key={step} style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{
                padding:'8px 14px',
                borderRadius:6,
                border:`1px solid ${[
                  'var(--border)','var(--cyan-glow)','var(--amber)',
                  'var(--green)','var(--purple)'
                ][i]}`,
                background: `rgba(${['30,45,69','0,229,204','245,166,35','0,214,124','139,127,255'][i]}, 0.1)`,
                color: ['var(--text)','var(--cyan)','var(--amber)','var(--green)','var(--purple)'][i],
                fontSize:12,
                fontWeight:500,
                fontFamily:"'JetBrains Mono',monospace",
                whiteSpace:'nowrap' as const,
              }}>
                {step}
              </div>
              {i < arr.length-1 && <ChevronRight size={14} color="var(--text-faint)"/>}
            </div>
          ))}
        </div>
      </SocCard>
    </div>
  );
}
