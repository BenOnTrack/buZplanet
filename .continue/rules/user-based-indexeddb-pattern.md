---
description: When implementing IndexedDB storage in multi-user applications with
  Firebase Auth
alwaysApply: false
---

Always implement user-based data isolation in IndexedDB:

1. **Use compound keys** with [userId, entityId] structure for object stores
2. **Create userId indexes** for efficient user-scoped querying
3. **Subscribe to auth state changes** and reinitialize storage when user changes
4. **Scope all CRUD operations** to current user automatically
5. **Support anonymous users** with 'anonymous' as fallback userId
6. **Clean state transitions** - reset stats and data when switching users
7. **Increment database versions** when changing schema
8. **Update TypeScript interfaces** to include userId fields
9. **Use getCurrentUserId() helper** to get current user or 'anonymous'
10. **Handle auth subscription cleanup** in destroy() methods

This prevents data conflicts and ensures proper multi-user data isolation in shared browser environments.
