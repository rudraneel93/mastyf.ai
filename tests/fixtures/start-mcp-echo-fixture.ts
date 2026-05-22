import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface EchoFixtureHandle {
  port: number;
  close: () => Promise<void>;
}

function waitForReady(child: ChildProcess, timeoutMs = 10_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('echo fixture did not become ready')), timeoutMs);
    const onData = (buf: Buffer) => {
      const m = String(buf).match(/READY:(\d+)/);
      if (m) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        resolve(Number(m[1]));
      }
    };
    child.stdout?.on('data', onData);
    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`echo fixture exited with code ${code}`));
      }
    });
  });
}

export async function startMcpHttpEchoFixture(): Promise<EchoFixtureHandle> {
  const script = path.join(__dirname, 'mcp-http-echo-server.cjs');
  const child = spawn('node', [script, '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await waitForReady(child);
  return {
    port,
    close: () =>
      new Promise((resolve) => {
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 2000);
      }),
  };
}

export async function startMcpWsEchoFixture(): Promise<EchoFixtureHandle> {
  const script = path.join(__dirname, 'mcp-ws-echo-server.cjs');
  const child = spawn('node', [script, '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await waitForReady(child);
  return {
    port,
    close: () =>
      new Promise((resolve) => {
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 2000);
      }),
  };
}
