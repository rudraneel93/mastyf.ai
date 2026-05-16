/**
 * Example detector plugin — enable with:
 *   GUARDIAN_PLUGINS_ENABLED=true
 *   GUARDIAN_PLUGIN_PATH=/path/to/examples/plugins
 */
export default {
  name: 'custom-secret-pattern',
  scanArguments(text, ctx) {
    const findings = [];
    const re = /CUSTOM_SECRET_[A-Z0-9]{8}/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      findings.push({
        type: 'custom-secret-pattern',
        location: ctx.location || 'unknown',
        severity: 'HIGH',
        redacted: 'CUSTOM_SECRET_[REDACTED]',
        context: ctx.location,
        method: 'regex',
      });
    }
    return findings;
  },
};
