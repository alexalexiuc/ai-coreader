import { Db, MongoClient, MongoServerError } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? 'llm_reader';

let clientPromise: Promise<MongoClient> | null = null;

function ensureUri() {
  if (!uri) throw new Error('MONGODB_URI is not set (create .env.local)');
}

export async function getClient(): Promise<MongoClient> {
  ensureUri();
  if (!clientPromise) {
    clientPromise = new MongoClient(uri!, { serverSelectionTimeoutMS: 4000 }).connect().catch((err) => {
      console.error('Mongo connection failed:', err.message);
      clientPromise = null; // allow retries
      throw new Error(`Failed to connect to MongoDB at ${uri}: ${err.message}`);
    });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}

export const collections = {
  FILES: 'files',
  BOOKS: 'books',
  BOOK_CHUNKS: 'books-chunks',
  ENTITY_DESCRIPTIONS: 'entity-descriptions',
  USERS: 'users',
  SESSIONS: 'sessions',
  USER_BOOKS: 'user-books',
};

type SchemaRuleDetail = {
  operatorName?: string;
  propertiesNotSatisfied?: Array<{
    propertyName?: string;
    details?: SchemaRuleDetail[];
  }>;
  itemsNotSatisfied?: Array<{
    index?: number;
    details?: SchemaRuleDetail[];
  }>;
  reason?: string;
  description?: string;
};

function formatMongoValidationError(err: unknown): string | null {
  if (!(err instanceof MongoServerError)) return null;
  if (err.code !== 121) return null;

  const errInfo =
    (err as { errInfo?: unknown; errorResponse?: { errInfo?: unknown } }).errInfo ??
    (err as { errorResponse?: { errInfo?: unknown } }).errorResponse?.errInfo;
  if (!errInfo || typeof errInfo !== 'object') {
    return err.message || 'Document failed validation';
  }

  const details = errInfo as { details?: { schemaRulesNotSatisfied?: SchemaRuleDetail[] }; schemaRulesNotSatisfied?: SchemaRuleDetail[] };
  const rules = details.details?.schemaRulesNotSatisfied ?? details.schemaRulesNotSatisfied;
  if (!Array.isArray(rules) || rules.length === 0) {
    return err.message || 'Document failed validation';
  }

  const messages = collectSchemaViolations(rules, '');
  if (messages.length === 0) {
    return err.message || 'Document failed validation';
  }

  return messages.join('; ');
}

function collectSchemaViolations(details: SchemaRuleDetail[], pathPrefix: string): string[] {
  const messages: string[] = [];

  for (const detail of details) {
    if (detail.propertiesNotSatisfied) {
      for (const prop of detail.propertiesNotSatisfied) {
        const propName = prop.propertyName ?? '<unknown>';
        const nextPath = pathPrefix ? `${pathPrefix}.${propName}` : propName;
        if (prop.details && prop.details.length > 0) {
          messages.push(...collectSchemaViolations(prop.details, nextPath));
        } else if (detail.reason) {
          messages.push(`${nextPath}: ${detail.reason}`);
        } else if (detail.description) {
          messages.push(`${nextPath}: ${detail.description}`);
        } else {
          messages.push(`${nextPath}: failed schema validation`);
        }
      }
      continue;
    }

    if (detail.itemsNotSatisfied) {
      for (const item of detail.itemsNotSatisfied) {
        const nextPath = `${pathPrefix}[${item.index ?? '?'}]`;
        if (item.details && item.details.length > 0) {
          messages.push(...collectSchemaViolations(item.details, nextPath));
        } else if (detail.reason) {
          messages.push(`${nextPath}: ${detail.reason}`);
        } else if (detail.description) {
          messages.push(`${nextPath}: ${detail.description}`);
        } else {
          messages.push(`${nextPath}: failed schema validation`);
        }
      }
      continue;
    }

    if (detail.reason) {
      messages.push(`${pathPrefix || '<root>'}: ${detail.reason}`);
      continue;
    }

    if (detail.description) {
      messages.push(`${pathPrefix || '<root>'}: ${detail.description}`);
    }
  }

  return messages;
}

export async function withMongoValidation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const validationMessage = formatMongoValidationError(err);
    if (validationMessage) {
      throw new Error(`Mongo validation failed: ${validationMessage}`, { cause: err });
    }
    throw err;
  }
}
