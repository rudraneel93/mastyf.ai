type Props = {
  status?: string;
  statusIsError?: boolean;
};

export function DashboardShell({ status = 'Loading…', statusIsError = false }: Props) {
  return (
    <div className="enterprise-app">
      <div className="enterprise-main" style={{ padding: 48 }}>
        <p className={statusIsError ? 'status status-error' : 'status'} suppressHydrationWarning>
          {status}
        </p>
        <div
          style={{
            marginTop: 24,
            height: 120,
            maxWidth: 480,
            background: 'var(--bg-muted)',
            borderRadius: 10,
          }}
        />
      </div>
    </div>
  );
}
