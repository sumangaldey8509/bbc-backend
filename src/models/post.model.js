const mongoose = require('mongoose');

const documentAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    url: { type: String, trim: true, default: '' },
    size: { type: String, trim: true, default: '' },
    type: { type: String, trim: true, default: 'PDF' },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post author is required'],
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      minlength: [1, 'Post content cannot be empty'],
      maxlength: [5000, 'Post content cannot exceed 5000 characters'],
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: '',
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'none'],
      default: 'none',
    },
    documentAttachment: {
      type: documentAttachmentSchema,
      default: null,
    },
    chapter: {
      type: String,
      trim: true,
      default: '',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    targetIndustries: [
      {
        type: String,
        trim: true,
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['published', 'archived', 'hidden', 'flagged'],
      default: 'published',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'posts',
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound Indexes for fast feed queries
postSchema.index({ createdAt: -1, status: 1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ tags: 1, createdAt: -1 });
postSchema.index({ targetIndustries: 1, createdAt: -1 });

// Full text search on content and tags
postSchema.index({ content: 'text', tags: 'text' });

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
