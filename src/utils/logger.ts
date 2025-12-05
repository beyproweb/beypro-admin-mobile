/**
 * Production-ready logger that only logs in development mode
 * Prevents console overhead in production builds
 */

const isDev = process.env.NODE_ENV === "development" || __DEV__;

export const logger = {
  /**
   * Log info-level messages (only in dev)
   */
  log: (message: string, data?: any) => {
    if (isDev) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  },

  /**
   * Log warning-level messages (only in dev)
   */
  warn: (message: string, data?: any) => {
    if (isDev) {
      if (data !== undefined) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  },

  /**
   * Log error-level messages (only in dev)
   */
  error: (message: string, error?: any) => {
    if (isDev) {
      if (error !== undefined) {
        console.error(message, error);
      } else {
        console.error(message);
      }
    }
  },

  /**
   * Time an operation and log result (only in dev)
   */
  time: (label: string) => {
    if (isDev) {
      console.time(label);
    }
    return {
      end: () => {
        if (isDev) {
          console.timeEnd(label);
        }
      },
    };
  },

  /**
   * Group related logs (only in dev)
   */
  group: (label: string) => {
    if (isDev) {
      console.group(label);
    }
  },

  /**
   * End log group (only in dev)
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },
};

export default logger;
