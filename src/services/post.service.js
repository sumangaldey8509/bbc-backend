const Post = require('../models/post.model');
const PostComment = require('../models/postComment.model');
const User = require('../models/user.model');
const ProfileDetails = require('../models/profileDetails.model');
const mongoose = require('mongoose');
const { broadcastFeedEvent } = require('./realtime.service');

/**
 * Extract hashtag tokens from post content text (e.g., "#HVAC #Manufacturing").
 */
const extractHashtags = (text = '') => {
  const matches = text.match(/#[a-zA-Z0-9_\u0980-\u09FF]+/g);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.toLowerCase()))];
};

/**
 * Helper to hydrate a post or array of posts with author User and ProfileDetails.
 */
const hydratePostData = async (posts, currentUserId = null) => {
  const isArray = Array.isArray(posts);
  const postList = isArray ? posts : [posts];
  if (!postList.length) return isArray ? [] : null;

  const authorIds = [...new Set(postList.map((p) => String(p.author?._id || p.author)).filter(Boolean))];

  // Fetch users and profile details in parallel
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: authorIds } }).select('firstName lastName email').lean(),
    ProfileDetails.find({ userId: { $in: authorIds } }).select('userId avatar designation companyName city state').lean(),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

  const formatted = postList.map((post) => {
    const postObj = post.toObject ? post.toObject() : { ...post };
    const authorIdStr = String(postObj.author?._id || postObj.author);
    const user = userMap.get(authorIdStr);
    const profile = profileMap.get(authorIdStr);

    const authorName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Council Member';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=0D1B2A&color=fff&bold=true`;
    const authorAvatar = profile?.avatar || defaultAvatar;
    const authorDesignation = profile?.designation || 'Executive Member';
    const authorCompany = profile?.companyName || 'Business Enterprises';
    const chapter = postObj.chapter || (profile?.city ? `${profile.city} Chapter` : 'Kolkata Central Chapter');

    const isLiked = currentUserId
      ? (postObj.likes || []).some((id) => String(id) === String(currentUserId))
      : false;

    // Derive tag category
    const tagsLower = (postObj.tags || []).map((t) => String(t).toLowerCase());
    let tag = postObj.tag || 'General';
    if (!postObj.tag) {
      if (tagsLower.some((t) => t.includes('requirement') || t.includes('b2b'))) {
        tag = 'B2B Requirement';
      } else if (tagsLower.some((t) => t.includes('deal') || t.includes('closed') || t.includes('won'))) {
        tag = 'Deal Won';
      } else if (tagsLower.some((t) => t.includes('partnership') || t.includes('collab'))) {
        tag = 'Partnership Ask';
      } else if (tagsLower.some((t) => t.includes('event') || t.includes('conclave'))) {
        tag = 'Event Highlight';
      }
    }

    return {
      id: String(postObj._id),
      _id: postObj._id,
      authorId: authorIdStr,
      authorName,
      authorDesignation,
      authorCompany,
      authorAvatar,
      chapter,
      content: postObj.content,
      tag,
      mediaUrl: postObj.mediaUrl || undefined,
      mediaType: postObj.mediaType || 'none',
      documentAttachment: postObj.documentAttachment || undefined,
      tags: postObj.tags || [],
      likesCount: Number(postObj.likesCount || (postObj.likes ? postObj.likes.length : 0)),
      isLiked,
      commentsCount: Number(postObj.commentsCount || 0),
      sharesCount: Number(postObj.sharesCount || 0),
      status: postObj.status,
      createdAt: postObj.createdAt,
      updatedAt: postObj.updatedAt,
    };
  });

  return isArray ? formatted : formatted[0];
};

/**
 * Create a new post.
 */
const createPost = async ({ authorId, content, mediaUrl = '', mediaType = 'none', documentAttachment = null }) => {
  if (!content || !content.trim()) {
    const error = new Error('Post content is required.');
    error.statusCode = 400;
    throw error;
  }

  // Get author profile for chapter and industry context
  const authorProfile = await ProfileDetails.findOne({ userId: authorId }).lean();
  const chapter = authorProfile?.city ? `${authorProfile.city} Chapter` : 'Kolkata Central Chapter';
  const targetIndustries = Array.isArray(authorProfile?.industry) ? authorProfile.industry : [];
  const tags = extractHashtags(content);

  const newPost = await Post.create({
    author: authorId,
    content: content.trim(),
    mediaUrl: mediaUrl.trim(),
    mediaType: mediaUrl ? (mediaType !== 'none' ? mediaType : 'image') : 'none',
    documentAttachment: documentAttachment && documentAttachment.name && documentAttachment.url ? documentAttachment : null,
    chapter,
    tags,
    targetIndustries,
    likes: [],
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    status: 'published',
  });

  const hydrated = await hydratePostData(newPost, authorId);
  void broadcastFeedEvent('new_post', hydrated);
  return hydrated;
};

/**
 * Get feed posts with pagination and search/tag filtering.
 */
const getFeedPosts = async ({ currentUserId, page = 1, limit = 10, search = '', tag = '' }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const query = { status: 'published' };

  if (tag && tag !== 'All') {
    query.tags = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
  }

  if (search && search.trim()) {
    query.$text = { $search: search.trim() };
  }

  const [posts, total] = await Promise.all([
    Post.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Post.countDocuments(query),
  ]);

  const items = await hydratePostData(posts, currentUserId);

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      hasMore: skip + posts.length < total,
    },
  };
};

/**
 * Get a single post by ID.
 */
const getPostById = async (postId, currentUserId = null) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid Post ID');
    error.statusCode = 400;
    throw error;
  }

  const post = await Post.findById(postId);
  if (!post || post.status !== 'published') {
    const error = new Error('Post not found');
    error.statusCode = 404;
    throw error;
  }

  return await hydratePostData(post, currentUserId);
};

/**
 * Toggle like/unlike on a post.
 */
const toggleLikePost = async (postId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid Post ID');
    error.statusCode = 400;
    throw error;
  }

  const post = await Post.findById(postId);
  if (!post || post.status !== 'published') {
    const error = new Error('Post not found');
    error.statusCode = 404;
    throw error;
  }

  const alreadyLiked = (post.likes || []).some((id) => String(id) === String(userId));

  let updatedPost;
  if (alreadyLiked) {
    updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $pull: { likes: userId },
        $inc: { likesCount: -1 },
      },
      { new: true }
    );
  } else {
    updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $addToSet: { likes: userId },
        $inc: { likesCount: 1 },
      },
      { new: true }
    );
  }

  // Ensure count does not drop below 0
  const cleanCount = Math.max(0, updatedPost.likesCount);
  if (updatedPost.likesCount < 0) {
    await Post.findByIdAndUpdate(postId, { likesCount: cleanCount });
  }

  return {
    postId: String(postId),
    isLiked: !alreadyLiked,
    likesCount: cleanCount,
  };
};

/**
 * Add a comment to a post (or a reply to an existing comment).
 */
const addComment = async (postId, authorId, text, parentCommentId = null) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid Post ID');
    error.statusCode = 400;
    throw error;
  }

  if (!text || !text.trim()) {
    const error = new Error('Comment text cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  const post = await Post.findById(postId);
  if (!post || post.status !== 'published') {
    const error = new Error('Post not found');
    error.statusCode = 404;
    throw error;
  }

  let validParentId = null;
  if (parentCommentId) {
    if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
      const error = new Error('Invalid Parent Comment ID');
      error.statusCode = 400;
      throw error;
    }
    const parentComment = await PostComment.findById(parentCommentId);
    if (!parentComment || String(parentComment.postId) !== String(postId)) {
      const error = new Error('Parent comment not found');
      error.statusCode = 404;
      throw error;
    }
    validParentId = parentComment._id;
  }

  const comment = await PostComment.create({
    postId,
    author: authorId,
    text: text.trim(),
    parentCommentId: validParentId,
    status: 'active',
  });

  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    { $inc: { commentsCount: 1 } },
    { new: true }
  );

  // Hydrate comment author
  const [user, profile] = await Promise.all([
    User.findById(authorId).select('firstName lastName').lean(),
    ProfileDetails.findOne({ userId: authorId }).select('avatar designation companyName').lean(),
  ]);

  const authorName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Council Member';
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=0D1B2A&color=fff&bold=true`;
  const authorAvatar = profile?.avatar || defaultAvatar;
  const authorDesignation = profile?.designation || 'Executive Member';
  const authorCompany = profile?.companyName || 'Business Enterprises';

  const commentData = {
    id: String(comment._id),
    _id: comment._id,
    postId: String(postId),
    authorId: String(authorId),
    authorName,
    authorAvatar,
    authorDesignation,
    authorCompany,
    text: comment.text,
    createdAt: comment.createdAt,
    parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
    commentsCount: updatedPost ? updatedPost.commentsCount : 1,
  };

  void broadcastFeedEvent('new_comment', commentData);

  return commentData;
};

/**
 * Get comments for a post.
 */
const getPostComments = async (postId, { page = 1, limit = 50 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid Post ID');
    error.statusCode = 400;
    throw error;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [comments, total] = await Promise.all([
    PostComment.find({ postId, status: 'active' }).sort({ createdAt: 1 }).skip(skip).limit(limitNum).lean(),
    PostComment.countDocuments({ postId, status: 'active' }),
  ]);

  const authorIds = [...new Set(comments.map((c) => String(c.author)).filter(Boolean))];

  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: authorIds } }).select('firstName lastName').lean(),
    ProfileDetails.find({ userId: { $in: authorIds } }).select('userId avatar designation companyName').lean(),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

  const formatted = comments.map((comment) => {
    const authorIdStr = String(comment.author);
    const user = userMap.get(authorIdStr);
    const profile = profileMap.get(authorIdStr);

    const authorName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Council Member';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=0D1B2A&color=fff&bold=true`;
    const authorAvatar = profile?.avatar || defaultAvatar;
    const authorDesignation = profile?.designation || 'Executive Member';
    const authorCompany = profile?.companyName || 'Business Enterprises';

    return {
      id: String(comment._id),
      _id: comment._id,
      postId: String(comment.postId),
      authorId: authorIdStr,
      authorName,
      authorAvatar,
      authorDesignation,
      authorCompany,
      text: comment.text,
      createdAt: comment.createdAt,
      parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
    };
  });

  return {
    items: formatted,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      hasMore: skip + comments.length < total,
    },
  };
};

/**
 * Delete a comment from a post (and any child replies).
 */
const deleteComment = async (postId, commentId, userId, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    const error = new Error('Invalid Post ID or Comment ID');
    error.statusCode = 400;
    throw error;
  }

  const comment = await PostComment.findById(commentId);
  if (!comment || String(comment.postId) !== String(postId)) {
    const error = new Error('Comment not found');
    error.statusCode = 404;
    throw error;
  }

  if (String(comment.author) !== String(userId) && !isAdmin) {
    const error = new Error('You do not have permission to delete this comment');
    error.statusCode = 403;
    throw error;
  }

  const childComments = await PostComment.find({ parentCommentId: commentId }).select('_id').lean();
  const deletedIds = [String(commentId), ...childComments.map((c) => String(c._id))];
  const totalDeletedCount = deletedIds.length;

  await PostComment.deleteMany({ _id: { $in: deletedIds } });
  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    { $inc: { commentsCount: -totalDeletedCount } },
    { new: true }
  );

  const cleanCount = Math.max(0, updatedPost ? updatedPost.commentsCount : 0);
  if (updatedPost && updatedPost.commentsCount < 0) {
    await Post.findByIdAndUpdate(postId, { commentsCount: cleanCount });
  }

  const payload = {
    postId: String(postId),
    commentId: String(commentId),
    deletedCommentId: String(commentId),
    deletedCommentIds: deletedIds,
    commentsCount: cleanCount,
  };

  void broadcastFeedEvent('delete_comment', payload);

  return { success: true, ...payload };
};

/**
 * Update a comment on a post.
 */
const updateComment = async (postId, commentId, userId, text, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    const error = new Error('Invalid Post ID or Comment ID');
    error.statusCode = 400;
    throw error;
  }

  if (!text || !text.trim()) {
    const error = new Error('Comment text cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  const comment = await PostComment.findById(commentId);
  if (!comment || String(comment.postId) !== String(postId)) {
    const error = new Error('Comment not found');
    error.statusCode = 404;
    throw error;
  }

  if (String(comment.author) !== String(userId) && !isAdmin) {
    const error = new Error('You do not have permission to edit this comment');
    error.statusCode = 403;
    throw error;
  }

  comment.text = text.trim();
  await comment.save();

  // Hydrate comment author
  const [user, profile] = await Promise.all([
    User.findById(comment.author).select('firstName lastName').lean(),
    ProfileDetails.findOne({ userId: comment.author }).select('avatar designation companyName').lean(),
  ]);

  const authorName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Council Member';
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=0D1B2A&color=fff&bold=true`;
  const authorAvatar = profile?.avatar || defaultAvatar;
  const authorDesignation = profile?.designation || 'Executive Member';
  const authorCompany = profile?.companyName || 'Business Enterprises';

  const commentData = {
    id: String(comment._id),
    _id: comment._id,
    postId: String(postId),
    authorId: String(comment.author),
    authorName,
    authorAvatar,
    authorDesignation,
    authorCompany,
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
  };

  void broadcastFeedEvent('update_comment', commentData);

  return commentData;
};

/**
 * Update an existing post (by author or admin).
 */
const updatePost = async (postId, userId, { content, mediaUrl, mediaType, documentAttachment }, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid Post ID');
    error.statusCode = 400;
    throw error;
  }

  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    throw error;
  }

  if (String(post.author) !== String(userId) && !isAdmin) {
    const error = new Error('You do not have permission to edit this post');
    error.statusCode = 403;
    throw error;
  }

  if (content !== undefined) {
    if (!content || !content.trim()) {
      const error = new Error('Post content cannot be empty.');
      error.statusCode = 400;
      throw error;
    }
    post.content = content.trim();
    post.tags = extractHashtags(content);
  }

  if (mediaUrl !== undefined) {
    post.mediaUrl = mediaUrl ? mediaUrl.trim() : '';
    post.mediaType = post.mediaUrl ? (mediaType && mediaType !== 'none' ? mediaType : 'image') : 'none';
  }

  if (documentAttachment !== undefined) {
    post.documentAttachment = documentAttachment && documentAttachment.name && documentAttachment.url ? documentAttachment : null;
  }

  await post.save();
  const hydrated = await hydratePostData(post, userId);
  void broadcastFeedEvent('update_post', hydrated);
  return hydrated;
};

/**
 * Delete a post (by author or admin).
 */
const deletePost = async (postId, userId, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid Post ID');
    error.statusCode = 400;
    throw error;
  }

  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    throw error;
  }

  if (String(post.author) !== String(userId) && !isAdmin) {
    const error = new Error('You do not have permission to delete this post');
    error.statusCode = 403;
    throw error;
  }

  await Promise.all([
    Post.findByIdAndDelete(postId),
    PostComment.deleteMany({ postId }),
  ]);

  void broadcastFeedEvent('delete_post', { id: String(postId), deletedPostId: String(postId) });

  return { success: true, deletedPostId: String(postId) };
};

module.exports = {
  createPost,
  getFeedPosts,
  getPostById,
  updatePost,
  toggleLikePost,
  addComment,
  getPostComments,
  updateComment,
  deleteComment,
  deletePost,
};
