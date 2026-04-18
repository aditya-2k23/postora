# Security Specification: Social Media Studio

## 1. Data Invariants
1. A Project must belong to a valid authenticated user.
2. A user can only access, create, update, and delete their own projects.
3. The `userId` field of a Project must strictly match `request.auth.uid`.
4. The `createdAt` timestamp must be strictly validated during creation and must not be updated thereafter.
5. The `updatedAt` timestamp must be strictly validated during creation and updates.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1: Unauthenticated Create:** Attempting to create a Project without being signed in.
2. **Payload 2: Cross-User Create:** Signed in as User A, attempting to create a Project where `userId` is User B's ID.
3. **Payload 3: Cross-User DB Read:** Signed in as User A, attempting to read a Project belonging to User B.
4. **Payload 4: Shadow Field Injection:** Sending a Project creation payload with an extra unauthorized field (e.g., `isAdmin: true`).
5. **Payload 5: ID Poisoning:** Creating a project with a malicious/massive ID string.
6. **Payload 6: Timestamp Spoofing (Create):** Creating a project with `createdAt` set to a past date instead of `request.time`.
7. **Payload 7: Timestamp Spoofing (Update):** Updating a project with `updatedAt` set to a future/past date.
8. **Payload 8: Immutable Field Modification:** Attempting to change `createdAt` or `userId` during an update.
9. **Payload 9: Array Overload:** Attempting to add 1000 cards to the `cards` array.
10. **Payload 10: Type Mismatch:** Attempting to save a Project where `platform` is an array instead of a string.
11. **Payload 11: Missing Required Field:** Creating a project without `aspectRatio`.
12. **Payload 12: Nested Theme Modification with invalid types:** Giving `themeSettings.fontSize` a string value instead of a number.

## 3. Test Runner
Will be implemented in `firestore.rules.test.ts`
