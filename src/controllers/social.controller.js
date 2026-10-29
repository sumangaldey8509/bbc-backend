const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { calculateScores } = require('../utils/trust');

const ok = (vis, rel) =>
  rel === 'self' || vis === 'public' || (vis === 'restricted' && rel === 'follower');

const DEFAULT_VISIBILITY = {
  highlights: 'public',
  suggestions: 'private',
  recommendations: 'public',
  followers: 'public',
  following: 'public',
  awards: 'public',
  testimonials: 'public',
  posts: 'public',
  tags: 'public',
};

const getSocial = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const view = req.query.view;
    const currentUserId = String(req.user._id || req.user.id);
    const sc = await calculateScores();

    const users = await db.collection('users').find().project({ name: 1, firstName: 1, lastName: 1 }).toArray();
    const nm = Object.fromEntries(
      users.map((u) => [
        String(u._id),
        u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User',
      ])
    );

    const profs = Object.fromEntries(
      (await db.collection('profiles').find().toArray()).map((p) => [String(p.userId), p])
    );

    const fol = (
      await db.collection('follows').find({ from: currentUserId, status: 'accepted' }).toArray()
    ).map((f) => f.to);

    const decorate = (p) => ({
      ...p,
      name: nm[p.author] || 'Council Member',
      photo: profs[p.author]?.photo,
      ...(sc[p.author] || {}),
    });

    if (view === 'feed') {
      const rawPosts = await db.collection('posts').find().sort({ at: -1 }).limit(100).toArray();

      const posts = rawPosts
        .filter((p) =>
          ok(
            { ...DEFAULT_VISIBILITY, ...profs[p.author]?.vis }.posts,
            p.author === currentUserId ? 'self' : fol.includes(p.author) ? 'follower' : 'other'
          )
        )
        .map((p) => ({
          ...decorate(p),
          rank: (sc[p.author]?.score || 0) - ((Date.now() - new Date(p.at).getTime()) / 36e5) * 0.5,
        }))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 40);

      for (const p of posts) {
        p.comments = (
          await db
            .collection('comments')
            .find({ postId: String(p._id) })
            .sort({ at: 1 })
            .limit(15)
            .toArray()
        ).map((c) => ({ ...c, name: nm[c.author] || 'Member' }));

        p.tags = (
          await db.collection('tags').find({ postId: String(p._id), status: 'accepted' }).toArray()
        ).map((t) => nm[t.userId] || 'Member');
      }

      const since24h = new Date(Date.now() - 24 * 36e5);
      const statuses = await db
        .collection('statuses')
        .find({ at: { $gte: since24h } })
        .sort({ at: -1 })
        .toArray();

      const followRequests = await db
        .collection('follows')
        .find({ to: currentUserId, status: 'pending' })
        .toArray();

      const m = db.collection('members');

      return sendSuccess(res, {
        me: currentUserId,
        posts,
        statuses: statuses.map((x) => ({ ...x, name: nm[x.author] || 'Member' })),
        requests: followRequests.map((f) => ({ id: String(f._id), name: nm[f.from] || 'Member', from: f.from })),
        people: users.filter((u) => String(u._id) !== currentUserId).map((u) => ({ id: String(u._id), name: nm[String(u._id)] })),
        notices: (await db.collection('notices').find().sort({ _id: -1 }).limit(20).toArray()).map((n) => n.text),
        events: (await db.collection('events').find().sort({ date: 1 }).limit(20).toArray()).map((e) => `${e.title} – ${e.date}`),
        wishes: (await m.find({ birthday: { $exists: true, $ne: '' } }).limit(20).toArray()).map((x) => `🎂 ${x.name} – ${x.birthday}`),
      });
    }

    // Profile View
    const targetId = req.query.id || currentUserId;
    const self = targetId === currentUserId;
    const u = await db.collection('users').findOne({ _id: new ObjectId(String(targetId)) });
    if (!u) {
      return sendError(res, 'User profile not found.', 404);
    }

    const p = profs[targetId] || {};
    const vis = { ...DEFAULT_VISIBILITY, ...p.vis };
    const f = await db.collection('follows').findOne({ from: currentUserId, to: targetId });
    const rel = self ? 'self' : f?.status === 'accepted' ? 'follower' : 'other';
    const can = (k) => ok(vis[k], rel);

    const aw = await db.collection('awards').findOne({ from: currentUserId, to: targetId, active: true });
    const sec = {};
    const C = (c, filter) => db.collection(c).find(filter).toArray();
    const names = (arr, key) => arr.map((x) => ({ id: x[key], name: nm[x[key]] || 'Member' }));

    sec.highlights = can('highlights') ? p.highlights || [] : null;
    sec.recommendations = can('recommendations')
      ? (await C('testimonials', { to: targetId, kind: 'recommendation' })).map((t) => ({ ...t, name: nm[t.from] }))
      : null;
    sec.testimonials = can('testimonials')
      ? (await C('testimonials', { to: targetId, kind: 'testimonial' })).map((t) => ({ ...t, name: nm[t.from] }))
      : null;
    sec.followers = can('followers') ? names(await C('follows', { to: targetId, status: 'accepted' }), 'from') : null;
    sec.following = can('following') ? names(await C('follows', { from: targetId, status: 'accepted' }), 'to') : null;
    sec.awards = can('awards') ? names(await C('awards', { to: targetId, active: true }), 'from') : null;
    sec.posts = can('posts')
      ? (await db.collection('posts').find({ author: targetId }).sort({ at: -1 }).limit(30).toArray()).map(decorate)
      : null;
    sec.tags = can('tags')
      ? await Promise.all(
          (await C('tags', { userId: targetId, status: 'accepted' })).map(async (t) => ({
            id: String(t._id),
            by: nm[t.by],
            text: (await db.collection('posts').findOne({ _id: new ObjectId(String(t.postId)) }))?.text,
          }))
        )
      : null;

    if (self) {
      sec.suggestions = users
        .filter((x) => String(x._id) !== currentUserId && !fol.includes(String(x._id)))
        .slice(0, 6)
        .map((x) => ({ id: String(x._id), name: nm[String(x._id)] }));
      sec.pendingTags = await Promise.all(
        (await C('tags', { userId: targetId, status: 'pending' })).map(async (t) => ({
          id: String(t._id),
          by: nm[t.by],
          text: (await db.collection('posts').findOne({ _id: new ObjectId(String(t.postId)) }))?.text,
        }))
      );
    }

    const userName = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Council Member';

    return sendSuccess(res, {
      profile: {
        id: targetId,
        name: userName,
        photo: p.photo,
        banner: p.banner,
        bio: p.bio,
        ...(sc[targetId] || {}),
        awarded: !!aw,
        rel,
        followStatus: f?.status,
        vis: self ? vis : undefined,
        sec,
      },
    });
  } catch (error) {
    return sendError(res, error.message || 'Social view retrieval failed.', 500, error);
  }
};

const handleSocialAction = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const b = req.body || {};
    const a = b.action;
    const currentUserId = String(req.user._id || req.user.id);
    const at = new Date();
    const c = (n) => db.collection(n);

    if (a === 'follow') {
      if (b.to === currentUserId) return sendError(res, 'Cannot follow yourself.', 400);
      await c('follows').updateOne({ from: currentUserId, to: b.to }, { $setOnInsert: { status: 'pending', at } }, { upsert: true });
    } else if (a === 'unfollow') {
      await c('follows').deleteOne({ from: currentUserId, to: b.to });
    } else if (a === 'followRespond') {
      await c('follows').updateOne({ _id: new ObjectId(String(b.id)), to: currentUserId }, { $set: { status: b.accept ? 'accepted' : 'rejected' } });
    } else if (a === 'post') {
      if (!b.text?.trim() && !b.image) return sendError(res, 'Post content cannot be empty.', 400);
      await c('posts').insertOne({ author: currentUserId, text: b.text, image: b.image, at });
    } else if (a === 'comment') {
      if (!b.text?.trim()) return sendError(res, 'Comment text cannot be empty.', 400);
      await c('comments').insertOne({ postId: b.postId, author: currentUserId, text: b.text, at });
    } else if (a === 'status') {
      await c('statuses').insertOne({ author: currentUserId, text: b.text, at });
    } else if (a === 'award') {
      if (b.to === currentUserId) return sendError(res, 'You cannot award yourself.', 400);
      await c('awards').updateOne({ from: currentUserId, to: b.to }, { $set: { active: !!b.on, at } }, { upsert: true });
    } else if (a === 'testimonial') {
      if (b.to === currentUserId) return sendError(res, 'Cannot recommend yourself.', 400);
      await c('testimonials').insertOne({
        to: b.to,
        from: currentUserId,
        kind: b.kind === 'recommendation' ? 'recommendation' : 'testimonial',
        text: b.text,
        at,
      });
    } else if (a === 'tag') {
      if (!(await c('posts').findOne({ _id: new ObjectId(String(b.postId)), author: currentUserId }))) {
        return sendError(res, 'You can only tag colleagues on your own posts.', 400);
      }
      await c('tags').insertOne({ postId: b.postId, userId: b.userId, by: currentUserId, status: 'pending', at });
    } else if (a === 'tagRespond') {
      await c('tags').updateOne({ _id: new ObjectId(String(b.id)), userId: currentUserId }, { $set: { status: b.accept ? 'accepted' : 'rejected' } });
    } else if (a === 'profile') {
      await c('profiles').updateOne(
        { userId: currentUserId },
        { $set: { userId: currentUserId, bio: b.bio, photo: b.photo, banner: b.banner, highlights: b.highlights, vis: b.vis } },
        { upsert: true }
      );
      if (b.name) await c('users').updateOne({ _id: new ObjectId(String(currentUserId)) }, { $set: { name: b.name } });
    } else {
      return sendError(res, `Unknown social action: ${a}`, 400);
    }

    return sendSuccess(res, { ok: true }, 'Action completed successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Social action failed.', 500, error);
  }
};

module.exports = {
  getSocial,
  handleSocialAction,
};
