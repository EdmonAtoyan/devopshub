import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePostDto {
  @IsString()
  @MaxLength(280)
  body!: string;

  @IsOptional()
  @IsString()
  codeBlock?: string;

  @IsOptional()
  @IsString()
  codeLang?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  body?: string;

  @IsOptional()
  @IsString()
  codeBlock?: string;

  @IsOptional()
  @IsString()
  codeLang?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  postId?: string;

  @IsString()
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateCommentDto {
  @IsString()
  @MaxLength(1000)
  body!: string;
}
