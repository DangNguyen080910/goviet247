// Shared buckets may expose other prefixes. Chat requires an explicit deny
// covering its entire prefix for anonymous and all other-account principals.
export function hasPrivateChatPrefixPolicy(policy, bucket, accountId) {
  if (!/^[0-9]{12}$/.test(accountId || '') || !bucket) return false;
  try {
    const parsed = typeof policy === 'string' ? JSON.parse(policy) : policy;
    const statements = Array.isArray(parsed?.Statement) ? parsed.Statement : [parsed?.Statement];
    return statements.some(statement => {
      const resources = Array.isArray(statement?.Resource) ? statement.Resource : [statement?.Resource];
      const actions = Array.isArray(statement?.Action) ? statement.Action : [statement?.Action];
      const condition = statement?.Condition;
      const comparison = condition?.StringNotEquals;
      return statement?.Effect === 'Deny' && statement.Principal === '*' && !statement.NotPrincipal &&
        actions.includes('s3:*') && resources.includes(`arn:aws:s3:::${bucket}/trip-chat/*`) &&
        condition && Object.keys(condition).length === 1 && comparison && Object.keys(comparison).length === 1 &&
        comparison['aws:PrincipalAccount'] === accountId;
    });
  } catch { return false; }
}
