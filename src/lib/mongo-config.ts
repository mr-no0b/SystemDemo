const DEFAULT_LOCAL_MONGODB_URI = "mongodb://127.0.0.1:27017/academiaone";

export type MongoTarget = "atlas" | "local";
type MongoTargetInput = MongoTarget | "global";

export interface MongoConnectionConfig {
  target: MongoTarget;
  uri: string;
}

function readEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getMongoConnectionConfig(
  env: NodeJS.ProcessEnv = process.env
): MongoConnectionConfig {
  const rawTarget = readEnvValue(env.MONGODB_TARGET)?.toLowerCase() as
    | MongoTargetInput
    | undefined;
  const target: MongoTarget | undefined =
    rawTarget === "global" ? "atlas" : rawTarget;
  const atlasUri = readEnvValue(env.MONGODB_URI_ATLAS) ?? readEnvValue(env.MONGODB_URI);
  const localUri = readEnvValue(env.MONGODB_URI_LOCAL);

  if (target === "local") {
    return {
      target: "local",
      uri: localUri ?? DEFAULT_LOCAL_MONGODB_URI,
    };
  }

  if (target === "atlas") {
    if (!atlasUri) {
      throw new Error(
        "MONGODB_TARGET=atlas requires MONGODB_URI_ATLAS or MONGODB_URI in .env.local"
      );
    }

    return {
      target: "atlas",
      uri: atlasUri,
    };
  }

  if (atlasUri) {
    return {
      target: "atlas",
      uri: atlasUri,
    };
  }

  if (localUri) {
    return {
      target: "local",
      uri: localUri,
    };
  }

  throw new Error(
    [
      "No MongoDB connection string was found.",
      "Use MONGODB_URI for Atlas, or set MONGODB_TARGET=local.",
      "MONGODB_TARGET=global is also accepted as an alias for Atlas.",
      `and optionally MONGODB_URI_LOCAL (defaults to ${DEFAULT_LOCAL_MONGODB_URI}).`,
    ].join(" ")
  );
}

export { DEFAULT_LOCAL_MONGODB_URI };
