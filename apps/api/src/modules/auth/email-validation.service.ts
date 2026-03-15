import { BadRequestException, Injectable } from "@nestjs/common";
import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import { STRICT_EMAIL_REGEX } from "./email.constants";

@Injectable()
export class EmailValidationService {
  async normalizeAndValidate(emailInput: string) {
    const email = emailInput.trim().toLowerCase();

    if (!STRICT_EMAIL_REGEX.test(email) || email.length > 254) {
      throw new BadRequestException("Enter a valid email address");
    }

    const [, domain] = email.split("@");
    if (!domain) {
      throw new BadRequestException("Enter a valid email address");
    }

    if (!(await this.domainAcceptsEmail(domain))) {
      throw new BadRequestException("Email domain could not be verified");
    }

    return email;
  }

  private async domainAcceptsEmail(domain: string) {
    try {
      const records = await resolveMx(domain);
      if (records.length > 0) return true;
    } catch {}

    try {
      await Promise.any([resolve4(domain), resolve6(domain)]);
      return true;
    } catch {
      return false;
    }
  }
}
