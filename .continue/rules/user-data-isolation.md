---
globs: '**/*DB*.ts'
description: Apply when working with IndexedDB stores that cache data from
  multiple users or need user isolation
alwaysApply: false
---

Always isolate user data in IndexedDB using compound keys that include the current user ID. For shared data like followed users' content, use keys like ['viewerUserId', 'authorUserId', 'id'] to prevent users from accessing other users' cached data. Never store cross-user data with global keys that could allow unauthorized access when users switch accounts.
