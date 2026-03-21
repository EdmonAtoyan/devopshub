import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type ResendPayload = {
  id?: string;
  message?: string;
  error?: string;
};

type MailProvider =
  | { kind: "preview" }
  | { kind: "smtp"; transporter: ReturnType<typeof nodemailer.createTransport>; from: string }
  | { kind: "resend"; apiKey: string; from: string };

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: ReturnType<typeof nodemailer.createTransport>;
  private smtpVerified = false;

  async sendMail(message: MailMessage) {
    const provider = this.getProvider();

    try {
      await this.dispatch(provider, message);
      this.logger.log(`Email dispatched via ${provider.kind} to ${message.to}: ${message.subject}`);
    } catch (error) {
      this.logDeliveryFailure(provider.kind, message, error);

      if (provider.kind === "resend") {
        const smtpFallback = this.getSmtpFallbackProvider();
        if (smtpFallback) {
          this.logger.warn(`Resend delivery failed for ${message.to}; attempting SMTP fallback.`);
          try {
            await this.sendWithSmtp(smtpFallback, message);
            this.logger.log(`Email dispatched via smtp fallback to ${message.to}: ${message.subject}`);
            return;
          } catch (smtpError) {
            this.logDeliveryFailure("smtp", message, smtpError);
          }
        } else {
          this.logger.warn("SMTP fallback is unavailable; email delivery will fail until Resend is fixed or SMTP is fully configured.");
        }
      }

      throw new InternalServerErrorException("Email delivery failed");
    }
  }

  private getProvider(): MailProvider {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM?.trim() || this.resolveFromAddress(false);

    if (resendApiKey) {
      if (!resendFrom) {
        throw new InternalServerErrorException("RESEND_FROM or SMTP_FROM must be configured");
      }

      return {
        kind: "resend",
        apiKey: resendApiKey,
        from: resendFrom,
      };
    }

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || 0);
    const from = this.resolveFromAddress(false);

    if (!host && !port && !from) {
      if (process.env.NODE_ENV === "production") {
        throw new InternalServerErrorException("Email delivery provider is not configured");
      }

      return { kind: "preview" };
    }

    if (!host || !port || !from) {
      const missing: string[] = [];
      if (!host) missing.push("SMTP_HOST");
      if (!port) missing.push("SMTP_PORT");
      if (!from) missing.push("SMTP_FROM");
      throw new InternalServerErrorException(`SMTP is not fully configured: missing ${missing.join(", ")}`);
    }

    const smtpHost = host!;
    const smtpPort = port;
    const smtpFrom = from!;

    return {
      kind: "smtp",
      transporter: this.getTransporter(smtpHost, smtpPort),
      from: smtpFrom,
    };
  }

  private getSmtpFallbackProvider(): Extract<MailProvider, { kind: "smtp" }> | null {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || 0);
    const from = this.resolveFromAddress(false);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const replyTo = process.env.SMTP_REPLY_TO?.trim();
    const secure = process.env.SMTP_SECURE?.trim();
    const hasAnySmtpConfig = Boolean(host || port || from || user || pass || replyTo || secure);

    if (!hasAnySmtpConfig) {
      return null;
    }

    const missing: string[] = [];
    if (!host) missing.push("SMTP_HOST");
    if (!port) missing.push("SMTP_PORT");
    if (!from) missing.push("SMTP_FROM");

    if (missing.length > 0) {
      this.logger.warn(`SMTP fallback is partially configured and will be skipped: missing ${missing.join(", ")}`);
      return null;
    }

    const smtpHost = host!;
    const smtpPort = port;
    const smtpFrom = from!;

    return {
      kind: "smtp",
      transporter: this.getTransporter(smtpHost, smtpPort),
      from: smtpFrom,
    };
  }

  private async dispatch(provider: MailProvider, message: MailMessage) {
    if (provider.kind === "preview") {
      this.logPreview(message);
      return;
    }

    if (provider.kind === "resend") {
      await this.sendWithResend(provider, message);
      return;
    }

    await this.sendWithSmtp(provider, message);
  }

  private getTransporter(host: string, port: number) {
    if (this.transporter) {
      return this.transporter;
    }

    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.resolveSecureMode(port),
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.transporter;
  }

  private async sendWithSmtp(
    provider: Extract<MailProvider, { kind: "smtp" }>,
    message: MailMessage,
  ) {
    if (!this.smtpVerified) {
      await provider.transporter.verify();
      this.smtpVerified = true;
      this.logger.log("SMTP transporter verification succeeded");
    }

    await provider.transporter.sendMail({
      from: provider.from,
      replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
      ...message,
    });
  }

  private async sendWithResend(
    provider: Extract<MailProvider, { kind: "resend" }>,
    message: MailMessage,
  ) {
    const replyTo = process.env.SMTP_REPLY_TO?.trim() || undefined;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: replyTo ? [replyTo] : undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as ResendPayload | null;
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `Resend responded with ${response.status}`);
    }

    this.logger.log(`Resend accepted email ${payload?.id || "unknown-id"} for ${message.to}`);
  }

  private resolveFromAddress(required = true) {
    const from = process.env.SMTP_FROM?.trim();

    if (!from && required && process.env.NODE_ENV === "production") {
      throw new InternalServerErrorException("SMTP_FROM must be configured");
    }

    return from || null;
  }

  private resolveSecureMode(port: number) {
    const configured = process.env.SMTP_SECURE?.trim().toLowerCase();
    if (configured === "true" || configured === "1") return true;
    if (configured === "false" || configured === "0") return false;
    return port === 465;
  }

  private describeDeliveryFailure(providerKind: MailProvider["kind"], error: unknown) {
    if (!(error instanceof Error)) return null;

    const message = error.message || "";
    if (providerKind === "smtp" && /(?:5\.7\.8|BadCredentials|Username and Password not accepted)/i.test(message)) {
      return "SMTP authentication failed. If you are using Gmail, set SMTP_PASS to a Gmail App Password and recreate the api container.";
    }

    if (providerKind === "smtp" && /(?:ECONNECTION|ETIMEDOUT|ENOTFOUND|ESOCKET)/i.test(message)) {
      return "SMTP connection failed. Check outbound network access, SMTP host/port values, and any EC2 firewall or provider restrictions.";
    }

    return null;
  }

  private logDeliveryFailure(providerKind: MailProvider["kind"], message: MailMessage, error: unknown) {
    this.logger.error(
      `Email delivery failed via ${providerKind} to ${message.to}: ${message.subject}`,
      error instanceof Error ? error.stack : undefined,
    );
    const hint = this.describeDeliveryFailure(providerKind, error);
    if (hint) {
      this.logger.error(hint);
    }
  }

  private logPreview(message: MailMessage) {
    this.logger.warn(`Email provider not configured. Preview for ${message.to}: ${message.subject}`);
    this.logger.log(message.text);
  }
}
