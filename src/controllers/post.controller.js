const postService = require('../services/post.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');

/**
 * Create a new post.
 * POST /api/posts
 * Body: { content, mediaUrl?, mediaType?, documentAttachment? }
 */
const createPost = async (req, res) => {
  try {
    const { content, mediaUrl, mediaType, documentAttachment } = req.body;
    const post = await postService.createPost({
      authorId: req.user._id,
      content,
      mediaUrl,
      mediaType,
      documentAttachment,
    });
    return sendSuccess(res, post, 'Post published successfully.', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to create post.', error.statusCode || 500, error);
  }
};

/**
 * Get feed posts with pagination & filters.
 * GET /api/posts?page=1&limit=10&tag=&search=
 */
const getFeedPosts = async (req, res) => {
  try {
    const { page, limit, tag, search } = req.query;
    const currentUserId = req.user ? req.user._id : null;
    const feed = await postService.getFeedPosts({
      currentUserId,
      page,
      limit,
      tag,
      search,
    });
    return sendSuccess(res, feed, 'Feed posts retrieved successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to retrieve feed.', error.statusCode || 500, error);
  }
};

/**
 * Get a single post by ID.
 * GET /api/posts/:id
 */
const getPostById = async (req, res) => {
  try {
    const currentUserId = req.user ? req.user._id : null;
    const post = await postService.getPostById(req.params.id, currentUserId);
    return sendSuccess(res, post, 'Post retrieved successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to retrieve post.', error.statusCode || 500, error);
  }
};

/**
 * Update an existing post.
 * PUT /api/posts/:id
 * Body: { content, mediaUrl?, mediaType?, documentAttachment? }
 */
const updatePost = async (req, res) => {
  try {
    const { content, mediaUrl, mediaType, documentAttachment } = req.body;
    const roles = req.user.roles || [];
    const isAdmin = roles.some((role) => (role && role.name ? role.name : role) === 'admin');
    const updatedPost = await postService.updatePost(
      req.params.id,
      req.user._id,
      { content, mediaUrl, mediaType, documentAttachment },
      isAdmin
    );
    return sendSuccess(res, updatedPost, 'Post updated successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to update post.', error.statusCode || 500, error);
  }
};

/**
 * Toggle like/unlike on a post.
 * POST /api/posts/:id/like
 */
const toggleLikePost = async (req, res) => {
  try {
    const result = await postService.toggleLikePost(req.params.id, req.user._id);
    return sendSuccess(res, result, result.isLiked ? 'Post liked.' : 'Post unliked.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to toggle like.', error.statusCode || 500, error);
  }
};

/**
 * Get comments for a post.
 * GET /api/posts/:id/comments
 */
const getPostComments = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const comments = await postService.getPostComments(req.params.id, { page, limit });
    return sendSuccess(res, comments, 'Comments retrieved successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to retrieve comments.', error.statusCode || 500, error);
  }
};

/**
 * Add a comment to a post (or a reply).
 * POST /api/posts/:id/comments
 * Body: { text, parentCommentId? }
 */
const addComment = async (req, res) => {
  try {
    const { text, parentCommentId } = req.body;
    const comment = await postService.addComment(req.params.id, req.user._id, text, parentCommentId);
    return sendSuccess(res, comment, 'Comment added successfully.', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to add comment.', error.statusCode || 500, error);
  }
};

/**
 * Update a comment on a post.
 * PUT /api/posts/:id/comments/:commentId
 * Body: { text }
 */
const updateComment = async (req, res) => {
  try {
    const { text } = req.body;
    const roles = req.user.roles || [];
    const isAdmin = roles.some((role) => (role && role.name ? role.name : role) === 'admin');
    const updated = await postService.updateComment(
      req.params.id,
      req.params.commentId,
      req.user._id,
      text,
      isAdmin
    );
    return sendSuccess(res, updated, 'Comment updated successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to update comment.', error.statusCode || 500, error);
  }
};

/**
 * Delete a comment from a post.
 * DELETE /api/posts/:id/comments/:commentId
 */
const deleteComment = async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.some((role) => (role && role.name ? role.name : role) === 'admin');
    const result = await postService.deleteComment(
      req.params.id,
      req.params.commentId,
      req.user._id,
      isAdmin
    );
    return sendSuccess(res, result, 'Comment deleted successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to delete comment.', error.statusCode || 500, error);
  }
};

/**
 * Delete a post.
 * DELETE /api/posts/:id
 */
const deletePost = async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.some((role) => (role && role.name ? role.name : role) === 'admin');
    const result = await postService.deletePost(req.params.id, req.user._id, isAdmin);
    return sendSuccess(res, result, 'Post deleted successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to delete post.', error.statusCode || 500, error);
  }
};

module.exports = {
  createPost,
  getFeedPosts,
  getPostById,
  updatePost,
  toggleLikePost,
  getPostComments,
  addComment,
  updateComment,
  deleteComment,
  deletePost,
};
