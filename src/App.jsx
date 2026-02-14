import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Film, Tv, Users, LogOut, Star, Flame, Check, Search, Filter, Menu, ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const TMDB_API_KEY = '76dbff05004b7238127fe74ab6be5e2f';
const SUPABASE_URL = 'https://ebjgjuniziowsiwxzabl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViamdqdW5pemlvd3Npd3h6YWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDkxMTcsImV4cCI6MjA4NjU4NTExN30.sZsnwP6ItG6YTAO910_eZDP76JptxqcJP_X6c6dXMZw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GENRES = {
  movie: [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Sci-Fi' },
    { id: 10770, name: 'TV Movie' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' }
  ],
  tv: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 10762, name: 'Kids' },
    { id: 9648, name: 'Mystery' },
    { id: 10763, name: 'News' },
    { id: 10764, name: 'Reality' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10766, name: 'Soap' },
    { id: 10767, name: 'Talk' },
    { id: 10768, name: 'War & Politics' },
    { id: 37, name: 'Western' }
  ]
};

export default function CoupleWatch() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth');
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
  const [showFilters, setShowFilters] = useState(false);
  
  // Swipe state
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);

  // Filter state
  const [filters, setFilters] = useState({
    contentTypes: ['movie', 'tv'],
    genres: [],
    sortBy: 'popular',
    minRating: 0,
    releasePeriod: 'all'
  });

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
    if (user && view === 'swipe') {
      loadContent();
    }
  }, [user, view, filters]);

  const initializeUser = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') {
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
            try {
              const endpoint = swipe.content_type === 'movie' ? 'movie' : 'tv';
              const res = await fetch(
                `https://api.themoviedb.org/3/${endpoint}/${swipe.content_id}?api_key=${TMDB_API_KEY}`
              );
              const content = await res.json();
              return { ...content, type: swipe.content_type };
            } catch {
              return null;
            }
          })
        );
        setMyLikes(likedContent.filter(Boolean));
      }
    } catch (err) {
      console.error('Error loading likes:', err);
    }
  };

  const buildTMDBUrl = () => {
    const { contentTypes, genres, sortBy, minRating, releasePeriod } = filters;
    
    // Determine which content type to fetch (alternate if both selected)
    const contentType = contentTypes.length === 1 
      ? contentTypes[0] 
      : contentTypes[Math.floor(Math.random() * contentTypes.length)];
    
    const isMovie = contentType === 'movie';
    let endpoint = isMovie ? 'discover/movie' : 'discover/tv';
    
    let params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: 'en-US',
      page: Math.floor(Math.random() * 3) + 1,
      'vote_count.gte': 100
    });

    // Sort by
    if (sortBy === 'popular') {
      params.append('sort_by', 'popularity.desc');
    } else if (sortBy === 'top_rated') {
      params.append('sort_by', 'vote_average.desc');
      params.append('vote_count.gte', 500);
    } else if (sortBy === 'newest') {
      params.append('sort_by', isMovie ? 'release_date.desc' : 'first_air_date.desc');
    }

    // Genres
    if (genres.length > 0) {
      params.append('with_genres', genres.join(','));
    }

    // Min rating
    if (minRating > 0) {
      params.append('vote_average.gte', minRating);
    }

    // Release period
    const currentYear = new Date().getFullYear();
    if (releasePeriod === 'last_year') {
      params.append(isMovie ? 'primary_release_year' : 'first_air_date_year', currentYear - 1);
    } else if (releasePeriod === 'last_5_years') {
      params.append(isMovie ? 'primary_release_date.gte' : 'first_air_date.gte', `${currentYear - 5}-01-01`);
    } else if (releasePeriod === '90s') {
      params.append(isMovie ? 'primary_release_date.gte' : 'first_air_date.gte', '1990-01-01');
      params.append(isMovie ? 'primary_release_date.lte' : 'first_air_date.lte', '1999-12-31');
    }

    return `https://api.themoviedb.org/3/${endpoint}?${params.toString()}`;
  };

  const loadContent = async () => {
    try {
      // Get already swiped content IDs
      const { data: swipedData } = await supabase
        .from('swipes')
        .select('content_id, content_type')
        .eq('user_id', user.id);

      const swipedIds = new Set(
        (swipedData || []).map(s => `${s.content_type}-${s.content_id}`)
      );

      // Fetch multiple pages to get enough unswipped content
      let allResults = [];
      for (let i = 0; i < 3; i++) {
        const url = buildTMDBUrl();
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.results) {
          const typed = data.results.map(item => ({
            ...item,
            type: url.includes('discover/movie') ? 'movie' : 'tv'
          }));
          allResults = [...allResults, ...typed];
        }
      }

      // Filter out already swiped content
      const unseenContent = allResults.filter(
        item => !swipedIds.has(`${item.type}-${item.id}`)
      );

      // Sort by popularity to show best first
      unseenContent.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      setContentQueue(unseenContent);
      setCurrentContent(unseenContent[0] || null);
    } catch (err) {
      console.error('Error loading content:', err);
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

  const handleSwipe = async (liked) => {
    if (!currentContent || !user) return;

    try {
      await supabase.from('swipes').insert({
        user_id: user.id,
        content_id: currentContent.id,
        content_type: currentContent.type,
        liked: liked,
        is_match: false
      });

      if (liked) {
        setMyLikes(prev => [...prev, currentContent]);
      }

      const newQueue = contentQueue.slice(1);
      setContentQueue(newQueue);
      setCurrentContent(newQueue[0] || null);

      if (newQueue.length < 10) {
        loadContent();
      }
    } catch (err) {
      console.error('Error saving swipe:', err);
    }
  };

  // Swipe gesture handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const offsetX = touch.clientX - dragStart.x;
    const offsetY = touch.clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const swipeThreshold = 100;
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      handleSwipe(dragOffset.x > 0);
    }
    
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleMouseDown = (e) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const offsetX = e.clientX - dragStart.x;
    const offsetY = e.clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    const swipeThreshold = 100;
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      handleSwipe(dragOffset.x > 0);
    }
    
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
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

      const { data: theirSwipes } = await supabase
        .from('swipes')
        .select('*')
        .eq('user_id', otherUser.id)
        .eq('liked', true);

      const mySwipes = await supabase
        .from('swipes')
        .select('*')
        .eq('user_id', user.id)
        .eq('liked', true);

      const commonContent = [];
      
      for (const mySwipe of mySwipes.data || []) {
        const match = (theirSwipes || []).find(
          s => s.content_id === mySwipe.content_id && s.content_type === mySwipe.content_type
        );
        
        if (match) {
          try {
            const endpoint = mySwipe.content_type === 'movie' ? 'movie' : 'tv';
            const res = await fetch(
              `https://api.themoviedb.org/3/${endpoint}/${mySwipe.content_id}?api_key=${TMDB_API_KEY}`
            );
            const content = await res.json();
            commonContent.push({ ...content, type: mySwipe.content_type });
          } catch (err) {
            console.error('Error fetching content:', err);
          }
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

  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      if (filterType === 'contentTypes') {
        const newTypes = prev.contentTypes.includes(value)
          ? prev.contentTypes.filter(t => t !== value)
          : [...prev.contentTypes, value];
        return { ...prev, contentTypes: newTypes.length > 0 ? newTypes : prev.contentTypes };
      } else if (filterType === 'genres') {
        const newGenres = prev.genres.includes(value)
          ? prev.genres.filter(g => g !== value)
          : [...prev.genres, value];
        return { ...prev, genres: newGenres };
      }
      return prev;
    });
  };

  const getCardRotation = () => {
    if (!isDragging) return 0;
    return (dragOffset.x / 20);
  };

  const getCardOpacity = () => {
    if (!isDragging) return 1;
    const opacity = 1 - Math.abs(dragOffset.x) / 300;
    return Math.max(opacity, 0.5);
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
    const allGenres = filters.contentTypes.includes('movie') && filters.contentTypes.includes('tv')
      ? [...new Map([...GENRES.movie, ...GENRES.tv].map(g => [g.id, g])).values()]
      : filters.contentTypes.includes('movie')
      ? GENRES.movie
      : GENRES.tv;

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg flex-shrink-0">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden bg-white/20 hover:bg-white/30 p-2 rounded-lg transition"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
                <Heart className="w-5 h-5 lg:w-6 lg:h-6" fill="white" />
                CoupleWatch
              </h1>
            </div>
            <div className="flex gap-2 lg:gap-3">
              <button
                onClick={() => setShowCodePopup(true)}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm lg:text-base"
              >
                <Search className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">Compare</span>
              </button>
              <button
                onClick={() => setView('mylikes')}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm lg:text-base"
              >
                <Flame className="w-4 h-4 lg:w-5 lg:h-5" />
                {myLikes.length}
              </button>
              <button onClick={handleSignOut} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition">
                <LogOut className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Desktop */}
          <div className="hidden lg:block w-64 bg-gray-800 p-4 overflow-y-auto flex-shrink-0">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </h2>
            
            {/* Content Type */}
            <div className="mb-6">
              <h3 className="text-gray-300 font-semibold mb-2 text-sm">Content Type</h3>
              <label className="flex items-center gap-2 text-white mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.contentTypes.includes('movie')}
                  onChange={() => toggleFilter('contentTypes', 'movie')}
                  className="w-4 h-4 accent-pink-500"
                />
                <Film className="w-4 h-4" />
                Movies
              </label>
              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.contentTypes.includes('tv')}
                  onChange={() => toggleFilter('contentTypes', 'tv')}
                  className="w-4 h-4 accent-pink-500"
                />
                <Tv className="w-4 h-4" />
                TV Shows
              </label>
            </div>

            {/* Sort By */}
            <div className="mb-6">
              <h3 className="text-gray-300 font-semibold mb-2 text-sm">Sort By</h3>
              {['popular', 'top_rated', 'newest'].map(sort => (
                <label key={sort} className="flex items-center gap-2 text-white mb-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sortBy"
                    checked={filters.sortBy === sort}
                    onChange={() => setFilters(prev => ({ ...prev, sortBy: sort }))}
                    className="w-4 h-4 accent-pink-500"
                  />
                  {sort === 'popular' && 'Most Popular'}
                  {sort === 'top_rated' && 'Top Rated'}
                  {sort === 'newest' && 'Newest'}
                </label>
              ))}
            </div>

            {/* Min Rating */}
            <div className="mb-6">
              <h3 className="text-gray-300 font-semibold mb-2 text-sm">
                Min Rating: {filters.minRating}+
              </h3>
              <input
                type="range"
                min="0"
                max="9"
                step="1"
                value={filters.minRating}
                onChange={(e) => setFilters(prev => ({ ...prev, minRating: parseInt(e.target.value) }))}
                className="w-full accent-pink-500"
              />
            </div>

            {/* Release Period */}
            <div className="mb-6">
              <h3 className="text-gray-300 font-semibold mb-2 text-sm">Release Period</h3>
              {['all', 'last_year', 'last_5_years', '90s'].map(period => (
                <label key={period} className="flex items-center gap-2 text-white mb-2 cursor-pointer">
                  <input
                    type="radio"
                    name="releasePeriod"
                    checked={filters.releasePeriod === period}
                    onChange={() => setFilters(prev => ({ ...prev, releasePeriod: period }))}
                    className="w-4 h-4 accent-pink-500"
                  />
                  {period === 'all' && 'All Time'}
                  {period === 'last_year' && 'Last Year'}
                  {period === 'last_5_years' && 'Last 5 Years'}
                  {period === '90s' && '90s Classics'}
                </label>
              ))}
            </div>

            {/* Genres */}
            <div className="mb-6">
              <h3 className="text-gray-300 font-semibold mb-2 text-sm">Genres</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allGenres.map(genre => (
                  <label key={genre.id} className="flex items-center gap-2 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.genres.includes(genre.id)}
                      onChange={() => toggleFilter('genres', genre.id)}
                      className="w-4 h-4 accent-pink-500"
                    />
                    <span className="text-sm">{genre.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Sidebar */}
          {showFilters && (
            <div className="lg:hidden fixed inset-0 bg-black/70 z-50" onClick={() => setShowFilters(false)}>
              <div className="bg-gray-800 w-80 h-full p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filters
                  </h2>
                  <button onClick={() => setShowFilters(false)} className="text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Same filters as desktop */}
                <div className="mb-6">
                  <h3 className="text-gray-300 font-semibold mb-2 text-sm">Content Type</h3>
                  <label className="flex items-center gap-2 text-white mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.contentTypes.includes('movie')}
                      onChange={() => toggleFilter('contentTypes', 'movie')}
                      className="w-4 h-4 accent-pink-500"
                    />
                    <Film className="w-4 h-4" />
                    Movies
                  </label>
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.contentTypes.includes('tv')}
                      onChange={() => toggleFilter('contentTypes', 'tv')}
                      className="w-4 h-4 accent-pink-500"
                    />
                    <Tv className="w-4 h-4" />
                    TV Shows
                  </label>
                </div>

                <div className="mb-6">
                  <h3 className="text-gray-300 font-semibold mb-2 text-sm">Sort By</h3>
                  {['popular', 'top_rated', 'newest'].map(sort => (
                    <label key={sort} className="flex items-center gap-2 text-white mb-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sortBy"
                        checked={filters.sortBy === sort}
                        onChange={() => setFilters(prev => ({ ...prev, sortBy: sort }))}
                        className="w-4 h-4 accent-pink-500"
                      />
                      {sort === 'popular' && 'Most Popular'}
                      {sort === 'top_rated' && 'Top Rated'}
                      {sort === 'newest' && 'Newest'}
                    </label>
                  ))}
                </div>

                <div className="mb-6">
                  <h3 className="text-gray-300 font-semibold mb-2 text-sm">
                    Min Rating: {filters.minRating}+
                  </h3>
                  <input
                    type="range"
                    min="0"
                    max="9"
                    step="1"
                    value={filters.minRating}
                    onChange={(e) => setFilters(prev => ({ ...prev, minRating: parseInt(e.target.value) }))}
                    className="w-full accent-pink-500"
                  />
                </div>

                <div className="mb-6">
                  <h3 className="text-gray-300 font-semibold mb-2 text-sm">Release Period</h3>
                  {['all', 'last_year', 'last_5_years', '90s'].map(period => (
                    <label key={period} className="flex items-center gap-2 text-white mb-2 cursor-pointer">
                      <input
                        type="radio"
                        name="releasePeriod"
                        checked={filters.releasePeriod === period}
                        onChange={() => setFilters(prev => ({ ...prev, releasePeriod: period }))}
                        className="w-4 h-4 accent-pink-500"
                      />
                      {period === 'all' && 'All Time'}
                      {period === 'last_year' && 'Last Year'}
                      {period === 'last_5_years' && 'Last 5 Years'}
                      {period === '90s' && '90s Classics'}
                    </label>
                  ))}
                </div>

                <div className="mb-6">
                  <h3 className="text-gray-300 font-semibold mb-2 text-sm">Genres</h3>
                  <div className="space-y-2">
                    {allGenres.map(genre => (
                      <label key={genre.id} className="flex items-center gap-2 text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.genres.includes(genre.id)}
                          onChange={() => toggleFilter('genres', genre.id)}
                          className="w-4 h-4 accent-pink-500"
                        />
                        <span className="text-sm">{genre.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {currentContent ? (
              <div 
                ref={cardRef}
                className="w-full max-w-sm mx-auto"
                style={{
                  transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${getCardRotation()}deg)`,
                  opacity: getCardOpacity(),
                  transition: isDragging ? 'none' : 'transform 0.3s, opacity 0.3s',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  touchAction: 'none'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="relative" style={{ aspectRatio: '2/3' }}>
                    <img
                      src={`https://image.tmdb.org/t/p/w500${currentContent.poster_path}`}
                      alt={currentContent.title || currentContent.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
                      {currentContent.type === 'movie' ? (
                        <Film className="w-3 h-3 text-yellow-400" />
                      ) : (
                        <Tv className="w-3 h-3 text-blue-400" />
                      )}
                      <span className="text-white text-xs font-medium">
                        {currentContent.type === 'movie' ? 'Movie' : 'TV'}
                      </span>
                    </div>
                    {currentContent.vote_average > 0 && (
                      <div className="absolute top-3 left-3 bg-yellow-500 px-2 py-1 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 text-white" fill="white" />
                        <span className="text-white font-bold text-xs">{currentContent.vote_average.toFixed(1)}</span>
                      </div>
                    )}
                    
                    {/* Swipe Indicators */}
                    {isDragging && (
                      <>
                        {dragOffset.x > 50 && (
                          <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                            <div className="bg-green-500 text-white px-6 py-3 rounded-full font-bold text-2xl transform rotate-12">
                              LIKE
                            </div>
                          </div>
                        )}
                        {dragOffset.x < -50 && (
                          <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                            <div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold text-2xl transform -rotate-12">
                              NOPE
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="p-4">
                    <h2 className="text-lg font-bold text-white mb-1 line-clamp-2">
                      {currentContent.title || currentContent.name}
                    </h2>
                    <p className="text-gray-400 text-xs mb-2">
                      {currentContent.release_date || currentContent.first_air_date
                        ? new Date(currentContent.release_date || currentContent.first_air_date).getFullYear()
                        : ''}
                    </p>
                    <p className="text-gray-300 text-xs line-clamp-2">{currentContent.overview}</p>
                  </div>
                </div>

                <div className="flex justify-center gap-6 mt-6">
                  <button
                    onClick={() => handleSwipe(false)}
                    className="bg-red-500 hover:bg-red-600 p-5 rounded-full shadow-xl transform hover:scale-110 transition active:scale-95"
                  >
                    <X className="w-8 h-8 text-white" strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => handleSwipe(true)}
                    className="bg-green-500 hover:bg-green-600 p-5 rounded-full shadow-xl transform hover:scale-110 transition active:scale-95"
                  >
                    <Heart className="w-8 h-8 text-white" fill="white" strokeWidth={3} />
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

        {/* Compare Popup */}
        {showCodePopup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowCodePopup(false)}>
            <div className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {myLikes.map((item, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transform hover:scale-105 transition">
                  <img
                    src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                    alt={item.title || item.name}
                    className="w-full aspect-[2/3] object-cover"
                  />
                  <div className="p-3">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {matches.map((match, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transform hover:scale-105 transition">
                  <div className="relative">
                    <img
                      src={`https://image.tmdb.org/t/p/w500${match.poster_path}`}
                      alt={match.title || match.name}
                      className="w-full aspect-[2/3] object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 p-2 rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="p-3">
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
