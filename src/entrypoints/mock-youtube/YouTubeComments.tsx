import { useState, useRef, useEffect, type ReactElement, type ChangeEvent } from 'react';
import styles from './YouTubeComments.module.css';

interface Comment {
  readonly name: string;
  readonly time: string;
  readonly text: string;
  readonly likes: string;
  readonly replies: number;
  readonly pinned?: boolean;
}

interface YouTubeCommentsProps {
  readonly comments: readonly Comment[];
  readonly channelName: string;
  readonly userAvatar: string;
  readonly commentAvatar: string;
}

type VoteState = 'like' | 'dislike' | undefined;

const SKELETON_DELAY_MS = 300;
const SKELETON_COUNT = 3;
const STAGGER_STEP_S = 0.05;
const INITIAL_VISIBLE = 3;
const LOAD_MORE_STEP = 5;

const parseLikes = (s: string): number => parseInt(s.replace(/\D/g, ''), 10) || 0;

/** YouTube-style comments section with sort, input, pinned, replies, like animation. */
export function YouTubeComments({ comments, channelName, userAvatar, commentAvatar }: YouTubeCommentsProps): ReactElement {
  const [sortMode, setSortMode] = useState<'top' | 'newest'>('top');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [inputText, setInputText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [votes, setVotes] = useState<Record<number, VoteState>>({});
  const [bouncingLike, setBouncingLike] = useState<Set<number>>(new Set());
  const [replyOpenIdx, setReplyOpenIdx] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Skeleton flash on sort change.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), SKELETON_DELAY_MS);
    return () => clearTimeout(t);
  }, [sortMode]);

  const allComments = [...localComments, ...comments];
  const sorted = sortMode === 'top'
    ? [...allComments].sort((a, b) => parseLikes(b.likes) - parseLikes(a.likes))
    : [...allComments].reverse();
  const visible = sorted.slice(0, visibleCount);
  const totalCount = allComments.length;

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const addComment = () => {
    if (!inputText.trim()) return;
    setLocalComments(prev => [{
      name: 'You',
      time: 'just now',
      text: inputText.trim(),
      likes: '0',
      replies: 0,
    }, ...prev]);
    setInputText('');
    setInputFocused(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const toggleReplies = (idx: number) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const setVote = (idx: number, vote: 'like' | 'dislike') => {
    setVotes(prev => {
      const current = prev[idx];
      const next = { ...prev };
      if (current === vote) {
        delete next[idx];
      } else {
        next[idx] = vote;
        if (vote === 'like') {
          setBouncingLike(b => new Set(b).add(idx));
          setTimeout(() => setBouncingLike(b => {
            const n = new Set(b);
            n.delete(idx);
            return n;
          }), 300);
        }
      }
      return next;
    });
  };

  const openReply = (idx: number) => {
    setReplyOpenIdx(idx);
    setReplyText('');
    setReplyFocused(true);
  };

  const closeReply = () => {
    setReplyOpenIdx(null);
    setReplyText('');
    setReplyFocused(false);
    if (replyRef.current) replyRef.current.style.height = 'auto';
  };

  const onInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    autoGrow(e.target);
  };

  const onReplyChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setReplyText(e.target.value);
    autoGrow(e.target);
  };

  return (
    <div className={styles.commentsSection}>
      <div className={styles.commentsHeader}>
        <span className={styles.commentsTitle}>{totalCount.toLocaleString()} Comments</span>
        <button
          className={styles.sortButton}
          onClick={() => setShowSortMenu(s => !s)}
          aria-label="Sort comments"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm6 10h12v-2H9v2z" /></svg>
          Sort by
        </button>
        {showSortMenu && (
          <div className={styles.sortDropdown} onClick={() => setShowSortMenu(false)}>
            <button
              className={`${styles.sortRow} ${sortMode === 'top' ? styles.sortActive : ''}`}
              onClick={() => setSortMode('top')}
            >
              <span>Top comments</span>
              {sortMode === 'top' && <span>&#10003;</span>}
            </button>
            <button
              className={`${styles.sortRow} ${sortMode === 'newest' ? styles.sortActive : ''}`}
              onClick={() => setSortMode('newest')}
            >
              <span>Newest first</span>
              {sortMode === 'newest' && <span>&#10003;</span>}
            </button>
          </div>
        )}
      </div>

      {/* Add comment */}
      <div className={styles.addCommentRow}>
        <img className={styles.commentAvatar} src={userAvatar} alt="" />
        <div className={styles.commentInputWrap}>
          <textarea
            ref={inputRef}
            className={`${styles.commentInput} ${inputFocused ? styles.commentInputFocused : ''}`}
            placeholder="Add a comment..."
            value={inputText}
            onChange={onInputChange}
            onFocus={() => setInputFocused(true)}
            rows={1}
          />
          {inputFocused && (
            <div className={styles.commentButtons}>
              <button
                className={styles.commentCancelBtn}
                onClick={() => { setInputText(''); setInputFocused(false); if (inputRef.current) inputRef.current.style.height = 'auto'; }}
              >
                Cancel
              </button>
              <button
                className={styles.commentSubmitBtn}
                onClick={addComment}
                disabled={!inputText.trim()}
              >
                Comment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comment list / skeletons */}
      {loading ? (
        Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={`sk-${i}`} className={styles.skeletonItem}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonAvatar}`} />
            <div className={styles.skeletonBody}>
              <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '30%' }} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '90%' }} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '70%' }} />
            </div>
          </div>
        ))
      ) : (
        visible.map((c, i) => {
          const realIdx = sorted.indexOf(c);
          const vote = votes[realIdx];
          const liked = vote === 'like';
          const disliked = vote === 'dislike';
          const isCreatorHearted = i === 0;
          const bouncing = bouncingLike.has(realIdx);
          const replyOpen = replyOpenIdx === realIdx;
          return (
            <div
              key={`${c.name}-${i}`}
              className={styles.commentItem}
              style={{ animationDelay: `${i * STAGGER_STEP_S}s` }}
            >
              <img className={styles.commentAvatar} src={commentAvatar} alt="" />
              <div className={styles.commentBody}>
                {c.pinned && (
                  <div className={styles.pinnedLabel}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" /></svg>
                    Pinned by {channelName}
                  </div>
                )}
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{c.name}</span>
                  <span className={styles.commentTime}>{c.time}</span>
                </div>
                <p className={styles.commentText}>{c.text}</p>
                <div className={styles.commentActions}>
                  <button
                    className={`${styles.commentActionBtn} ${liked ? styles.commentLikeActive : ''}`}
                    onClick={() => setVote(realIdx, 'like')}
                    aria-pressed={liked}
                  >
                    <span className={styles.likeBtnWrap}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={liked ? '#3ea6ff' : 'currentColor'}
                        className={bouncing ? styles.likeBounce : undefined}
                      >
                        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                      </svg>
                      {isCreatorHearted && (
                        <span className={styles.creatorHeart} title={`Hearted by ${channelName}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff0000"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                        </span>
                      )}
                    </span>
                    {liked ? parseLikes(c.likes) + 1 : c.likes}
                  </button>
                  <button
                    className={`${styles.commentActionBtn} ${disliked ? styles.commentDislikeActive : ''}`}
                    onClick={() => setVote(realIdx, 'dislike')}
                    aria-pressed={disliked}
                    aria-label="Dislike"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={disliked ? '#3ea6ff' : 'currentColor'}><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" /></svg>
                  </button>
                  <button
                    className={styles.commentActionBtn}
                    onClick={() => (replyOpen ? closeReply() : openReply(realIdx))}
                    aria-expanded={replyOpen}
                  >
                    Reply
                  </button>
                </div>
                {c.replies > 0 && (
                  <button
                    className={styles.repliesToggle}
                    onClick={() => toggleReplies(realIdx)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      style={{ transform: expandedReplies.has(realIdx) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                    >
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                    {expandedReplies.has(realIdx) ? 'Hide' : 'View'} {c.replies} {c.replies === 1 ? 'reply' : 'replies'}
                  </button>
                )}
                {expandedReplies.has(realIdx) && c.replies > 0 && (
                  <div className={styles.repliesList}>
                    <div className={styles.replyItem}>
                      <img className={styles.replyAvatar} src={commentAvatar} alt="" />
                      <div>
                        <div className={styles.replyHeader}>
                          <span className={styles.replyAuthor}>{channelName}</span>
                          <span className={styles.replyTime}>1 month ago</span>
                        </div>
                        <p className={styles.replyText}>Thanks for watching! More content coming soon.</p>
                      </div>
                    </div>
                  </div>
                )}
                {replyOpen && (
                  <div className={styles.replyInputRow}>
                    <img className={styles.replyAvatar} src={userAvatar} alt="" />
                    <div className={styles.commentInputWrap}>
                      <textarea
                        ref={replyRef}
                        className={`${styles.commentInput} ${styles.replyInput} ${replyFocused ? styles.commentInputFocused : ''}`}
                        placeholder={`Reply to ${c.name}...`}
                        value={replyText}
                        onChange={onReplyChange}
                        onFocus={() => setReplyFocused(true)}
                        rows={1}
                      />
                      <div className={styles.commentButtons}>
                        <button className={styles.commentCancelBtn} onClick={closeReply}>Cancel</button>
                        <button className={styles.commentSubmitBtn} disabled={!replyText.trim()}>Reply</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {!loading && visibleCount < sorted.length && (
        <button
          className={styles.showMoreBtn}
          onClick={() => setVisibleCount(c => c + LOAD_MORE_STEP)}
        >
          Show more comments
        </button>
      )}
    </div>
  );
}
