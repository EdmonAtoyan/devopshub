import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

type CaptchaProviderConfig = {
  provider: "turnstile" | "recaptcha";
  secret: string;
  verifyUrl: string;
};

@Injectable()
export class CaptchaService {
  isEnabled() {
    return !!this.resolveProvider();
  }

  async assertToken(token: string | undefined, ipAddress?: string) {
    const provider = this.resolveProvider();

    if (!provider) {
      return;
    }

    if (!token?.trim()) {
      throw new BadRequestException("Captcha verification is required");
    }

    const body = new URLSearchParams({
      secret: provider.secret,
      response: token.trim(),
    });

    if (ipAddress) {
      body.set("remoteip", ipAddress);
    }

    const response = await fetch(provider.verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("Captcha verification is unavailable");
    }

    const payload = (await response.json()) as {
      success?: boolean;
      ["error-codes"]?: string[];
    };

    if (!payload.success) {
      throw new BadRequestException("Captcha verification failed");
    }
  }

  private resolveProvider(): CaptchaProviderConfig | null {
    const configuredProvider = process.env.CAPTCHA_PROVIDER?.trim().toLowerCase();
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY?.trim();
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

    if (configuredProvider === "recaptcha") {
      return recaptchaSecret && recaptchaSiteKey
        ? {
            provider: "recaptcha",
            secret: recaptchaSecret,
            verifyUrl: "https://www.google.com/recaptcha/api/siteverify",
          }
        : null;
    }

    if (configuredProvider === "turnstile") {
      return turnstileSecret && turnstileSiteKey
        ? {
            provider: "turnstile",
            secret: turnstileSecret,
            verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          }
        : null;
    }

    if (turnstileSecret && turnstileSiteKey) {
      return {
        provider: "turnstile",
        secret: turnstileSecret,
        verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      };
    }

    if (recaptchaSecret && recaptchaSiteKey) {
      return {
        provider: "recaptcha",
        secret: recaptchaSecret,
        verifyUrl: "https://www.google.com/recaptcha/api/siteverify",
      };
    }

    return null;
  }
}
