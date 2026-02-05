import { Tokenizer } from "@huggingface/tokenizers";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

const tokenizerPath = fileURLToPath(new URL("./tokenizer.json", import.meta.url));

type TokenizerConfig = Record<string, unknown>;

let tokenizerPromise: Promise<Tokenizer> | undefined;

const loadTokenizer = async (): Promise<Tokenizer> => {
  const raw = await readFile(tokenizerPath, "utf-8");
  const tokenizerJson = JSON.parse(raw) as Record<string, unknown>;
  const tokenizerConfig =
    (tokenizerJson as { tokenizer_config?: TokenizerConfig }).tokenizer_config ?? {};
  return new Tokenizer(tokenizerJson, tokenizerConfig);
};

const getTokenizer = (): Promise<Tokenizer> => {
  if (!tokenizerPromise) {
    tokenizerPromise = loadTokenizer();
  }

  return tokenizerPromise;
};

export const countTokens = async (text: string): Promise<number> => {
  const tokenizer = await getTokenizer();
  const encoding = tokenizer.encode(text ?? "");
  return encoding.ids.length;
};
