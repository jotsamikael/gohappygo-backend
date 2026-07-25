-- Fix Google/Facebook users incorrectly assigned ADMIN (roleId=1) at social sign-up.
-- Run on staging and production after deploying the firebase-auth.service fix.
--
-- Preview affected rows:
-- SELECT u.id, u.email, u.firebaseUid, r.code AS currentRole
-- FROM user_entity u
-- JOIN user_role_entity r ON u.roleId = r.id
-- WHERE u.firebaseUid IS NOT NULL AND r.code = 'ADMIN';

UPDATE user_entity u
INNER JOIN user_role_entity adminRole ON u.roleId = adminRole.id AND adminRole.code = 'ADMIN'
INNER JOIN user_role_entity userRole ON userRole.code = 'USER'
SET u.roleId = userRole.id
WHERE u.firebaseUid IS NOT NULL;
