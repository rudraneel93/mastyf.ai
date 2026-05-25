'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { COMPLIANCE_FRAMEWORKS } from './soc-data';
import { SocSectionHeader } from './primitives';

export function SocCompliancePanel() {
  const [fw, setFw] = useState('NIST-CSF');
  const controls = COMPLIANCE_FRAMEWORKS[fw] || {};

  const fwColors: Record<string,string> = { 'NIST-CSF':'var(--cyan)', 'SOC2':'var(--green)', 'CIS':'var(--amber)', 'HIPAA':'var(--red)', 'PCI-DSS':'var(--purple)' };

  return (
    <div>
      <div className="section-header mb-20">
        <CheckCircle size={20} color="var(--green)"/>
        <div>
          <div className="section-title">Compliance & Controls</div>
          <div className="section-sub">NIST-CSF · SOC2 · CIS · HIPAA · PCI-DSS · GxP framework explorer</div>
        </div>
      </div>

      {/* Status overview */}
      <div className="kpi-grid mb-16">
        {[
          { f:'NIST-CSF', controls:5, status:'PARTIAL', color:'kpi-amber' },
          { f:'SOC2', controls:4, status:'CONDITIONAL', color:'kpi-amber' },
          { f:'CIS', controls:3, status:'PARTIAL', color:'kpi-amber' },
          { f:'HIPAA', controls:2, status:'IN PROGRESS', color:'kpi-red' },
          { f:'PCI-DSS', controls:2, status:'IN PROGRESS', color:'kpi-red' },
          { f:'GxP', controls:2, status:'NOT STARTED', color:'kpi-red' },
        ].map(f => (
          <div key={f.f} className={`kpi-card ${f.color}`} style={{cursor:'pointer'}} onClick={()=>setFw(f.f)}>
            <div className="kpi-label">{f.f}</div>
            <div className={`kpi-value ${f.color}`} style={{fontSize:20}}>{f.controls}</div>
            <div style={{fontSize:10,color:fwColors[f.f]||'var(--text-muted)',marginTop:4}}>{f.status}</div>
          </div>
        ))}
      </div>

      <div className="framework-tabs mb-16">
        {Object.keys(COMPLIANCE_FRAMEWORKS).map(f => (
          <button key={f} className={`framework-tab ${fw===f?'active':''}`} onClick={()=>setFw(f)}>{f}</button>
        ))}
      </div>

      <div className="control-grid">
        {Object.entries(controls).map(([id, ctrl]) => (
          <div key={id} className="control-card">
            <div className="control-id">{id}</div>
            <div className="control-title">{ctrl.title}</div>
            <div className="control-keywords">
              {ctrl.keywords.map(kw => (
                <span key={kw} className="control-kw">{kw}</span>
              ))}
            </div>
            <div style={{marginTop:6}}>
              <span className="badge badge-warn">⚠ PARTIAL</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
