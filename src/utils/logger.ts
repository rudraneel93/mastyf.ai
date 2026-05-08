import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const rawLevel = process.env.LOG_LEVEL?.toUpperCase();
const LOG_LEVEL: LogLevel = (rawLevel !== undefined && rawLevel in LogLevel)
  ? LogLevel[rawLevel as keyof typeof LogLevel]
  : LogLevel.INFO;

export class Logger {
  static debug(msg: string): void {
    if (LOG_LEVEL <= LogLevel.DEBUG) {
      console.error(chalk.gray(`[DEBUG] ${msg}`));
    }
  }

  static info(msg: string): void {
    if (LOG_LEVEL <= LogLevel.INFO) {
      console.error(chalk.blue(`[INFO] ${msg}`));
    }
  }

  static warn(msg: string): void {
    if (LOG_LEVEL <= LogLevel.WARN) {
      console.error(chalk.yellow(`[WARN] ${msg}`));
    }
  }

  static error(msg: string): void {
    if (LOG_LEVEL <= LogLevel.ERROR) {
      console.error(chalk.red(`[ERROR] ${msg}`));
    }
  }
}