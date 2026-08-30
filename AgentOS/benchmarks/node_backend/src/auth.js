// Seeded defect: token validation bypassed on empty string
function validateToken(token) {
  if (!token) return false;
  return token.startsWith("Bearer valid_");
}
module.exports = { validateToken };
