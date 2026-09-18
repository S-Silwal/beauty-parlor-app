// app/reviews/page.tsx
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  service_name: string;
  reviewer_name: string;
  created_at: string;
}

interface ReviewStats {
  averageRating: number | null;
  totalReviews: number;
}

// Every review returned here already passed ReviewService.createReview's
// gate at write time — logged-in customer, their own appointment, and that
// appointment's status was COMPLETED. There's nothing further to filter:
// existing in the reviews table *is* "verified". `all=true` additionally
// pulls in bare star ratings with no written comment (the homepage's own
// preview cards only show ones with a comment to quote — this full page
// shows every verified review). `no-store` matches the same "always
// fresh" convention as the homepage's own review/rating fetches.
async function fetchAllReviews(): Promise<PublicReview[]> {
  try {
    const res = await fetch(`${API}/api/reviews/public?limit=50&all=true`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success) return data.reviews || [];
  } catch {
    // Backend unreachable — falls through to the empty state below.
  }
  return [];
}

async function fetchStats(): Promise<ReviewStats> {
  try {
    const res = await fetch(`${API}/api/reviews/stats`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success) return { averageRating: data.averageRating, totalReviews: data.totalReviews };
  } catch {
    // Backend unreachable — treated the same as "no reviews yet".
  }
  return { averageRating: null, totalReviews: 0 };
}

export default async function ReviewsPage() {
  const [reviews, stats] = await Promise.all([fetchAllReviews(), fetchStats()]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');

        .rv {
          --cream:    #F7F3EE;
          --cream-md: #EDE6DC;
          --card-bg:  #FDFAF6;
          --gold:     #B89A6A;
          --gold-lt:  #D4B896;
          --charcoal: #2C2825;
          --mid:      #6B635A;
          --soft:     #9E968E;
          background: var(--cream);
          color: var(--charcoal);
          font-family: 'Jost', sans-serif;
          min-height: 100vh;
        }

        .rv-hero {
          background: var(--charcoal);
          padding: 96px 24px 64px;
          text-align: center;
        }
        .rv-kicker {
          font-size: 11px; font-weight: 600; letter-spacing: .2em;
          text-transform: uppercase; color: var(--gold-lt); margin: 0 0 18px;
        }
        .rv-h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(38px, 5vw, 56px); font-weight: 300;
          color: #F7F3EE; margin: 0 0 18px; line-height: 1.1;
        }
        .rv-h1 em { font-style: italic; color: var(--gold-lt); }
        .rv-sub {
          font-size: 14px; font-weight: 300; color: #D9D1C7;
          max-width: 480px; margin: 0 auto 28px; line-height: 1.8;
        }
        .rv-agg {
          display: inline-flex; align-items: center; gap: 12px;
          background: rgba(212,184,150,.1); border: 1px solid rgba(212,184,150,.3);
          border-radius: 40px; padding: 12px 26px;
        }
        .rv-agg-stars { color: var(--gold-lt); font-size: 18px; letter-spacing: 2px; }
        .rv-agg-text { font-size: 13px; color: #D9D1C7; }
        .rv-agg-text strong { color: #F7F3EE; }

        .rv-body { max-width: 1100px; margin: 0 auto; padding: 64px 24px 100px; }
        .rv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .rv-card {
          background: var(--card-bg); border: 1px solid var(--cream-md);
          border-radius: 6px; padding: 30px 28px; display: flex; flex-direction: column;
        }
        .rv-stars { color: var(--gold); font-size: 16px; letter-spacing: 2px; margin-bottom: 14px; }
        .rv-comment {
          font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 19px;
          font-weight: 400; color: var(--charcoal); line-height: 1.6; margin: 0 0 20px; flex: 1;
        }
        .rv-comment-none {
          font-size: 13px; font-weight: 300; color: var(--soft); line-height: 1.7;
          margin: 0 0 20px; flex: 1;
        }
        .rv-name { font-size: 13px; font-weight: 600; color: var(--charcoal); }
        .rv-meta { font-size: 12px; font-weight: 300; color: var(--soft); margin-top: 2px; }

        .rv-empty {
          text-align: center; padding: 80px 24px;
          background: var(--card-bg); border: 1px solid var(--cream-md); border-radius: 6px;
        }
        .rv-empty-title {
          font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 400;
          color: var(--mid); margin: 0;
        }

        @media (max-width: 900px) {
          .rv-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="rv">
        <div className="rv-hero">
          <p className="rv-kicker">Verified Customers</p>
          <h1 className="rv-h1">Client <em>Reviews</em></h1>
          <p className="rv-sub">
            Every review here comes from a real, completed appointment — no account
            needed to read them.
          </p>
          {stats.totalReviews > 0 && stats.averageRating !== null && (
            <div className="rv-agg">
              <span className="rv-agg-stars" aria-hidden="true">
                {'★'.repeat(Math.round(stats.averageRating))}
                {'☆'.repeat(5 - Math.round(stats.averageRating))}
              </span>
              <span className="rv-agg-text">
                <strong>{stats.averageRating}</strong> average · {stats.totalReviews}{' '}
                {stats.totalReviews === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}
        </div>

        <div className="rv-body">
          {reviews.length === 0 ? (
            <div className="rv-empty">
              <p className="rv-empty-title">No reviews yet.</p>
            </div>
          ) : (
            <div className="rv-grid">
              {reviews.map(r => (
                <div key={r.id} className="rv-card">
                  <div className="rv-stars" aria-label={`${r.rating} out of 5 stars`}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </div>
                  {r.comment ? (
                    <p className="rv-comment">&ldquo;{r.comment}&rdquo;</p>
                  ) : (
                    <p className="rv-comment-none">No written comment left.</p>
                  )}
                  <p className="rv-name">{r.reviewer_name}</p>
                  <p className="rv-meta">
                    {r.service_name}
                    {' · '}
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
