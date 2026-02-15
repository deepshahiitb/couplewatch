import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Film, Tv, Users, Power, Star, Bookmark, Check, Search, Filter, ChevronRight } from 'lucide-react';
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
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCodePopup, setShowCodePopup] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Swipe state
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState(0);
  const [cast, setCast] = useState([]);
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

  useEffect(() => {
    if (currentContent) {
      loadCast();
    }
  }, [currentContent]);

  useEffect(() => {
    // Reload friends list when friends view is opened
    if (user && view === 'friends') {
      loadFriends(user.id);
    }
  }, [user, view]);

  const loadCast = async () => {
    if (!currentContent) return;
    try {
      const endpoint = currentContent.type === 'movie' ? 'movie' : 'tv';
      const res = await fetch(
        `https://api.themoviedb.org/3/${endpoint}/${currentContent.id}/credits?api_key=${TMDB_API_KEY}`
      );
      const data = await res.json();
      setCast((data.cast || []).slice(0, 4)); // Top 4 cast members
    } catch (err) {
      console.error('Error loading cast:', err);
      setCast([]);
    }
  };

  const initializeUser = async (userId) => {
    console.log('=== INITIALIZE USER DEBUG ===');
    console.log('1. User ID:', userId);
    
    try {
      // Get current session to access user metadata
      const { data: { session } } = await supabase.auth.getSession();
      console.log('2. Session:', session);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      console.log('3. Existing user lookup result:', { data, error });
      
      if (error && error.code === 'PGRST116') {
        // User doesn't exist, create them
        console.log('4. User not found, creating new user...');
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const userEmail = session?.user?.email || '';
        const userName = session?.user?.user_metadata?.display_name || 'User';
        
        console.log('5. New user details:', { code, userEmail, userName });
        
        const { data: newUser, error: insertError } = await supabase.from('users').insert({
          id: userId,
          email: userEmail,
          display_name: userName,
          couple_code: code
        }).select().single();
        
        console.log('6. Insert result:', { newUser, insertError });
        
        if (insertError) {
          console.error('7. Insert error:', insertError);
          setMyCode(code);
        } else if (newUser) {
          console.log('8. User created successfully! Code:', newUser.couple_code);
          setMyCode(newUser.couple_code);
        } else {
          console.log('9. No newUser returned, using generated code');
          setMyCode(code);
        }
      } else if (data) {
        console.log('10. Existing user found, code:', data.couple_code);
        setMyCode(data.couple_code);
        
        // If display_name is still "User" but we have actual name in metadata, update it
        const userEmail = session?.user?.email || '';
        const userName = session?.user?.user_metadata?.display_name || 'User';
        
        if (data.display_name === 'User' && userName !== 'User') {
          console.log('11. Updating display_name from "User" to:', userName);
          await supabase.from('users').update({
            display_name: userName,
            email: userEmail
          }).eq('id', userId);
        }
      }
      
      await loadMyLikes(userId);
      await loadFriends(userId);
      setView('swipe');
    } catch (err) {
      console.error('ERROR in initializeUser:', err);
    }
  };

  const loadFriends = async (userId) => {
    try {
      const { data } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);

      if (data && data.length > 0) {
        // Get friend details
        const friendIds = data.map(f => f.friend_id);
        const { data: friendsData } = await supabase
          .from('users')
          .select('id, display_name, couple_code')
          .in('id', friendIds);

        setFriends(friendsData || []);
      }
    } catch (err) {
      console.error('Error loading friends:', err);
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
      page: Math.floor(Math.random() * 3) + 1
    });

    // Min vote count (ensures quality)
    if (sortBy === 'top_rated') {
      params.append('vote_count.gte', 500);
    } else {
      params.append('vote_count.gte', 100);
    }

    // Sort by
    if (sortBy === 'popular') {
      params.append('sort_by', 'popularity.desc');
    } else if (sortBy === 'top_rated') {
      params.append('sort_by', 'vote_average.desc');
    } else if (sortBy === 'newest') {
      params.append('sort_by', isMovie ? 'release_date.desc' : 'first_air_date.desc');
    }

    // Genres
    if (genres.length > 0) {
      params.append('with_genres', genres.join(','));
    }

    // Min rating - CRITICAL FIX
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

      // Fetch just ONE page first for immediate display
      const firstUrl = buildTMDBUrl();
      const firstRes = await fetch(firstUrl);
      const firstData = await firstRes.json();
      
      if (firstData.results && firstData.results.length > 0) {
        const typed = firstData.results.map(item => ({
          ...item,
          type: firstUrl.includes('discover/movie') ? 'movie' : 'tv'
        }));

        // Filter out already swiped AND apply min rating client-side
        let unseenContent = typed.filter(
          item => !swipedIds.has(`${item.type}-${item.id}`)
        );

        // CRITICAL: Client-side rating filter as backup
        if (filters.minRating > 0) {
          unseenContent = unseenContent.filter(
            item => (item.vote_average || 0) >= filters.minRating
          );
        }

        // Sort by popularity
        unseenContent.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        // Show first card IMMEDIATELY
        if (unseenContent.length > 0) {
          setContentQueue(unseenContent);
          setCurrentContent(unseenContent[0]);
        }
      }

      // Load more in background (non-blocking)
      setTimeout(() => {
        loadMoreContent(swipedIds);
      }, 100);

    } catch (err) {
      console.error('Error loading content:', err);
    }
  };

  const loadMoreContent = async (swipedIds) => {
    try {
      // Fetch 2 more pages in background
      let allResults = [];
      for (let i = 0; i < 2; i++) {
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

      // Filter out already swiped
      let unseenContent = allResults.filter(
        item => !swipedIds.has(`${item.type}-${item.id}`)
      );

      // CRITICAL: Client-side rating filter
      if (filters.minRating > 0) {
        unseenContent = unseenContent.filter(
          item => (item.vote_average || 0) >= filters.minRating
        );
      }

      // Sort by popularity
      unseenContent.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // Append to existing queue (don't replace!)
      setContentQueue(prev => {
        const existing = new Set(prev.map(p => `${p.type}-${p.id}`));
        const newItems = unseenContent.filter(
          item => !existing.has(`${item.type}-${item.id}`)
        );
        return [...prev, ...newItems];
      });

    } catch (err) {
      console.error('Error loading more content:', err);
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
    if (!currentContent || !user || isExiting) return;

    // Trigger exit animation
    setIsExiting(true);
    setExitDirection(liked ? 1 : -1);

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

      // Wait for animation to complete before switching cards
      setTimeout(() => {
        const newQueue = contentQueue.slice(1);
        setContentQueue(newQueue);
        setCurrentContent(newQueue[0] || null);
        setIsExiting(false);
        setExitDirection(0);
        setDragOffset({ x: 0, y: 0 });

        // Preload more content when queue gets low (5 cards left)
        if (newQueue.length < 5) {
          supabase
            .from('swipes')
            .select('content_id, content_type')
            .eq('user_id', user.id)
            .then(({ data: swipedData }) => {
              const swipedIds = new Set(
                (swipedData || []).map(s => `${s.content_type}-${s.content_id}`)
              );
              loadMoreContent(swipedIds);
            });
        }
      }, 300); // Match this to CSS transition duration

    } catch (err) {
      console.error('Error saving swipe:', err);
      setIsExiting(false);
      setExitDirection(0);
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
    if (!isDragging || isExiting) return;
    
    const swipeThreshold = 100;
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      handleSwipe(dragOffset.x > 0);
    } else {
      // Only reset if not swiping
      setDragOffset({ x: 0, y: 0 });
    }
    
    setIsDragging(false);
  };

  const handleMouseDown = (e) => {
    if (isExiting) return;
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || isExiting) return;
    const offsetX = e.clientX - dragStart.x;
    const offsetY = e.clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleMouseUp = () => {
    if (!isDragging || isExiting) return;
    
    const swipeThreshold = 100;
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      handleSwipe(dragOffset.x > 0);
    } else {
      // Only reset if not swiping
      setDragOffset({ x: 0, y: 0 });
    }
    
    setIsDragging(false);
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('=== ADD FRIEND DEBUG ===');
    console.log('1. Starting handleAddFriend');
    console.log('2. Compare code entered:', compareCode);
    console.log('3. Current user:', user);
    console.log('4. User ID:', user?.id);

    try {
      console.log('5. Searching for user with code:', compareCode.toUpperCase());
      
      // Don't use .single() - it fails if no results or multiple results
      const { data: users, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('couple_code', compareCode.toUpperCase());

      console.log('6. Search result:', { users, findError });

      if (findError) {
        console.error('7. Find error occurred:', findError);
        setError(`Database error: ${findError.message}`);
        setLoading(false);
        return;
      }

      if (!users || users.length === 0) {
        console.error('8. No user found with code:', compareCode.toUpperCase());
        setError('Code not found - please check the code and try again');
        setLoading(false);
        return;
      }

      if (users.length > 1) {
        console.error('9. Multiple users found with code (should not happen):', users);
        setError('Multiple users found with this code - please contact support');
        setLoading(false);
        return;
      }

      const otherUser = users[0];
      console.log('10. Found user:', otherUser);

      // Check if trying to add yourself
      if (otherUser.id === user.id) {
        console.error('11. Cannot add yourself as friend');
        setError('You cannot add yourself as a friend!');
        setLoading(false);
        return;
      }

      // Check if already friends
      console.log('12. Checking if already friends...');
      const { data: existingFriends } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user.id)
        .eq('friend_id', otherUser.id);

      console.log('13. Existing friendship:', existingFriends);

      if (!existingFriends || existingFriends.length === 0) {
        console.log('14. Adding new friend relationship (both directions)...');
        
        // Add friendship in BOTH directions for mutual relationship
        const { error: insertError1 } = await supabase.from('friends').insert({
          user_id: user.id,
          friend_id: otherUser.id
        });

        const { error: insertError2 } = await supabase.from('friends').insert({
          user_id: otherUser.id,
          friend_id: user.id
        });

        if (insertError1 || insertError2) {
          console.error('15. Insert error:', insertError1 || insertError2);
          setError(`Failed to add friend: ${(insertError1 || insertError2).message}`);
          setLoading(false);
          return;
        } else {
          console.log('16. Friend added successfully (mutual friendship created)!');
        }

        // Reload friends list
        console.log('17. Reloading friends list...');
        await loadFriends(user.id);
        console.log('18. Friends list reloaded');
      } else {
        console.log('14. Already friends!');
      }

      // Now show matches with this friend
      console.log('19. Showing matches with friend...');
      await showMatchesWithFriend(otherUser);
      setShowCodePopup(false);
      setCompareCode('');
      console.log('20. Done!');

    } catch (err) {
      console.error('ERROR in handleAddFriend:', err);
      setError(err.message || 'Failed to add friend');
    } finally {
      setLoading(false);
    }
  };

  const showMatchesWithFriend = async (friend) => {
    setLoading(true);
    setSelectedFriend(friend);

    try {
      const { data: theirSwipes } = await supabase
        .from('swipes')
        .select('*')
        .eq('user_id', friend.id)
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
    } catch (err) {
      console.error('Error loading matches:', err);
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
                <Filter className="w-5 h-5" />
              </button>
              <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
                <Heart className="w-5 h-5 lg:w-6 lg:h-6" fill="white" />
                CoupleWatch
              </h1>
            </div>
            <div className="flex gap-2 lg:gap-3">
              <button
                onClick={() => setView('friends')}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm lg:text-base"
              >
                <Users className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">Friends ({friends.length})</span>
              </button>
              <button
                onClick={() => setView('mylikes')}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm lg:text-base"
              >
                <Bookmark className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">Likes ({myLikes.length})</span>
              </button>
              <button onClick={handleSignOut} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition">
                <Power className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Desktop */}
          <div className="hidden lg:block w-64 bg-gray-800 p-4 overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </h2>
              <button
                onClick={() => setFilters({
                  contentTypes: ['movie', 'tv'],
                  genres: [],
                  sortBy: 'popular',
                  minRating: 0,
                  releasePeriod: 'all'
                })}
                className="text-xs text-pink-400 hover:text-pink-300 underline"
              >
                Clear All
              </button>
            </div>
            
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
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filters
                  </h2>
                  <button onClick={() => setShowFilters(false)} className="text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setFilters({
                      contentTypes: ['movie', 'tv'],
                      genres: [],
                      sortBy: 'popular',
                      minRating: 0,
                      releasePeriod: 'all'
                    });
                  }}
                  className="text-sm text-pink-400 hover:text-pink-300 underline mb-4 w-full text-left"
                >
                  Clear All Filters
                </button>

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
          <div className="flex-1 flex flex-col items-center overflow-hidden">
            {currentContent ? (
              <div className="w-full max-w-sm flex flex-col h-full py-2">
                <div 
                  ref={cardRef}
                  className="flex-shrink-0"
                  style={{
                    transform: isExiting 
                      ? `translateX(${exitDirection * 1000}px) translateY(${dragOffset.y}px) rotate(${exitDirection * 30}deg)`
                      : `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${getCardRotation()}deg)`,
                    opacity: isExiting ? 0 : getCardOpacity(),
                    transition: isExiting ? 'transform 0.3s ease-in, opacity 0.3s ease-in' : (isDragging ? 'none' : 'transform 0.3s, opacity 0.3s'),
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
                    {/* Poster - 65% of available height for bigger poster */}
                    <div className="relative" style={{ height: 'calc((100vh - 140px) * 0.65)' }}>
                      <img
                        src={`https://image.tmdb.org/t/p/w500${currentContent.poster_path}`}
                        alt={currentContent.title || currentContent.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
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
                        <div className="absolute top-2 left-2 bg-yellow-500 px-2 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3 text-white" fill="white" />
                          <span className="text-white font-bold text-xs">{currentContent.vote_average.toFixed(1)}</span>
                        </div>
                      )}
                      
                      {/* Swipe Indicators */}
                      {isDragging && (
                        <>
                          {dragOffset.x > 50 && (
                            <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                              <div className="bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xl transform rotate-12">
                                LIKE
                              </div>
                            </div>
                          )}
                          {dragOffset.x < -50 && (
                            <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                              <div className="bg-red-500 text-white px-4 py-2 rounded-full font-bold text-xl transform -rotate-12">
                                NOPE
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Info section - compact but readable */}
                    <div className="p-3">
                      <h2 className="text-base font-bold text-white mb-1 line-clamp-2">
                        {currentContent.title || currentContent.name}
                      </h2>
                      <p className="text-gray-400 text-xs mb-2">
                        {currentContent.release_date || currentContent.first_air_date
                          ? new Date(currentContent.release_date || currentContent.first_air_date).getFullYear()
                          : ''}
                      </p>
                      <p className="text-gray-300 text-xs line-clamp-3 leading-relaxed">
                        {currentContent.overview}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Buttons - always visible */}
                <div className="flex justify-center gap-6 mt-3 flex-shrink-0">
                  <button
                    onClick={() => handleSwipe(false)}
                    className="bg-red-500 hover:bg-red-600 p-4 rounded-full shadow-xl transform hover:scale-110 transition active:scale-95"
                  >
                    <X className="w-7 h-7 text-white" strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => handleSwipe(true)}
                    className="bg-green-500 hover:bg-green-600 p-4 rounded-full shadow-xl transform hover:scale-110 transition active:scale-95"
                  >
                    <Heart className="w-7 h-7 text-white" fill="white" strokeWidth={3} />
                  </button>
                </div>

                {/* Cast - uses empty space below buttons */}
                {cast.length > 0 && (
                  <div className="mt-3 px-4 flex-shrink-0">
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {cast.map((actor, idx) => (
                        <div key={idx} className="flex-shrink-0 text-center">
                          {actor.profile_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                              alt={actor.name}
                              className="w-12 h-12 rounded-full object-cover mb-1 ring-2 ring-gray-700"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-1 ring-2 ring-gray-600">
                              <Users className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <p className="text-white text-xs font-medium w-16 truncate">
                            {actor.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-white py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                <p>Loading content...</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Friend Popup */}
        {showCodePopup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowCodePopup(false)}>
            <div className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Add Friend</h2>
              
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
                <p className="text-xs text-gray-500 mt-2">Share this code with friends</p>
              </div>

              <form onSubmit={handleAddFriend} className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter Friend's Code"
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
                    {loading ? 'Adding...' : 'Add Friend'}
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
              <Bookmark className="w-6 h-6" />
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

  if (view === 'friends') {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => setView('swipe')} className="text-white hover:text-gray-200">
              ← Back
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              Friends
            </h1>
            <button
              onClick={() => setShowCodePopup(true)}
              className="text-white hover:text-gray-200 text-sm"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Persistent Code Display */}
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-4xl mx-auto p-4">
            <div className="bg-gradient-to-r from-pink-500/20 to-red-500/20 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs mb-1">Your Friend Code</p>
                <p className="text-white font-bold text-xl tracking-wider">{myCode}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(myCode)}
                className="bg-gradient-to-r from-pink-500 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-lg transition"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          {friends.length === 0 ? (
            <div className="text-center text-white py-20">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-xl text-gray-400">No friends yet</p>
              <p className="text-gray-500 mt-2">Add friends to compare watchlists!</p>
              <button
                onClick={() => setShowCodePopup(true)}
                className="mt-6 bg-gradient-to-r from-pink-500 to-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition"
              >
                Add Your First Friend
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => showMatchesWithFriend(friend)}
                  className="bg-gray-800 rounded-xl p-4 flex items-center justify-between hover:bg-gray-700 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-red-500 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {friend.display_name?.charAt(0).toUpperCase() || 'F'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{friend.display_name}</h3>
                      <p className="text-gray-400 text-sm">Code: {friend.couple_code}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-white transition" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Friend Popup - Simplified (code shown above) */}
        {showCodePopup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowCodePopup(false)}>
            <div className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Add Friend</h2>

              <form onSubmit={handleAddFriend} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Friend's Code
                  </label>
                  <input
                    type="text"
                    placeholder="6-CHARACTER CODE"
                    value={compareCode}
                    onChange={(e) => setCompareCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-center text-xl tracking-wider font-semibold"
                    maxLength={6}
                    required
                  />
                </div>
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
                    {loading ? 'Adding...' : 'Add Friend'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'matches') {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => setView('friends')} className="text-white hover:text-gray-200">
              ← Back
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-center">
              <Check className="w-6 h-6" />
              <span>
                {selectedFriend ? `with ${selectedFriend.display_name}` : 'Matches'}
              </span>
            </h1>
            <div className="w-16"></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          {matches.length === 0 ? (
            <div className="text-center text-white py-20">
              <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-xl text-gray-400">No common matches yet</p>
              <p className="text-gray-500 mt-2">
                {selectedFriend 
                  ? `Keep swiping to find what you both like!` 
                  : 'Add friends to compare watchlists!'}
              </p>
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
