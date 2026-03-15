import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

const POST_BODY_MAX_LENGTH = 10_000;

export class CreatePostDto {
  @IsString()
  @MaxLength(POST_BODY_MAX_LENGTH)
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
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(POST_BODY_MAX_LENGTH)
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
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
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
