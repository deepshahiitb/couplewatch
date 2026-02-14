import React, { useState, useEffect } from 'react';
import { Heart, X, Film, Tv, Users, LogOut, Star, Flame, Check } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const TMDB_API_KEY = '76dbff05004b7238127fe74ab6be5e2f';
const SUPABASE_URL = 'https://ebjgjuniziowsiwxzabl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViamdqdW5pemlvd3Npd3h6YWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDkxMTcsImV4cCI6MjA4NjU4NTExN30.sZsnwP6ItG6YTAO910_eZDP76JptxqcJP_X6c6dXMZw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function CoupleWatch() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); // auth, setup, swipe, matches
  const [authMode, setAuthMode] = useState('signin'); // signin, signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [myCode, setMyCode] = useState('');
  const [coupled, setCoupled] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [contentQueue, setContentQueue] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        checkCoupleStatus(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        checkCoupleStatus(session.user.id);
      } else {
        setUser(null);
        setView('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (coupled && contentQueue.length === 0) {
      loadContent();
    }
  }, [coupled, contentQueue]);

  const checkCoupleStatus = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // User record doesn't exist, create it
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: user?.email,
            display_name: displayName || 'User',
            couple_code: code
          });
        
        if (!insertError) {
          setMyCode(code);
          setView('setup');
        }
      } else if (data) {
        setMyCode(data.couple_code);
        
        if (data.partner_id) {
          setPartnerId(data.partner_id);
          setCoupled(true);
          setView('swipe');
          loadMatches(userId, data.partner_id);
        } else {
          setView('setup');
        }
      }
    } catch (err) {
      console.error('Error checking couple status:', err);
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
          options: {
            data: {
              display_name: displayName
            }
          }
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          email,
          password
        });
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

  const handleCoupleLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Find partner by code
      const { data: partnerData, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('couple_code', partnerCode.toUpperCase())
        .single();

      if (findError || !partnerData) {
        setError('Partner code not found');
        setLoading(false);
        return;
      }

      // Update both users
      await supabase
        .from('users')
        .update({ partner_id: partnerData.id })
        .eq('id', user.id);
      
      await supabase
        .from('users')
        .update({ partner_id: user.id })
        .eq('id', partnerData.id);

      setPartnerId(partnerData.id);
      setCoupled(true);
      setView('swipe');
    } catch (err) {
      setError(err.message || 'Failed to link with partner');
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

  const loadMatches = async (userId, pId) => {
    try {
      const { data } = await supabase
        .from('swipes')
        .select('*')
        .eq('user_id', userId)
        .eq('is_match', true);

      if (data) {
        const matchedContent = await Promise.all(
          data.map(async (swipe) => {
            const endpoint = swipe.content_type === 'movie' ? 'movie' : 'tv';
            const res = await fetch(
              `https://api.themoviedb.org/3/${endpoint}/${swipe.content_id}?api_key=${TMDB_API_KEY}`
            );
            const content = await res.json();
            return { ...content, type: swipe.content_type };
          })
        );
        setMatches(matchedContent);
      }
    } catch (err) {
      console.error('Error loading matches:', err);
    }
  };

  const handleSwipe = async (liked) => {
    if (!currentContent || !user || !partnerId) return;

    const swipeData = {
      user_id: user.id,
      content_id: currentContent.id,
      content_type: currentContent.type,
      liked: liked,
      is_match: false
    };

    try {
      // Save swipe
      await supabase.from('swipes').insert(swipeData);

      // Check if partner swiped right on same content
      if (liked) {
        const { data: partnerSwipe } = await supabase
          .from('swipes')
          .select('*')
          .eq('user_id', partnerId)
          .eq('content_id', currentContent.id)
          .eq('content_type', currentContent.type)
          .eq('liked', true);

        if (partnerSwipe && partnerSwipe.length > 0) {
          // It's a match!
          await supabase
            .from('swipes')
            .update({ is_match: true })
            .eq('user_id', user.id)
            .eq('content_id', currentContent.id);

          await supabase
            .from('swipes')
            .update({ is_match: true })
            .eq('user_id', partnerId)
            .eq('content_id', currentContent.id);

          setMatches(prev => [...prev, currentContent]);
          
          setTimeout(() => {
            alert(`🎉 It's a match! You both want to watch ${currentContent.title || currentContent.name}!`);
          }, 300);
        }
      }

      // Move to next content
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView('auth');
    setCoupled(false);
    setPartnerId(null);
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
                authMode === 'signin'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                authMode === 'signup'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600'
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

  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Users className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Link with Your Partner</h2>
            <p className="text-gray-600">Share your code or enter theirs</p>
          </div>

          <div className="bg-gradient-to-r from-pink-100 to-red-100 rounded-xl p-6 mb-6">
            <p className="text-sm text-gray-600 mb-2">Your Couple Code</p>
            <div className="flex items-center justify-between bg-white rounded-lg p-4">
              <span className="text-3xl font-bold text-red-500 tracking-wider">{myCode}</span>
              <button
                onClick={() => navigator.clipboard.writeText(myCode)}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">OR</span>
            </div>
          </div>

          <form onSubmit={handleCoupleLink} className="space-y-4">
            <input
              type="text"
              placeholder="Enter Partner's Code"
              value={partnerCode}
              onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition text-center text-2xl tracking-wider font-semibold"
              maxLength={6}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Link Together'}
            </button>
          </form>

          <button
            onClick={handleSignOut}
            className="w-full mt-4 text-gray-500 text-sm hover:text-gray-700 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (view === 'swipe') {
    return (
      <div className="min-h-screen bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6" fill="white" />
              CoupleWatch
            </h1>
            <div className="flex gap-3">
              <button
                onClick={() => setView('matches')}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <Flame className="w-5 h-5" />
                {matches.length}
              </button>
              <button
                onClick={handleSignOut}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Swipe Area */}
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
                  <p className="text-gray-300 text-sm line-clamp-3">
                    {currentContent.overview}
                  </p>
                </div>
              </div>

              {/* Swipe Buttons */}
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
      </div>
    );
  }

  if (view === 'matches') {
    return (
      <div className="min-h-screen bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setView('swipe')}
              className="text-white hover:text-gray-200"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6" />
              Your Matches
            </h1>
            <div className="w-16"></div>
          </div>
        </div>

        {/* Matches Grid */}
        <div className="max-w-4xl mx-auto p-4">
          {matches.length === 0 ? (
            <div className="text-center text-white py-20">
              <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-xl text-gray-400">No matches yet</p>
              <p className="text-gray-500 mt-2">Keep swiping to find what you both love!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {matches.map((match, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transform hover:scale-105 transition">
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
                    <p className="text-gray-400 text-xs mt-1">
                      {match.release_date || match.first_air_date
                        ? new Date(match.release_date || match.first_air_date).getFullYear()
                        : ''}
                    </p>
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
