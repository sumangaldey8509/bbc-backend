const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const { authenticate, optionalAuthenticate } = require('../middlewares/auth.middleware');

// Public/optional auth feed reads
router.get('/', optionalAuthenticate, postController.getFeedPosts);
router.get('/:id', optionalAuthenticate, postController.getPostById);
router.get('/:id/comments', optionalAuthenticate, postController.getPostComments);

// Authenticated mutations
router.post('/', authenticate, postController.createPost);
router.put('/:id', authenticate, postController.updatePost);
router.delete('/:id', authenticate, postController.deletePost);
router.post('/:id/like', authenticate, postController.toggleLikePost);
router.post('/:id/comments', authenticate, postController.addComment);
router.put('/:id/comments/:commentId', authenticate, postController.updateComment);
router.delete('/:id/comments/:commentId', authenticate, postController.deleteComment);

module.exports = router;
