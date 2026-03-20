import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { STRICT_EMAIL_REGEX } from "./email.constants";

export class RegisterDto {
  @IsEmail()
  @Matches(STRICT_EMAIL_REGEX, { message: "Enter a valid email address" })
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

export class LoginDto {
  @IsEmail()
  @Matches(STRICT_EMAIL_REGEX, { message: "Enter a valid email address" })
  email!: string;

  @IsString()
  @MinLength(1, { message: "Password is required" })
  password!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @Matches(STRICT_EMAIL_REGEX, { message: "Enter a valid email address" })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  @Matches(STRICT_EMAIL_REGEX, { message: "Enter a valid email address" })
  email!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}
