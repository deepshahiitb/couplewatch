import React, { useState, useEffect } from 'react';
import { Heart, X, Film, Tv, Users, LogOut, Star, Flame, Check, Search } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const TMDB_API_KEY = '76dbff05004b7238127fe74ab6be5e2f';
const SUPABASE_URL = 'https://ebjgjuniziowsiwxzabl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViamdqdW5pemlvd3Npd3h6YWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDkxMTcsImV4cCI6MjA4NjU4NTExN30.sZsnwP6ItG6YTAO910_eZDP76JptxqcJP_X6c6dXMZw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function CoupleWatch() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); // auth, swipe, compare, matches
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [myCode, setMyCode] = useState('');
  const [compareCode, setCompareCode] = useState('');
  const [currentContent, setCurrentContent] = useState(null);
  const [contentQueue, setContentQueue] = useState([]);
  const [myLikes, setMyLikes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCodePopup, setShowCodePopup] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        initializeUser(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        initializeUser(session.user.id);
      } else {
        setUser(null);
        setView('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && view === 'swipe' && contentQueue.length === 0) {
      loadContent();
    }
  }, [user, view, contentQueue]);

  const initializeUser = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // Create user record
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await supabase.from('users').insert({
          id: userId,
          email: user?.email,
          display_name: displayName || 'User',
          couple_code: code
        });
        setMyCode(code);
      } else if (data) {
        setMyCode(data.couple_code);
      }
      
      // Load user's likes
      await loadMyLikes(userId);
      setView('swipe');
    } catch (err) {
      console.error('Error initializing user:', err);
    }
  };

  const loadMyLikes = async (userId) => {
    try {
      const { data } = await supabase
        .from('swipes')
        .select('*')
        .eq('user_id', userId)
        .eq('liked', true);

      if (data) {
        const likedContent = await Promise.all(
          data.map(async (swipe) => {
            const endpoint = swipe.content_type === 'movie' ? 'movie' : 'tv';
            const res = await fetch(
              `https://api.themoviedb.org/3/${endpoint}/${swipe.content_id}?api_key=${TMDB_API_KEY}`
            );
            const content = await res.json();
            return { ...content, type: swipe.content_type };
          })
        );
        setMyLikes(likedContent);
      }
    } catch (err) {
      console.error('Error loading likes:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (authMode === 'signup') {
        result = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } }
        });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const loadContent = async () => {
    try {
      const moviesRes = await fetch(
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${Math.floor(Math.random() * 5) + 1}`
      );
      const tvRes = await fetch(
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${Math.floor(Math.random() * 5) + 1}`
      );

      const movies = await moviesRes.json();
      const tv = await tvRes.json();

      const combined = [
        ...movies.results.map(m => ({ ...m, type: 'movie' })),
        ...tv.results.map(t => ({ ...t, type: 'tv' }))
      ].sort(() => Math.random() - 0.5);

      setContentQueue(combined);
      setCurrentContent(combined[0]);
    } catch (err) {
      console.error('Error loading content:', err);
    }
  };

  const handleSwipe = async (liked) => {
    if (!currentContent || !user) return;

    try {
      // Save swipe
      await supabase.from('swipes').insert({
        user_id: user.id,
        content_id: currentContent.id,
        content_type: currentContent.type,
        liked: liked,
        is_match: false
      });

      // Add to my likes if liked
      if (liked) {
        setMyLikes(prev => [...prev, currentContent]);
      }

      // Move to next
      const newQueue = contentQueue.slice(1);
      setContentQueue(newQueue);
      setCurrentContent(newQueue[0] || null);

      if (newQueue.length < 5) {
        loadContent();
      }
    } catch (err) {
      console.error('Error saving swipe:', err);
    }
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Find user by code
      const { data: otherUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('couple_code', compareCode.toUpperCase())
        .single();

      if (findError || !otherUser) {
        setError('Code not found');
        setLoading(false);
        return;
      }

      // Get their likes
      const { data: theirSwipes } = await supabase
        .from('swipes')
        .select('*')
        .eq('user_id', otherUser.id)
        .eq('liked', true);

      if (!theirSwipes) {
        setMatches([]);
        setView('matches');
        setLoading(false);
        return;
      }

      // Find common content
      const mySwipes = await supabase
        .from('swipes')
        .select('*')
        .eq('user_id', user.id)
        .eq('liked', true);

      const commonContent = [];
      
      for (const mySwipe of mySwipes.data || []) {
        const match = theirSwipes.find(
          s => s.content_id === mySwipe.content_id && s.content_type === mySwipe.content_type
        );
        
        if (match) {
          const endpoint = mySwipe.content_type === 'movie' ? 'movie' : 'tv';
          const res = await fetch(
            `https://api.themoviedb.org/3/${endpoint}/${mySwipe.content_id}?api_key=${TMDB_API_KEY}`
          );
          const content = await res.json();
          commonContent.push({ ...content, type: mySwipe.content_type });
        }
      }

      setMatches(commonContent);
      setView('matches');
      setShowCodePopup(false);
    } catch (err) {
      setError(err.message || 'Failed to compare');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView('auth');
    setMyLikes([]);
    setMatches([]);
    setContentQueue([]);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-pink-500 to-red-500 p-4 rounded-full">
                <Heart className="w-12 h-12 text-white" fill="white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">CoupleWatch</h1>
            <p className="text-gray-600">Find what to watch together</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAuthMode('signin')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                authMode === 'signin' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                authMode === 'signup' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Your Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition"
              required
              minLength={6}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'swipe') {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6" fill="white" />
              CoupleWatch
            </h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCodePopup(true)}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                Compare
              </button>
              <button
                onClick={() => setView('mylikes')}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <Flame className="w-5 h-5" />
                {myLikes.length}
              </button>
              <button onClick={handleSignOut} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto p-4 pt-8">
          {currentContent ? (
            <div className="relative">
              <div className="bg-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="relative h-96">
                  <img
                    src={`https://image.tmdb.org/t/p/w500${currentContent.poster_path}`}
                    alt={currentContent.title || currentContent.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4 bg-black/70 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1">
                    {currentContent.type === 'movie' ? (
                      <Film className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <Tv className="w-4 h-4 text-blue-400" />
                    )}
                    <span className="text-white text-sm font-medium">
                      {currentContent.type === 'movie' ? 'Movie' : 'TV Show'}
                    </span>
                  </div>
                  {currentContent.vote_average > 0 && (
                    <div className="absolute top-4 left-4 bg-yellow-500 px-3 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-4 h-4 text-white" fill="white" />
                      <span className="text-white font-bold">{currentContent.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {currentContent.title || currentContent.name}
                  </h2>
                  <p className="text-gray-400 text-sm mb-4">
                    {currentContent.release_date || currentContent.first_air_date
                      ? new Date(currentContent.release_date || currentContent.first_air_date).getFullYear()
                      : ''}
                  </p>
                  <p className="text-gray-300 text-sm line-clamp-3">{currentContent.overview}</p>
                </div>
              </div>

              <div className="flex justify-center gap-8 mt-8">
                <button
                  onClick={() => handleSwipe(false)}
                  className="bg-red-500 hover:bg-red-600 p-6 rounded-full shadow-xl transform hover:scale-110 transition"
                >
                  <X className="w-10 h-10 text-white" strokeWidth={3} />
                </button>
                <button
                  onClick={() => handleSwipe(true)}
                  className="bg-green-500 hover:bg-green-600 p-6 rounded-full shadow-xl transform hover:scale-110 transition"
                >
                  <Heart className="w-10 h-10 text-white" fill="white" strokeWidth={3} />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-white py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading content...</p>
            </div>
          )}
        </div>

        {/* Compare Code Popup */}
        {showCodePopup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Compare Watchlists</h2>
              
              <div className="bg-pink-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">Your Code</p>
                <div className="flex items-center justify-between bg-white rounded-lg p-3">
                  <span className="text-2xl font-bold text-red-500">{myCode}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(myCode)}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <form onSubmit={handleCompare} className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter Their Code"
                  value={compareCode}
                  onChange={(e) => setCompareCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-center text-xl tracking-wider font-semibold"
                  maxLength={6}
                  required
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCodePopup(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-red-500 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Finding...' : 'Find Matches'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'mylikes') {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => setView('swipe')} className="text-white hover:text-gray-200">
              ← Back
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6" />
              My Likes
            </h1>
            <div className="w-16"></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          {myLikes.length === 0 ? (
            <div className="text-center text-white py-20">
              <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-xl text-gray-400">No likes yet</p>
              <p className="text-gray-500 mt-2">Start swiping!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {myLikes.map((item, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
                  <img
                    src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                    alt={item.title || item.name}
                    className="w-full h-64 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-white font-semibold text-sm line-clamp-2">
                      {item.title || item.name}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'matches') {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => setView('swipe')} className="text-white hover:text-gray-200">
              ← Back
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Check className="w-6 h-6" />
              Common Matches
            </h1>
            <div className="w-16"></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          {matches.length === 0 ? (
            <div className="text-center text-white py-20">
              <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-xl text-gray-400">No common matches</p>
              <p className="text-gray-500 mt-2">Keep swiping or try another friend!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {matches.map((match, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="relative">
                    <img
                      src={`https://image.tmdb.org/t/p/w500${match.poster_path}`}
                      alt={match.title || match.name}
                      className="w-full h-64 object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 p-2 rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-semibold text-sm line-clamp-2">
                      {match.title || match.name}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
