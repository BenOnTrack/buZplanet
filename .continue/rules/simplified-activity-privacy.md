---
alwaysApply: true
---

User profiles are always public - no user profile privacy settings exist. For activity feed items, only check content-specific privacy (like story.isPublic for story activities). User following is always immediately accepted since all profiles are public. Remove any checks for UserProfile.isPublic, allowFollowers, or showActivity as these fields no longer exist.
