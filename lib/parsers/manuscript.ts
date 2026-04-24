import mammoth from 'mammoth';

export interface ParsedParagraph {
  seq: number;
  text: string;
}

export interface ParseResult {
  paragraphs: ParsedParagraph[];
  charCount: number;
  mimeType: string;
}

const MAX_CHAR_COUNT = 500_000;

export async function parseManuscript(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ParseResult> {
  let raw: string;

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value;
  } else if (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    filename.endsWith('.md') ||
    filename.endsWith('.txt')
  ) {
    raw = buffer.toString('utf-8');
  } else {
    throw new Error(`不支持的文件格式：${mimeType}（${filename}）`);
  }

  if (raw.length > MAX_CHAR_COUNT) {
    throw new Error(`文件字符数超出上限（${raw.length} > ${MAX_CHAR_COUNT}）`);
  }

  const lines = raw.split(/\r?\n/);
  const paragraphs: ParsedParagraph[] = [];
  let seq = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    paragraphs.push({ seq: seq++, text: trimmed });
  }

  return {
    paragraphs,
    charCount: raw.length,
    mimeType,
  };
}
