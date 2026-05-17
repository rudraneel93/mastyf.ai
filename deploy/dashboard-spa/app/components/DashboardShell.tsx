type Props = {
  status?: string;
  statusIsError?: boolean;
};

/** Static shell used for loading placeholders (matches pre-hydration HTML). */
export function DashboardShell({ status = 'Loading…', statusIsError = false }: Props) {
  return (
    <main>
      <header>
        <h1>MCP Guardian</h1>
        <p
          className={statusIsError ? 'status status-error' : 'status'}
          suppressHydrationWarning
        >
          {status}
        </p>
      </header>
    </main>
  );
}
