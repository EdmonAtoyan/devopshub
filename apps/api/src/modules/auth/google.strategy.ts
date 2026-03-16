import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy, VerifyCallback } from "passport-google-oauth20";

export type GoogleAuthUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    const clientID = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const callbackURL = process.env.GOOGLE_CALLBACK_URL?.trim();

    super({
      clientID: clientID || "google-client-id-missing",
      clientSecret: clientSecret || "google-client-secret-missing",
      callbackURL: callbackURL || "http://localhost:3001/api/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const verifiedEmail = profile.emails?.find((entry) => entry.verified)?.value;
    const fallbackEmail = profile.emails?.[0]?.value;
    const email = (verifiedEmail || fallbackEmail || "").trim().toLowerCase();

    if (!email) {
      done(new UnauthorizedException("Google account did not provide an email address"), false);
      return;
    }

    const displayName = profile.displayName?.trim() || email.split("@")[0] || "Google user";
    const avatarUrl = profile.photos?.[0]?.value?.trim() || null;

    done(null, {
      email,
      name: displayName,
      avatarUrl,
    });
  }
}
