declare module 'nodemailer' {
  export function createTransport(config: Record<string, unknown>): {
    sendMail: (message: Record<string, unknown>) => Promise<{ messageId: string }>;
    verify: () => Promise<boolean>;
  };
}
