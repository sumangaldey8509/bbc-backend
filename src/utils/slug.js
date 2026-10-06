/**
 * Stable, readable folder slug for a user: `firstname_lastname`
 * (falls back to the user id when the name is empty).
 * @param {{ firstName?: string, lastName?: string, _id: any }} user
 * @returns {string}
 */
const userFolderSlug = (user) => {
  const slug = `${user.firstName || ''} ${user.lastName || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || `user_${user._id}`;
};

module.exports = { userFolderSlug };
